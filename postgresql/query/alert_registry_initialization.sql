-- PM-threshold breaches recorded per company SITE (not per sensor): a site can
-- host several sensors, but enforcement happens at the site/company level. The
-- backend aggregates sensor readings per site and writes one row here per breach.
CREATE TABLE IF NOT EXISTS pm_alerts (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES company_sites(id) ON DELETE CASCADE,
    pm_type VARCHAR(10) NOT NULL CHECK (pm_type IN ('pm2.5', 'pm10')),
    measured_value NUMERIC(10,2) NOT NULL,
    threshold_value NUMERIC(10,2) NOT NULL,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('BREACHED', 'WARNING')),
    -- The calendar day the breach/warning is FOR — i.e. the day whose readings the
    -- daily PM evaluator averaged. triggered_at is when the row was written; this is
    -- which day it concerns (they differ if the evaluator runs after midnight).
    alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    note TEXT
);

-- Keep existing databases in sync (init scripts only run on a fresh data dir).
ALTER TABLE pm_alerts ADD COLUMN IF NOT EXISTS alert_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_pm_alerts_site_id ON pm_alerts(site_id);
CREATE INDEX IF NOT EXISTS idx_pm_alerts_alert_date ON pm_alerts(alert_date);