# Secure-Bank-API

Secure and scalable Node.js/Express API for simple web banking services.

## Features

- User registration and authentication (JWT-based).
- Account management including deposit, withdrawal, and transfer.
- View transaction history.
- Manage stocks portfolio.

## Getting Started

### Prerequisites

- Node.js
- MySQL
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/Secure-Bank-API.git
cd Secure-Bank-API
```

2. Install the dependencies:

```bash
npm install
```


3. Set up your .env file with the following environment variables:
```bash
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_CONNECTION_LIMIT=10
JWT_SECRET=your_jwt_secret
PORT=3001
```

4. Setting up MySQL with Docker
```bash
#install Docker

docker run --name mysql-container -e MYSQL_ROOT_PASSWORD=1234 -p 3306:3306  -d mysql:latest
docker exec -it mysql-container bash

sh-5.1# mysql -u root -p
# Press PW & Put Query in init.sql!
```

5. Running the Application & Check connecting to Docker MySQL from node.js
```bash
node server.js
#Check CLI
node .\server.js
Server running on port 3001
Database connected successfully
```

## API Endpoints (Continuous additional features will be added)

### Authentication
- Register: POST /register
- Login: POST /login
### Accounts
- Get User Accounts: GET /accounts (Requires authentication)
- Deposit/Withdraw: POST /transaction (Requires authentication)
- Transfer: POST /transfer (Requires authentication)
- Get Account Transactions: GET /transactions/:account_id (Requires authentication)
### Stocks
- Get User Stocks: GET /stocks (Requires authentication)
- Add Stock: POST /stocks (Requires authentication)
- Delete Stock: DELETE /stocks/:stock_id (Requires authentication)
### Error Handling
- 400 Bad Request: For invalid inputs or duplicate entries.
- 401 Unauthorized: For missing or invalid authentication token.
- 403 Forbidden: For invalid token or access violations.
- 404 Not Found: For non-existing resources.
- 500 Internal Server Error: For server errors.

### Working API on Postman 

![스크린샷 2024-07-13 020203](https://github.com/user-attachments/assets/c865f1b5-9d10-465e-a6d3-26e32e274fc6)

## Contributing

Contributions are welcome! Please submit a pull request or open an issue to discuss what you would like to change.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- [Express](https://expressjs.com/)
- [MySQL](https://www.mysql.com/)
- [JWT](https://jwt.io/)
- [Bcrypt](https://www.npmjs.com/package/bcrypt)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [cors](https://www.npmjs.com/package/cors)
