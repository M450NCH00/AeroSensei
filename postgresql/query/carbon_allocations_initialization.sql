CREATE TABLE carbon_allocations (
    id                   SERIAL PRIMARY KEY,
    company_id           INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year                 INTEGER NOT NULL,
    verified_emissions   NUMERIC(15,4) NOT NULL,
    activity_level       NUMERIC(15,4) NOT NULL,
    intensity            NUMERIC(15,6) NOT NULL,
    benchmark_intensity  NUMERIC(15,6) NOT NULL,
    deviation_pct        NUMERIC(8,4) NOT NULL,
    allocation_amount    NUMERIC(15,4) NOT NULL,
    allocated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year)
);
