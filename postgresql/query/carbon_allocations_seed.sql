-- Backfill the compliance ledger for the already-closed cycles (2022-2024) so the
-- historical years display as fully SETTLED. 2025 is left open for the live demo.
--
-- This mirrors the runtime cycle:
--   final allocation = sector benchmark + 3-tier deviation formula,
--   settlement       = deduct the real (verified) emissions from the balance;
--                      any surplus carries forward (credits do not expire).
-- Runs after emission_reports (script 10) since it reads the FINAL reports.
WITH final_reports AS (
    SELECT er.company_id, er.year, c.sector_id,
           er.activity_level, er.verified_emissions
    FROM emission_reports er
    JOIN companies c ON c.id = er.company_id
    WHERE er.report_type = 'FINAL'
      AND er.year BETWEEN 2022 AND 2024
      AND c.sector_id IS NOT NULL
),
benchmarks AS (
    SELECT sector_id, year,
           SUM(verified_emissions) / NULLIF(SUM(activity_level), 0) AS benchmark
    FROM final_reports
    GROUP BY sector_id, year
),
calc AS (
    SELECT fr.company_id, fr.year, fr.activity_level, fr.verified_emissions,
           (fr.verified_emissions / NULLIF(fr.activity_level, 0)) AS intensity,
           b.benchmark,
           ((fr.verified_emissions / NULLIF(fr.activity_level, 0)) - b.benchmark)
               / NULLIF(b.benchmark, 0) AS deviation
    FROM final_reports fr
    JOIN benchmarks b ON b.sector_id = fr.sector_id AND b.year = fr.year
),
alloc AS (
    SELECT c.*,
        CASE
            WHEN ABS(c.deviation) <= 0.20 THEN c.verified_emissions * (1 - c.deviation * 0.15)
            WHEN c.deviation > 0.20      THEN c.verified_emissions * 0.97
            ELSE                              c.verified_emissions * 1.03
        END AS allocation_amount,
        -- 70% of prior-year emissions (0 for 2022 since 2021 is not seeded)
        COALESCE((
            SELECT 0.70 * prev.verified_emissions
            FROM emission_reports prev
            WHERE prev.company_id = c.company_id
              AND prev.year = c.year - 1
              AND prev.report_type = 'FINAL'
        ), 0) AS pre_allocation
    FROM calc c
)
INSERT INTO carbon_allocations (
    company_id, year, pre_allocation, verified_emissions, activity_level,
    intensity, benchmark_intensity, deviation_pct, allocation_amount,
    surplus_deficit, surrendered_amount, status, allocated_at)
SELECT
    a.company_id,
    a.year,
    ROUND(a.pre_allocation, 4),
    ROUND(a.verified_emissions, 4),
    ROUND(a.activity_level, 4),
    ROUND(a.intensity, 6),
    ROUND(a.benchmark, 6),
    ROUND(a.deviation * 100, 4),
    ROUND(a.allocation_amount, 4),
    ROUND(a.allocation_amount - a.verified_emissions, 4),       -- surplus / deficit (carried forward)
    ROUND(LEAST(a.verified_emissions, a.allocation_amount), 4), -- real emissions deducted at settle
    'SETTLED',
    make_timestamp(a.year + 1, 1, 20, 10, 0, 0)
FROM alloc a
ON CONFLICT (company_id, year) DO NOTHING;
