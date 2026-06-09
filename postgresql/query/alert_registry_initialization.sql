CREATE TABLE IF NOT EXISTS pm_alerts (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) NOT NULL REFERENCES sensor_registry(sensor_id) ON DELETE CASCADE,
    pm_type VARCHAR(10) NOT NULL CHECK (pm_type IN ('pm2.5', 'pm10')),
    measured_value NUMERIC(10,2) NOT NULL,
    threshold_value NUMERIC(10,2) NOT NULL,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('warning', 'critical')),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    note TEXT
);