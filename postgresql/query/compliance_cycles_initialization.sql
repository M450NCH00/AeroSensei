-- One row per compliance year tracking which phase of the China ETS cycle it is
-- in. Phases are advanced manually by a GOVERNMENT/ADMIN user (no scheduler):
--   PENDING -> PRE_ALLOCATED -> MIDYEAR_OPEN -> FINAL_OPEN -> ALLOCATED -> SETTLED
CREATE TABLE compliance_cycles (
    id                SERIAL PRIMARY KEY,
    year              INTEGER NOT NULL UNIQUE,
    phase             VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (phase IN ('PENDING','PRE_ALLOCATED','MIDYEAR_OPEN',
                                       'FINAL_OPEN','ALLOCATED','SETTLED')),
    pre_allocated_at  TIMESTAMP,
    midyear_opened_at TIMESTAMP,
    final_opened_at   TIMESTAMP,
    allocated_at      TIMESTAMP,
    settled_at        TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Past years are already closed; 2025 is the live cycle to demo. Pre-allocation
-- for 2025 reads 2024 FINAL emissions, which are present in the emission_reports seed.
INSERT INTO compliance_cycles (year, phase, pre_allocated_at, midyear_opened_at, final_opened_at, allocated_at, settled_at)
VALUES
    (2022, 'SETTLED', '2022-01-15', '2022-07-01', '2022-12-01', '2023-01-20', '2023-12-31'),
    (2023, 'SETTLED', '2023-01-15', '2023-07-01', '2023-12-01', '2024-01-20', '2024-12-31'),
    (2024, 'SETTLED', '2024-01-15', '2024-07-01', '2024-12-01', '2025-01-20', '2025-12-31'),
    (2025, 'PENDING',  NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (year) DO NOTHING;
