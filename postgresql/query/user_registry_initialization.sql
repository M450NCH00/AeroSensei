CREATE TABLE users
(
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Government', 'Company')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Seed initial users: 1 government, 3 companies
INSERT INTO users (email, password_hash, role, created_at)
VALUES 
('government@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Government', CURRENT_TIMESTAMP),
('company1@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company', CURRENT_TIMESTAMP),
('company2@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company', CURRENT_TIMESTAMP),
('company3@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company', CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;


