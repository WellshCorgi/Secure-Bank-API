CREATE DATABASE IF NOT EXISTS bankdb;
USE bankdb;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_number VARCHAR(20) UNIQUE NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  transaction_type ENUM('DEPOSIT', 'WITHDRAWAL' , 'TRANSFER_IN', 'TRANSFER_OUT') NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE transfers (
  transfer_id INT AUTO_INCREMENT PRIMARY KEY,
  from_account_id INT NOT NULL,
  to_account_id INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  FOREIGN KEY (from_account_id) REFERENCES accounts(account_id),
  FOREIGN KEY (to_account_id) REFERENCES accounts(account_id)
);

CREATE TABLE stocks (
  stock_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  stock_name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  price_per_unit DECIMAL(15, 2) NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);