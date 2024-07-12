const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config(); // Load environment variables from .env file

const app = express();

app.use(cors());
app.use(express.json());

// MySQL 연결 관련 Config (.env)로 관리
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT),
    queueLimit: 0
});

// DB 연결 테스트
const testDbConnection = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
};

// Middle Ware Flow
// 1. Authorization 헤더에서 토큰을 가져오기
// 2. 토큰이 없으면 401 Unauthorized 상태를 응답
// 3. 토큰을 검증
// 3-F 토큰이 유효하지 않으면 403 Forbidden 상태를 응답 - 3-T 검증된 사용자 정보를 req.user에 저장
// 요청 처리의 다음 미들웨어로
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log("Auth Header:", authHeader);
    const token = authHeader && authHeader.toLowerCase().startsWith('bearer ') ? authHeader.split(' ')[1] : null;
    console.log("Token:", token);

    if (token == null) return res.status(401).json({ error: "No token provided" });

    console.log("test:", process.env.JWT_SECRET);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token: " + err.message });
        req.user = user;
        next();
    });
};

// Func : 계좌번호 생성 (난수로 생성 및 중복생성 불가)
const generateUniqueAccountNumber = async () => {
    while (true)  {
        const accountNumber = Math.random().toString().slice(2,11);
        const [rows] = await pool.query('SELECT * FROM accounts WHERE account_number = ?', [accountNumber]);
        if (rows.length === 0) {
            return accountNumber;
        }
    }
};

// 회원가입
app.post('/register', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { username, password, email, initialDeposit } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const accountNumber = await generateUniqueAccountNumber();

        await connection.beginTransaction();

        const [userResult] = await connection.query(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email]
        );

        const userId = userResult.insertId;

        await connection.query(
            'INSERT INTO accounts (user_id, account_number, balance) VALUES (?, ?, ?)',
            [userId, accountNumber, parseFloat(initialDeposit)]
        );

        await connection.commit();

        res.json({ message: "User registered successfully", userId, accountNumber });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "Username or email already exists" });
        } else {
            res.status(500).json({ error: error.message });
        }
    } finally {
        connection.release();
    }
});

// 로그인
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(400).json({ error: "User not found" });
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 로그인 이후 과정, authenticationToken 필요함

// 사용자의 모든 계좌 조회
app.get('/accounts', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.userId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 사용자로부터 입출금
app.post('/transaction', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { account_id, transaction_type, amount } = req.body;

        await connection.beginTransaction();

        //1차 계좌 유효성 판단
        const [accounts] = await connection.query('SELECT * FROM accounts WHERE account_id = ? AND user_id = ?',
            [account_id, req.user.userId]);
        if (accounts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Account not found or you don't have permission" });
        }

        const account = accounts[0];
        const currentBalanceCents = Math.round(account.balance * 100);
        const amountCents = Math.round(parseFloat(amount) * 100);
        let newBalanceCents;
        // 입금 or 출금 or 둘다 아님 여부 판단
        if (transaction_type === 'DEPOSIT') {
            newBalanceCents = currentBalanceCents + amountCents;
        } else if (transaction_type === 'WITHDRAWAL') {
            if (currentBalanceCents < amountCents) {
                await connection.rollback();
                return res.status(400).json({ error: "Insufficient funds" });
            }
            newBalanceCents = currentBalanceCents - amountCents;
        } else {
            await connection.rollback();
            return res.status(400).json({ error: "Invalid transaction type" });
        }

        // Fix : Mysql 부동소숫점 1차 개선
        const newBalance = newBalanceCents / 100;

        await connection.query('UPDATE accounts SET balance = ROUND(?, 2) WHERE account_id = ?',
            [newBalance, account_id]);

        await connection.query(
            'INSERT INTO transactions (account_id, transaction_type, amount) VALUES (?, ?, ROUND(?, 2))',
            [account_id, transaction_type, parseFloat(amount)]
        );

        await connection.commit();

        res.json({ message: "Transaction successful", newBalance: newBalance.toFixed(2) });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 송금 기능
app.post('/transfer', authenticateToken, async(req, res) => {
    const connection = await pool.getConnection();
    try{
        // Part : 송신자 출금 계좌 검증
        const { from_account_id, to_account_number, amount, description } = req.body;
        await connection.beginTransaction();
        const [fromAccounts] = await connection.query('SELECT * FROM accounts WHERE account_id = ? AND user_id = ?',
            [from_account_id, req.user.userId]);
        if (fromAccounts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Source account not found or you don't have permission" });
        }

        // Part : 수신자 입금 계좌 검증
        const [toAccounts] = await connection.query('SELECT * FROM accounts WHERE account_number = ?', [to_account_number]);
        if (toAccounts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Destination account not found" });
        }

        // All ture
        const fromAccount = fromAccounts[0];
        const toAccount = toAccounts[0];
        const transferAmountCents = Math.round(parseFloat(amount) * 100);
        const fromBalanceCents = Math.round(fromAccount.balance * 100);

        // Part : 송신자 출금 계좌 잔액 검증
        if (fromBalanceCents < transferAmountCents) {
            await connection.rollback();
            return res.status(400).json({ error: "Insufficient funds" });
        }

        // Database 업데이트
        const newFromBalance = (fromBalanceCents - transferAmountCents) / 100;
        const newToBalance = (Math.round(toAccount.balance * 100) + transferAmountCents) / 100;

        await connection.query('UPDATE accounts SET balance = ROUND(?, 2) WHERE account_id = ?', [newFromBalance, from_account_id]);
        await connection.query('UPDATE accounts SET balance = ROUND(?, 2) WHERE account_id = ?', [newToBalance, toAccount.account_id]);


        // 해당 송금내역 추가
        await connection.query(
            'INSERT INTO transfers (from_account_id, to_account_id, amount, description) VALUES (?, ?, ROUND(?, 2), ?)',
            [from_account_id, toAccount.account_id, parseFloat(amount), description]
        );

        // 해당 거래내역 Insert
        await connection.query(
            'INSERT INTO transactions (account_id, transaction_type, amount, description) VALUES (?, ?, ROUND(?, 2), ?)',
            [from_account_id, 'TRANSFER_OUT', parseFloat(amount), `Transfer to ${to_account_number}`]
        );
        await connection.query(
            'INSERT INTO transactions (account_id, transaction_type, amount, description) VALUES (?, ?, ROUND(?, 2), ?)',
            [toAccount.account_id, 'TRANSFER_IN', parseFloat(amount), `Transfer from ${fromAccount.account_number}`]
        );


        await connection.commit();

        res.json({ message: "Transfer successful" });
    }catch(error){
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 거래 내역 조회
app.get('/transactions/:account_id', authenticateToken, async (req, res) => {
    try {
        const { account_id } = req.params;
        const [accounts] = await pool.query('SELECT * FROM accounts WHERE account_id = ? AND user_id = ?', [account_id, req.user.userId]);

        if (accounts.length === 0) {
            return res.status(404).json({ error: "Account not found or you don't have permission" });
        }

        const [transactions] = await pool.query(
            'SELECT * FROM transactions WHERE account_id = ? ORDER BY transaction_date DESC',
            [account_id]
        );
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 사용자의 모든 주식 조회
app.get('/stocks', authenticateToken, async (req, res) => {
    try {
        const [stocks] = await pool.query('SELECT * FROM stocks WHERE user_id = ?', [req.user.userId]);
        res.json(stocks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 주식 등록
app.post('/stocks', authenticateToken, async (req, res) => {
    try {
        const { stock_name, quantity, price_per_unit } = req.body;
        const [result] = await pool.query(
            'INSERT INTO stocks (user_id, stock_name, quantity, price_per_unit) VALUES (?, ?, ?, ?)',
            [req.user.userId, stock_name, parseInt(quantity), parseFloat(price_per_unit)]
        );
        res.json({ message: "Stock added successfully", stockId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 주식 삭제
app.delete('/stocks/:stock_id', authenticateToken, async (req, res) => {
    try {
        const { stock_id } = req.params;
        const [result] = await pool.query('DELETE FROM stocks WHERE stock_id = ? AND user_id = ?', [stock_id, req.user.userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Stock not found or you don't have permission to delete it" });
        }

        res.json({ message: "Stock deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    testDbConnection(); // DB 연결 테스트 함수 호출
});

module.exports=app;