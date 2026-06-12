CREATE TABLE carbon_listings
(
    id               SERIAL PRIMARY KEY,
    seller_company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    buyer_company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT chk_has_company CHECK (seller_company_id IS NOT NULL OR buyer_company_id IS NOT NULL),
    credits_amount   NUMERIC(12, 2) NOT NULL CHECK (credits_amount > 0),
    remaining_credits NUMERIC(12, 2) NOT NULL CHECK (remaining_credits >= 0),
    price_per_credit NUMERIC(12, 2) NOT NULL CHECK (price_per_credit > 0),
    status           VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'pending_matching')),
    kafka_request_id VARCHAR(36),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sell listings (seller_company_id set, buyer_company_id null)
-- Prices reflect current market level (~$29-$30)
INSERT INTO carbon_listings (seller_company_id, credits_amount, remaining_credits, price_per_credit, status)
VALUES
    (2,  500.00,  500.00, 29.50, 'active'),
    (3, 1200.00, 1200.00, 28.75, 'active'),
    (2,  300.00,  300.00, 31.00, 'active'),
    (3,  800.00,  800.00, 29.00, 'active'),
    (2,  650.00,  650.00, 30.25, 'active'),
    (3,  450.00,  450.00, 28.50, 'active'),
    (2,  900.00,  900.00, 32.00, 'active'),
    (3,  275.00,  275.00, 30.75, 'active');

-- Buy requests (buyer_company_id set, seller_company_id null)
-- Mix of bids at/above market (will match) and below market (queued)
INSERT INTO carbon_listings (buyer_company_id, credits_amount, remaining_credits, price_per_credit, status)
VALUES
    -- At or above cheapest ask ($28.50) — eligible for matching
    (1,  400.00,  400.00, 29.50, 'active'),
    (1,  600.00,  600.00, 29.00, 'active'),
    (3,  350.00,  350.00, 30.00, 'active'),
    (1,  500.00,  500.00, 32.00, 'active'),
    (3,  700.00,  700.00, 28.50, 'active'),
    -- Below market — queued, no immediate match
    (1,  800.00,  800.00, 27.00, 'active'),
    (3,  250.00,  250.00, 26.50, 'active'),
    (1,  700.00,  700.00, 25.00, 'active'),
    (3,  450.00,  450.00, 24.75, 'active');
