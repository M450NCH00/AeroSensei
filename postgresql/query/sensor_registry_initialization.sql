CREATE TABLE IF NOT EXISTS sensor_registry
(
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    sensor_id VARCHAR(50) PRIMARY KEY,

    -- Links to the site
    site_id INTEGER REFERENCES company_sites(id) ON DELETE SET NULL,

    -- BRINGING THESE BACK FOR EXACT SENSOR PLACEMENT
    latitude NUMERIC(11, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    geohash VARCHAR(12) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    installation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Index the geohash column for fast prefix-based spatial queries
CREATE INDEX IF NOT EXISTS idx_sensor_geohash ON sensor_registry (geohash varchar_pattern_ops);

-- Insert initial test data with slight coordinate offsets from the main site
INSERT INTO sensor_registry (sensor_id, site_id, latitude, longitude, geohash, status, installation_date)
VALUES
    -- VPBank Tower Hanoi (Lat: ~21.01, Lon: ~105.81) -> Offset East
    ('esp32_015', (SELECT id FROM company_sites WHERE site_name = 'VPBank Tower Hanoi'), 21.016350, 105.814350, 'w7er1c4v5', 'active', '2026-01-10'),

    -- VPBank Saigon Branch (Lat: ~10.77, Lon: ~106.70) -> Offset North
    ('esp32_016', (SELECT id FROM company_sites WHERE site_name = 'VPBank Saigon Branch'), 10.772550, 106.700100, 'w3gvk1m2q', 'active', '2026-01-12'),

    -- Dinh Co Gas Plant (Lat: ~10.39, Lon: ~107.16) -> Offset South
    ('esp32_017', (SELECT id FROM company_sites WHERE site_name = 'Dinh Co Gas Plant'), 10.395050, 107.169100, 'w3thsx7b8', 'maintenance', '2025-11-20'),

    -- Ca Mau Gas Plant (Lat: ~9.12, Lon: ~104.98)
    ('esp32_018', (SELECT id FROM company_sites WHERE site_name = 'Ca Mau Gas Plant'), 9.123450, 104.987650, 'w38zdf9rt', 'active', '2025-11-25'),

    -- Dung Quat Steel Complex (Lat: ~15.39, Lon: ~108.79)
    ('esp32_019', (SELECT id FROM company_sites WHERE site_name = 'Dung Quat Steel Complex'), 15.394250, 108.790150, 'w6vrmq1pl', 'offline', '2026-02-14'),

    -- Hai Duong Iron Complex (Lat: ~20.97, Lon: ~106.46)
    ('esp32_020', (SELECT id FROM company_sites WHERE site_name = 'Hai Duong Iron Complex'), 20.971250, 106.463350, 'w7eyg5hjk', 'active', '2026-02-18'),

    -- VinFast Hai Phong (Lat: ~20.82, Lon: ~106.84) -> Multiple sensors for a large plant
    ('esp32_021', (SELECT id FROM company_sites WHERE site_name = 'Hai Phong Manufacturing Plant'), 20.820550, 106.840250, 'w7eyxw2mn', 'active', '2026-05-01'),
    ('esp32_022', (SELECT id FROM company_sites WHERE site_name = 'Hai Phong Manufacturing Plant'), 20.820600, 106.840100, 'w7eyxw3op', 'active', '2026-05-01'),

    -- FPT Tower Cau Giay (Lat: ~21.03, Lon: ~105.78)
    ('esp32_023', (SELECT id FROM company_sites WHERE site_name = 'FPT Tower Cau Giay'), 21.031550, 105.783150, 'w7er3p8kj', 'active', '2026-03-22'),

    -- FPT Complex Da Nang (Lat: ~15.97, Lon: ~108.25)
    ('esp32_024', (SELECT id FROM company_sites WHERE site_name = 'FPT Complex Da Nang'), 15.976550, 108.256150, 'w6vhd4tyu', 'active', '2026-03-25'),

    -- Vinamilk Mega Factory (Lat: ~11.05, Lon: ~106.66)
    ('esp32_025', (SELECT id FROM company_sites WHERE site_name = 'Vietnam Mega Factory'), 11.050550, 106.666150, 'w3gwn7zbv', 'active', '2025-10-10'),

    -- VietJet Noi Bai Hangar (Lat: ~21.21, Lon: ~105.80)
    ('esp32_026', (SELECT id FROM company_sites WHERE site_name = 'Noi Bai Hangar 1'), 21.218750, 105.804250, 'w7er9k2qw', 'maintenance', '2026-04-05'),

    -- Masan Thai Nguyen Plant (Lat: ~21.56, Lon: ~105.82)
    ('esp32_027', (SELECT id FROM company_sites WHERE site_name = 'Masan Thai Nguyen Plant'), 21.567850, 105.820150, 'w7exbn4ml', 'active', '2026-06-01')
    ON CONFLICT (sensor_id) DO NOTHING;