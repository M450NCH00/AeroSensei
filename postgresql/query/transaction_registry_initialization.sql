CREATE TABLE pollution_quota_transactions
(
    id SERIAL PRIMARY KEY,
    from_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    to_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_companies CHECK (from_company_id <> to_company_id)
);
