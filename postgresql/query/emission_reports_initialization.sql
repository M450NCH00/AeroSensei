CREATE TABLE emission_reports (
    id                 SERIAL PRIMARY KEY,
    company_id         INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year               INTEGER NOT NULL,
    activity_level     NUMERIC(15,4) NOT NULL,
    verified_emissions NUMERIC(15,4) NOT NULL,
    submitted_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year)
);

INSERT INTO emission_reports (company_id, year, activity_level, verified_emissions, submitted_at) VALUES
  -- Company One (Service)
  (1, 2022, 42000.00,   7800.00, '2023-01-18 10:00:00'),
  (1, 2023, 45000.00,   8200.00, '2024-01-15 10:30:00'),
  (1, 2024, 47500.00,   8750.00, '2025-01-12 09:15:00'),
  (1, 2025, 49000.00,   9100.00, '2026-01-10 11:00:00'),
  -- Company Two (Steel)
  (2, 2022, 68000.00, 125800.00, '2023-01-20 14:00:00'),
  (2, 2023, 72000.00, 133200.00, '2024-01-18 14:00:00'),
  (2, 2024, 76000.00, 140600.00, '2025-01-14 13:30:00'),
  (2, 2025, 78500.00, 145225.00, '2026-01-08 10:45:00'),
  -- Company Three (Power Generation)
  (3, 2022,  98000.00, 160000.00, '2023-01-22 09:00:00'),
  (3, 2023, 105000.00, 172000.00, '2024-01-20 08:00:00'),
  (3, 2024, 112000.00, 185000.00, '2025-01-16 08:30:00'),
  (3, 2025, 117000.00, 194500.00, '2026-01-11 09:00:00')
ON CONFLICT (company_id, year) DO NOTHING;
