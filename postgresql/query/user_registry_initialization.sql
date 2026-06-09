CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Government', 'Factory')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
    );

-- Both users use the password: password123
INSERT INTO users (email, password_hash, role)
VALUES
    ('government_officer@test.com', '$2a$10$X5.lOlsX.2mG80H9f73M6ux8VbkWpM9QenwEUnvBnyK4l3v2rNKeK', 'Government'),
    ('factory_manager@test.com', '$2a$10$X5.lOlsX.2mG80H9f73M6ux8VbkWpM9QenwEUnvBnyK4l3v2rNKeK', 'Factory')
    ON CONFLICT (email) DO NOTHING;