CREATE TABLE carbon_transactions
(
    id              SERIAL PRIMARY KEY,
    from_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    to_company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    initiated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed ~10 trades/day for the past 365 days.
-- Price trend: +200% rise (rows 0-1500) → -30% drop (rows 1500-2500) → +50% rise (rows 2500-end)
-- Approximate prices: $9.50 → $28.50 → $19.95 → $29.93
WITH
series AS (
    SELECT
        ts,
        (row_number() OVER (ORDER BY ts) - 1) AS rn,
        (count(*) OVER ()                - 1) AS total
    FROM generate_series(
        (NOW() - INTERVAL '365 days')::timestamp,
        NOW()::timestamp,
        INTERVAL '2 hours 24 minutes'
    ) AS ts
),
-- All seeded companies, indexed 0..n-1, so the trade rotation adapts to
-- whatever companies exist instead of relying on specific seed accounts.
company_list AS (
    SELECT
        id,
        user_id,
        (row_number() OVER (ORDER BY id) - 1) AS idx
    FROM companies
),
cnt AS (
    SELECT count(*)::int AS n FROM company_list
)
INSERT INTO carbon_transactions (from_company_id, to_company_id, amount, price, initiated_by, created_at)
SELECT
    fc.id,                              -- seller (from)
    tc.id,                              -- buyer (to), always a different company
    calc.amt,
    ROUND(calc.amt * calc.ppc, 2),
    fc.user_id,                         -- initiated by the seller's owner
    s.ts
FROM series s
CROSS JOIN cnt
JOIN company_list fc ON fc.idx = (s.rn % cnt.n)
JOIN company_list tc ON tc.idx = ((s.rn + 1 + ((s.rn / cnt.n) % (cnt.n - 1))) % cnt.n)
CROSS JOIN LATERAL (
    SELECT
        ROUND((50 + random() * 450)::numeric, 2) AS amt,
        GREATEST(5.00, ROUND((
            CASE
                WHEN s.rn <= 1500 THEN
                    9.50 + (s.rn::float / 1500.0) * 19.00
                WHEN s.rn <= 2500 THEN
                    28.50 - ((s.rn - 1500)::float / 1000.0) * 8.55
                ELSE
                    19.95 + ((s.rn - 2500)::float / NULLIF(s.total - 2500, 0)) * 9.98
            END
            + sin(s.rn * 0.18) * 1.20
            + sin(s.rn * 0.72) * 0.55
            + sin(s.rn * 2.10) * 0.22
            + (random() - 0.5) * 0.80
        )::numeric, 2)) AS ppc
) AS calc;
