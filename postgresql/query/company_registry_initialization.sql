CREATE TABLE companies
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    carbon_credits NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed companies linked to seeded users (by email). Adjust carbon_credits as needed.
INSERT INTO companies (user_id, carbon_credits, created_at, updated_at)
VALUES
    ((SELECT id FROM users WHERE email = 'company1@example.com' LIMIT 1), 10000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ((SELECT id FROM users WHERE email = 'company2@example.com' LIMIT 1), 8000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ((SELECT id FROM users WHERE email = 'company3@example.com' LIMIT 1), 12000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING id, user_id, carbon_credits;
