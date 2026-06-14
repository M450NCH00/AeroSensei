CREATE TABLE companies
(
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name   VARCHAR(255),
    industry_type  VARCHAR(100),
    scale          VARCHAR(20) CHECK (scale IN ('micro', 'small', 'medium', 'large', 'enterprise')),
    carbon_credits NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed companies linked to seeded users (by email). Adjust carbon_credits as needed.
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits, created_at, updated_at)
VALUES
    ((SELECT id FROM users WHERE email = 'company1@example.com' LIMIT 1), 'Company One', 'Technology', 'medium', 10000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ((SELECT id FROM users WHERE email = 'company2@example.com' LIMIT 1), 'Company Two', 'Manufacturing', 'small',   8000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ((SELECT id FROM users WHERE email = 'company3@example.com' LIMIT 1), 'Company Three', 'Energy', 'large',      12000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING id, user_id, company_name, industry_type, scale, carbon_credits;
