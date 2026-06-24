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
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_pm_alerts_site_id ON pm_alerts(site_id);

-- Mock breaches for testing the enforcement/fine feature. Sites are resolved by
-- name (seeded in company_site_initialization.sql, which runs first).
INSERT INTO pm_alerts (site_id, pm_type, measured_value, threshold_value, alert_level, triggered_at, note)
VALUES
    ((SELECT id FROM company_sites WHERE site_name = 'Dung Quat Steel Complex'),
        'pm2.5', 96.40, 35.00, 'BREACHED', NOW() - INTERVAL '30 minutes', 'Sustained spike from sinter plant stack'),
    ((SELECT id FROM company_sites WHERE site_name = 'Hai Duong Iron Complex'),
        'pm10', 148.20, 50.00, 'BREACHED', NOW() - INTERVAL '3 hours', 'Heavy particulate during blast furnace tapping'),
    ((SELECT id FROM company_sites WHERE site_name = 'Dinh Co Gas Plant'),
        'pm2.5', 47.10, 35.00, 'WARNING', NOW() - INTERVAL '8 hours', 'Elevated readings near flare unit'),
    ((SELECT id FROM company_sites WHERE site_name = 'Hai Phong Manufacturing Plant'),
        'pm10', 63.80, 50.00, 'WARNING', NOW() - INTERVAL '1 day', 'Paint-shop extraction above limit'),
    ((SELECT id FROM company_sites WHERE site_name = 'Masan Thai Nguyen Plant'),
        'pm2.5', 112.50, 35.00, 'BREACHED', NOW() - INTERVAL '2 days', 'Boiler particulate breach, multiple sensors'),
    ((SELECT id FROM company_sites WHERE site_name = 'Vietnam Mega Factory'),
        'pm10', 51.30, 50.00, 'WARNING', NOW() - INTERVAL '5 days', 'Intermittent breach, dust from logistics yard')
ON CONFLICT DO NOTHING;
