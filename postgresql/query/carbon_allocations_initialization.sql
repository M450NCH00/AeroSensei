-- Per-company, per-year compliance ledger for the China ETS cycle.
-- A row is created at PRE_ALLOCATION (only pre_allocation known), then filled in
-- at FINALIZE (formula columns + allocation_amount + surplus_deficit) and finally
-- at SETTLE (surrendered_amount = real emissions deducted). The formula columns
-- are therefore nullable until the final allocation runs.
CREATE TABLE carbon_allocations (
    id                   SERIAL PRIMARY KEY,
    company_id           INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year                 INTEGER NOT NULL,

    -- Allowances granted up front (70% of prior-year verified emissions)
    pre_allocation       NUMERIC(15,4),

    -- Filled at FINALIZE from the full-year FINAL report + sector benchmark
    verified_emissions   NUMERIC(15,4),
    activity_level       NUMERIC(15,4),
    intensity            NUMERIC(15,6),
    benchmark_intensity  NUMERIC(15,6),
    deviation_pct        NUMERIC(8,4),
    allocation_amount    NUMERIC(15,4),   -- final allocation after benchmark adjustment

    -- Year surplus/deficit = final allocation - verified emissions (efficiency:
    -- allocated more than emitted -> surplus; less -> deficit)
    surplus_deficit      NUMERIC(15,4),

    -- Real emissions deducted from the balance at SETTLE (surplus carries forward)
    surrendered_amount   NUMERIC(15,4),

    -- PRE_ALLOCATED -> ALLOCATED -> SETTLED
    status               VARCHAR(20) NOT NULL DEFAULT 'PRE_ALLOCATED',

    allocated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year)
);
