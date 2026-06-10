CREATE TABLE IF NOT EXISTS sensor_registry
(
    -- Added UUID column that generates automatically
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    sensor_id VARCHAR(50) PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    location_name VARCHAR(100) NOT NULL,
    latitude NUMERIC(11, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    installation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert initial test data
INSERT INTO sensor_registry
(sensor_id, company_id, location_name, latitude, longitude, status, installation_date)
VALUES
    ('esp32_001', 1, 'Main Warehouse', 1.352083, 103.819836, 'active', '2026-06-01'),
    ('esp32_002', 1, 'Server Room Alpha', 1.352100, 103.819900, 'active', '2026-06-05'),
    ('esp32_003', 1, 'Loading Dock B', 1.352150, 103.820100, 'maintenance', '2026-06-08');

