CREATE TABLE emission_reports (
    id                 SERIAL PRIMARY KEY,
    company_id         INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year               INTEGER NOT NULL,
    activity_level     NUMERIC(15,4) NOT NULL,
    verified_emissions NUMERIC(15,4) NOT NULL,
    submitted_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year)
);
