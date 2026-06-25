CREATE TABLE IF NOT EXISTS company_sites
(
    id             SERIAL PRIMARY KEY,
    company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    site_name      VARCHAR(100) NOT NULL,
    pm2_5_value    NUMERIC(10, 2) NOT NULL,
    pm10_value     NUMERIC(10, 2) NOT NULL,
    latitude       NUMERIC(11, 8) NOT NULL,
    longitude      NUMERIC(11, 8) NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, site_name) -- Prevents duplicate sites for the same company
    );

-- Seed the initial sites with their respective map coordinates
INSERT INTO company_sites (company_id, site_name, pm2_5_value, pm10_value, latitude, longitude)
VALUES
    -- VPBank (Banking)
    ((SELECT id FROM companies WHERE company_name = 'VPBank'), 'VPBank Tower Hanoi',0, 0,  21.016300, 105.814300),
    ((SELECT id FROM companies WHERE company_name = 'VPBank'), 'VPBank Saigon Branch', 0, 0, 10.772500, 106.700100),

    -- Petrovietnam Gas (Energy)
    ((SELECT id FROM companies WHERE company_name = 'Petrovietnam Gas'), 'Dinh Co Gas Plant',0, 0, 10.395100, 107.169100),
    ((SELECT id FROM companies WHERE company_name = 'Petrovietnam Gas'), 'Ca Mau Gas Plant', 0, 0, 9.123400, 104.987600),

    -- Hoa Phat Group (Materials)
    ((SELECT id FROM companies WHERE company_name = 'Hoa Phat Group'), 'Dung Quat Steel Complex', 0, 0,15.394200, 108.790100),
    ((SELECT id FROM companies WHERE company_name = 'Hoa Phat Group'), 'Hai Duong Iron Complex', 0, 0,20.971200, 106.463300),

    -- VinFast Auto (Automotive)
    ((SELECT id FROM companies WHERE company_name = 'VinFast Auto'), 'Hai Phong Manufacturing Plant',0, 0, 20.820500, 106.840200),

    -- FPT Corporation (Technology)
    ((SELECT id FROM companies WHERE company_name = 'FPT Corporation'), 'FPT Tower Cau Giay', 0, 0,21.031500, 105.783100),
    ((SELECT id FROM companies WHERE company_name = 'FPT Corporation'), 'FPT Complex Da Nang', 0, 0,15.976500, 108.256100),

    -- Vinamilk (Consumer Staples)
    ((SELECT id FROM companies WHERE company_name = 'Vinamilk'), 'Vietnam Mega Factory', 0, 0,11.050500, 106.666100),

    -- VietJet Aviation (Transportation)
    ((SELECT id FROM companies WHERE company_name = 'VietJet Aviation'), 'Noi Bai Hangar 1', 0, 0,21.218700, 105.804200),

    -- Masan Group (Consumer Staples)
    ((SELECT id FROM companies WHERE company_name = 'Masan Group'), 'Masan Thai Nguyen Plant', 0, 0,21.567800, 105.820100)
ON CONFLICT (company_id, site_name) DO NOTHING;