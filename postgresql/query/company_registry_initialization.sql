CREATE TABLE companies
(
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name   VARCHAR(255),
    carbon_credits NUMERIC(12,2) NOT NULL DEFAULT 0,
    sector_id      INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed companies linked to seeded users (by email).
INSERT INTO companies (user_id, company_name, carbon_credits, sector_id, created_at, updated_at)
VALUES
    (
        (SELECT id FROM users WHERE email = 'company1@example.com' LIMIT 1),
        'Company One', 10000.00,
        (SELECT id FROM sectors WHERE name = 'Service' LIMIT 1),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        (SELECT id FROM users WHERE email = 'company2@example.com' LIMIT 1),
        'Company Two', 8000.00,
        (SELECT id FROM sectors WHERE name = 'Steel' LIMIT 1),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        (SELECT id FROM users WHERE email = 'company3@example.com' LIMIT 1),
        'Company Three', 12000.00,
        (SELECT id FROM sectors WHERE name = 'Power Generation' LIMIT 1),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
RETURNING id, user_id, company_name, carbon_credits, sector_id;
