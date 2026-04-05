CREATE DATABASE IF NOT EXISTS vaultify_db;
USE vaultify_db;

-- Table for User Accounts
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url TEXT
);

-- Table for Bills/Products
CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_name VARCHAR(255),
    vendor VARCHAR(100),
    price DECIMAL(10, 2),
    category VARCHAR(50),
    warranty_months INT,
    purchase_date DATE,
    image_path TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

USE vaultify_db;
SELECT * FROM user;

USE vaultify_db;

SELECT * FROM bill;

DESCRIBE claim;
SELECT * FROM claim;
SELECT 
    c.id AS Claim_ID, 
    b.name AS Product, 
    c.status AS Current_Status, 
    c.description AS Issue,
    c.created_at AS Date_Opened
FROM claim c
JOIN bill b ON c.bill_id = b.id;
SELECT history_log 
FROM claim 
WHERE id = 4;
SELECT id, LEFT(claim_docs, 50) AS image_preview 
FROM claim 
WHERE claim_docs IS NOT NULL;