CREATE TABLE companies
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pollution_quota NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed companies linked to seeded users (by email). Adjust pollution_quota as needed.
INSERT INTO companies (user_id, pollution_quota, created_at, updated_at)
VALUES
    ((SELECT id FROM users WHERE email = 'company1@example.com' LIMIT 1), 10000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ((SELECT id FROM users WHERE email = 'company2@example.com' LIMIT 1), 8000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ((SELECT id FROM users WHERE email = 'company3@example.com' LIMIT 1), 12000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING id, user_id, pollution_quota;
