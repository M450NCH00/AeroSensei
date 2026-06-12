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
    -- Cluster 1: Tightly packed near Ho Chi Minh City (HCMC)
    ('esp32_004', 1, 'Saigon Hi-Tech Park R&D', 10.849600, 106.793300, 'active', '2026-06-09'),
    ('esp32_005', 2, 'District 1 HQ Roof Top', 10.776900, 106.700900, 'active', '2026-06-10'),

    -- Cluster 2: South-West Area (Mekong Delta / Industrial Zones)
    ('esp32_006', 2, 'Can Tho Factory 1', 10.045200, 105.746900, 'active', '2026-05-15'),
    ('esp32_007', 2, 'Tra Noc Chemical Plant', 10.076500, 105.733200, 'offline', '2026-05-20'),
    ('esp32_008', 3, 'My Tho Assembly Line', 10.354600, 106.365300, 'active', '2026-05-25'),

    -- Cluster 3: Central Coast Area (Da Nang / Hue / Hoi An)
    ('esp32_009', 3, 'Da Nang Logistics Hub', 16.054400, 108.202200, 'active', '2026-04-10'),
    ('esp32_010', 1, 'Hoi An Regional Office', 15.880100, 108.338000, 'maintenance', '2026-04-12'),
    ('esp32_011', 2, 'Hue Data Center', 16.463700, 107.590500, 'active', '2026-04-15'),

    -- Cluster 4: Far North Area (Hanoi / Hai Phong)
    ('esp32_012', 3, 'Hanoi Storage Alpha', 21.028500, 105.854200, 'active', '2026-03-05'),
    ('esp32_013', 1, 'Hai Phong Testing Lab', 20.844900, 106.688100, 'active', '2026-03-08'),
    ('esp32_014', 2, 'Ha Long Shipyard Mon', 20.950000, 107.083300, 'offline', '2026-03-10');
ON CONFLICT (sensor_id) DO NOTHING;

