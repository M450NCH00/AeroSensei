CREATE TABLE IF NOT EXISTS users
(
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- This column now strictly references the role_permissions table
    role_name VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,

    -- THIS IS THE CONNECTION: It guarantees a user can only have a valid role
    CONSTRAINT fk_users_role
    FOREIGN KEY (role_name)
    REFERENCES role_permissions (role_name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
    );

-- Seed initial users
INSERT INTO users (email, password_hash, role_name, created_at)
VALUES
    ('government@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Government', CURRENT_TIMESTAMP),
    ('company1@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company', CURRENT_TIMESTAMP),
    ('company2@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company', CURRENT_TIMESTAMP),
    ('company3@example.com', '$2a$10$eoRbY/SI8xhdR/1IJaLKzuz6Ry1zGMYYGF4jR6wkceeJGHij86p72', 'Company', CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO NOTHING;