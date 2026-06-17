CREATE TABLE IF NOT EXISTS company_sites
(
    id             SERIAL PRIMARY KEY,
    company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    site_name      VARCHAR(100) NOT NULL,
    latitude       NUMERIC(11, 8) NOT NULL,
    longitude      NUMERIC(11, 8) NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, site_name) -- Prevents duplicate sites for the same company
    );

-- Seed the initial sites with their respective map coordinates
INSERT INTO company_sites (company_id, site_name, latitude, longitude)
VALUES
    (1, 'Saigon Hi-Tech Park R&D', 10.849600, 106.793300),
    (1, 'Hoi An Regional Office', 15.880100, 108.338000),
    (1, 'Hai Phong Testing Lab', 20.844900, 106.688100),
    (2, 'District 1 HQ Roof Top', 10.776900, 106.700900),
    (2, 'Can Tho Factory 1', 10.045200, 105.746900),
    (2, 'Tra Noc Chemical Plant', 10.076500, 105.733200),
    (2, 'Hue Data Center', 16.463700, 107.590500),
    (2, 'Ha Long Shipyard Mon', 20.950000, 107.083300),
    (3, 'My Tho Assembly Line', 10.354600, 106.365300),
    (3, 'Da Nang Logistics Hub', 16.054400, 108.202200),
    (3, 'Hanoi Storage Alpha', 21.028500, 105.854200)
    ON CONFLICT (company_id, site_name) DO NOTHING;