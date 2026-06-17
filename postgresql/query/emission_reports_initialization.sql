CREATE TABLE emission_reports (
    id                 SERIAL PRIMARY KEY,
    company_id         INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year               INTEGER NOT NULL,
    activity_level     NUMERIC(15,4) NOT NULL,
    verified_emissions NUMERIC(15,4) NOT NULL,
    submitted_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year)
);

-- Seed an emission report for every existing company across 2022-2025.
-- Figures are derived from each company's carbon-credit allocation and a
-- sector-specific emission intensity, with ~5% year-on-year growth, so the
-- data scales automatically to whatever companies are present.
--
-- To avoid every company in a sector landing on an identical intensity
-- (which would make the benchmark deviation zero for everyone), the activity
-- level and emissions are perturbed independently:
--   * a deterministic per-company intensity factor (~0.78..1.22) shifts each
--     company above or below its sector benchmark, and
--   * a small per-company/per-year wobble adds mild noise.
-- Both are derived from the company id so the data is stable across re-runs.
INSERT INTO emission_reports (company_id, year, activity_level, verified_emissions, submitted_at)
SELECT
    c.id,
    y.year,
    -- Underlying activity level (production / throughput proxy), growing yearly,
    -- with a mild per-company/per-year wobble so it isn't perfectly smooth.
    ROUND((
        c.carbon_credits * 0.9
        * (1 + (y.year - 2022) * 0.05)
        * (1 + 0.03 * cos(c.id * 1.3 + y.year))
    )::numeric, 4) AS activity_level,
    -- Verified emissions (tCO2e) = scaled activity * sector emission intensity,
    -- multiplied by a per-company intensity factor so companies deviate from
    -- the sector benchmark instead of all sharing the same intensity.
    ROUND((
        c.carbon_credits
        * (1 + (y.year - 2022) * 0.05)
        * CASE s.name
            WHEN 'Materials'          THEN 4.20
            WHEN 'Energy'             THEN 3.80
            WHEN 'Transportation'     THEN 3.10
            WHEN 'Automotive'         THEN 2.40
            WHEN 'Industrials'        THEN 2.00
            WHEN 'Conglomerate'       THEN 1.60
            WHEN 'Consumer Staples'   THEN 1.30
            WHEN 'Real Estate'        THEN 1.10
            WHEN 'Retail'             THEN 0.80
            WHEN 'Technology'         THEN 0.45
            WHEN 'Banking'            THEN 0.30
            WHEN 'Financial Services' THEN 0.28
            WHEN 'Insurance'          THEN 0.26
            ELSE 1.00
          END
        -- per-company intensity factor: 0.78 .. 1.22, spread across companies
        * (0.78 + ((c.id * 7) % 23) * 0.02)
        -- small per-company/per-year wobble (~±4%)
        * (1 + 0.04 * sin(c.id + y.year))
    )::numeric, 4) AS verified_emissions,
    -- Reports submitted in January of the following year
    make_timestamp(y.year + 1, 1, 15, 10, 0, 0) AS submitted_at
FROM companies c
JOIN sectors s ON s.id = c.sector_id
CROSS JOIN generate_series(2022, 2025) AS y(year)
ON CONFLICT (company_id, year) DO NOTHING;
