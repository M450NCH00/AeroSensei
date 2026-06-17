CREATE TABLE IF NOT EXISTS sensor_registry
(
    -- Added UUID column that generates automatically
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    sensor_id VARCHAR(50) PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    location_name VARCHAR(100) NOT NULL,
    latitude NUMERIC(11, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    geohash VARCHAR(12) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    installation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Index the geohash column for fast prefix-based spatial queries
CREATE INDEX IF NOT EXISTS idx_sensor_geohash ON sensor_registry(geohash);

-- Insert initial test data
INSERT INTO sensor_registry
(sensor_id, company_id, location_name, latitude, longitude, geohash, status, installation_date)
VALUES
    -- Cluster 1: Tightly packed near Ho Chi Minh City (HCMC)
    ('esp32_004', 1, 'Saigon Hi-Tech Park R&D', 10.849600, 106.793300, 'w3gvwphe8', 'active', '2026-06-09'),
    ('esp32_005', 2, 'District 1 HQ Roof Top', 10.776900, 106.700900, 'w3gvk1c5z', 'active', '2026-06-10'),

    -- Cluster 2: South-West Area (Mekong Delta / Industrial Zones)
    ('esp32_006', 2, 'Can Tho Factory 1', 10.045200, 105.746900, 'w3g1nkdt9', 'active', '2026-05-15'),
    ('esp32_007', 2, 'Tra Noc Chemical Plant', 10.076500, 105.733200, 'w3g1q42ef', 'offline', '2026-05-20'),
    ('esp32_008', 3, 'My Tho Assembly Line', 10.354600, 106.365300, 'w3gdukuzg', 'active', '2026-05-25'),

    -- Cluster 3: Central Coast Area (Da Nang / Hue / Hoi An)
    ('esp32_009', 3, 'Da Nang Logistics Hub', 16.054400, 108.202200, 'w6ugq4w7w', 'active', '2026-04-10'),
    ('esp32_010', 1, 'Hoi An Regional Office', 15.880100, 108.338000, 'w6v436ck6', 'maintenance', '2026-04-12'),
    ('esp32_011', 2, 'Hue Data Center', 16.463700, 107.590500, 'w6ut8m1h0', 'active', '2026-04-15'),

    -- Cluster 4: Far North Area (Hanoi / Hai Phong)
    ('esp32_012', 3, 'Hanoi Storage Alpha', 21.028500, 105.854200, 'w7er8u0ev', 'active', '2026-03-05'),
    ('esp32_013', 1, 'Hai Phong Testing Lab', 20.844900, 106.688100, 'w7eyedxyk', 'active', '2026-03-08'),
    ('esp32_014', 2, 'Ha Long Shipyard Mon', 20.950000, 107.083300, 'w7sphtzdt', 'offline', '2026-03-10')
ON CONFLICT (sensor_id) DO NOTHING;

