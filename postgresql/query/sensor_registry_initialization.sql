CREATE TABLE IF NOT EXISTS sensor_registry
(
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    sensor_id VARCHAR(50) PRIMARY KEY,

    -- Links to the site
    site_id INTEGER REFERENCES company_sites(id) ON DELETE SET NULL,

    -- BRINGING THESE BACK FOR EXACT SENSOR PLACEMENT
    latitude NUMERIC(11, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,

    status VARCHAR(20) DEFAULT 'active',
    installation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert initial test data with slight coordinate offsets from the main site
INSERT INTO sensor_registry
(sensor_id, site_id, latitude, longitude, status, installation_date)
VALUES
    -- Site: Saigon Hi-Tech Park R&D (Site Center: 10.849600, 106.793300) -> Offset North-East
    ('esp32_004', (SELECT id FROM company_sites WHERE site_name = 'Saigon Hi-Tech Park R&D'), 10.849650, 106.793350, 'active', '2026-06-09'),

    -- Site: District 1 HQ Roof Top (Site Center: 10.776900, 106.700900) -> Offset South-West
    ('esp32_005', (SELECT id FROM company_sites WHERE site_name = 'District 1 HQ Roof Top'), 10.776850, 106.700850, 'active', '2026-06-10'),

    -- Site: Can Tho Factory 1 (Site Center: 10.045200, 105.746900) -> Offset North
    ('esp32_006', (SELECT id FROM company_sites WHERE site_name = 'Can Tho Factory 1'), 10.045250, 105.746900, 'active', '2026-05-15'),

    -- Site: Tra Noc Chemical Plant (Site Center: 10.076500, 105.733200) -> Offset South
    ('esp32_007', (SELECT id FROM company_sites WHERE site_name = 'Tra Noc Chemical Plant'), 10.076450, 105.733200, 'offline', '2026-05-20'),

    -- Site: My Tho Assembly Line (Site Center: 10.354600, 106.365300)
    ('esp32_008', (SELECT id FROM company_sites WHERE site_name = 'My Tho Assembly Line'), 10.354650, 106.365350, 'active', '2026-05-25'),

    -- Site: Da Nang Logistics Hub (Site Center: 16.054400, 108.202200)
    ('esp32_009', (SELECT id FROM company_sites WHERE site_name = 'Da Nang Logistics Hub'), 16.054450, 108.202250, 'active', '2026-04-10'),

    -- Site: Hoi An Regional Office (Site Center: 15.880100, 108.338000)
    ('esp32_010', (SELECT id FROM company_sites WHERE site_name = 'Hoi An Regional Office'), 15.880150, 108.338050, 'maintenance', '2026-04-12'),

    -- Site: Hue Data Center (Site Center: 16.463700, 107.590500)
    ('esp32_011', (SELECT id FROM company_sites WHERE site_name = 'Hue Data Center'), 16.463750, 107.590550, 'active', '2026-04-15'),

    -- Site: Hanoi Storage Alpha (Site Center: 21.028500, 105.854200)
    ('esp32_012', (SELECT id FROM company_sites WHERE site_name = 'Hanoi Storage Alpha'), 21.028550, 105.854250, 'active', '2026-03-05'),

    -- Site: Hai Phong Testing Lab (Site Center: 20.844900, 106.688100)
    ('esp32_013', (SELECT id FROM company_sites WHERE site_name = 'Hai Phong Testing Lab'), 20.844950, 106.688150, 'active', '2026-03-08'),

    -- Site: Ha Long Shipyard Mon (Site Center: 20.950000, 107.083300)
    ('esp32_014', (SELECT id FROM company_sites WHERE site_name = 'Ha Long Shipyard Mon'), 20.950050, 107.083350, 'offline', '2026-03-10')
    ON CONFLICT (sensor_id) DO NOTHING;