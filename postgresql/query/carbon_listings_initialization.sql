CREATE TABLE carbon_listings
(
    id               SERIAL PRIMARY KEY,
    seller_company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    buyer_company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT chk_has_company CHECK (seller_company_id IS NOT NULL OR buyer_company_id IS NOT NULL),
    credits_amount   NUMERIC(12, 2) NOT NULL CHECK (credits_amount > 0),
    remaining_credits NUMERIC(12, 2) NOT NULL CHECK (remaining_credits >= 0),
    price_per_credit NUMERIC(12, 2) NOT NULL CHECK (price_per_credit > 0),
    status           VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sell listings (seller_company_id set, buyer_company_id null)
INSERT INTO carbon_listings (seller_company_id, credits_amount, remaining_credits, price_per_credit, status)
VALUES
    (2, 500.00,  500.00,  12.50, 'active'),
    (3, 1200.00, 1200.00, 11.00, 'active'),
    (2, 300.00,  300.00,  13.25, 'active');

-- Buy requests (seller_company_id null, buyer_company_id set)
-- Prices are intentionally below all sell listings (min sell: 11.00) so no auto-match occurs
INSERT INTO carbon_listings (buyer_company_id, credits_amount, remaining_credits, price_per_credit, status)
VALUES
    (1, 400.00,  400.00,   9.50, 'active'),
    (3, 800.00,  800.00,  10.00, 'active'),
    (1, 250.00,  250.00,   8.75, 'active');
