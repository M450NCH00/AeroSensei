-- Fines issued by the government against PM-breach alerts.
-- A fine is raised from a pm_alerts row; we denormalize site_id + company_id so
-- the fine survives even if the originating alert is later cleaned up.
CREATE TABLE IF NOT EXISTS fines (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES pm_alerts(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES company_sites(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'cancelled')),
    issued_by VARCHAR(255),
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fines_alert_id ON fines(alert_id);
CREATE INDEX IF NOT EXISTS idx_fines_company_id ON fines(company_id);
