CREATE TABLE IF NOT EXISTS companies
(
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name   VARCHAR(255),
    carbon_credits NUMERIC(12,2) NOT NULL DEFAULT 0,
    sector_id      INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Seed Vietnam companies linked to seeded users with their respective sectors.
-- A handful of well-known companies are intentionally seeded with sector_id = NULL
-- (unclassified) so the AI agent's web-research sector-classification skill can be
-- tested end to end: research what they do -> assign the right sector.
INSERT INTO companies (user_id, company_name, carbon_credits, sector_id)
VALUES
    ((SELECT id FROM users WHERE email = 'vingroup.company@aerosensei.vn'),                       'Vingroup Company',                            65047.58, (SELECT id FROM sectors WHERE name = 'Conglomerate')),
    ((SELECT id FROM users WHERE email = 'vinhomes@aerosensei.vn'),                               'Vinhomes',                                    54393.25, (SELECT id FROM sectors WHERE name = 'Real Estate')),
    ((SELECT id FROM users WHERE email = 'bid@aerosensei.vn'),                                    'BIDV',                                        67890.70, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'vpb@aerosensei.vn'),                                    'VPBank',                                      79003.84, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'petrovietnam.gas@aerosensei.vn'),                       'Petrovietnam Gas',                            65797.02, (SELECT id FROM sectors WHERE name = 'Energy')),
    ((SELECT id FROM users WHERE email = 'hoa.phat.group@aerosensei.vn'),                         'Hoa Phat Group',                              24964.22, NULL), -- unclassified: test AI sector classification
    ((SELECT id FROM users WHERE email = 'vinfast.auto@aerosensei.vn'),                           'VinFast Auto',                                26882.56, NULL), -- unclassified: test AI sector classification
    ((SELECT id FROM users WHERE email = 'asia.commercial.joint.stock.bank@aerosensei.vn'),       'Asia Commercial Joint Stock Bank',            25677.28, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'saigon.thuong.tin.commercial.bank@aerosensei.vn'),      'Saigon Thuong Tin Commercial Bank',           48242.98, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'hdb@aerosensei.vn'),                                    'HD Bank',                                     30893.53, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'fpt.corporation@aerosensei.vn'),                        'FPT Corporation',                             34451.04, NULL), -- unclassified: test AI sector classification
    ((SELECT id FROM users WHERE email = 'vinamilk.vietnam.dairy.products@aerosensei.vn'),        'Vinamilk',                                    36127.21, NULL), -- unclassified: test AI sector classification
    ((SELECT id FROM users WHERE email = 'vietjet.aviation@aerosensei.vn'),                       'VietJet Aviation',                            24559.48, NULL), -- unclassified: test AI sector classification
    ((SELECT id FROM users WHERE email = 'masan.group@aerosensei.vn'),                            'Masan Group',                                 49821.67, (SELECT id FROM sectors WHERE name = 'Consumer Staples')),
    ((SELECT id FROM users WHERE email = 'vietnam.airlines@aerosensei.vn'),                       'Vietnam Airlines',                            22674.91, (SELECT id FROM sectors WHERE name = 'Transportation')),
    ((SELECT id FROM users WHERE email = 'ssi.securities.corporation@aerosensei.vn'),             'SSI Securities Corporation',                  46204.57, (SELECT id FROM sectors WHERE name = 'Financial Services')),
    ((SELECT id FROM users WHERE email = 'vincom.retail.joint.stock.company@aerosensei.vn'),      'Vincom Retail',                               20043.00, (SELECT id FROM sectors WHERE name = 'Real Estate')),
    ((SELECT id FROM users WHERE email = 'shb@aerosensei.vn'),                                    'SHB',                                         49608.14, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'sabeco.brewery.saigon.beer@aerosensei.vn'),             'Sabeco Brewery',                              28969.13, (SELECT id FROM sectors WHERE name = 'Consumer Staples')),
    ((SELECT id FROM users WHERE email = 'vib@aerosensei.vn'),                                    'VIB',                                         26711.23, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'bcm@aerosensei.vn'),                                    'Becamex',                                     33029.41, (SELECT id FROM sectors WHERE name = 'Industrials')),
    ((SELECT id FROM users WHERE email = 'vietnam.national.petroleum.group@aerosensei.vn'),       'Vietnam National Petroleum Group',            36191.22, (SELECT id FROM sectors WHERE name = 'Energy')),
    ((SELECT id FROM users WHERE email = 'ssb@aerosensei.vn'),                                    'SeABank',                                     23129.89, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'bao.viet.holdings@aerosensei.vn'),                      'Bao Viet Holdings',                           35217.72, (SELECT id FROM sectors WHERE name = 'Insurance')),
    ((SELECT id FROM users WHERE email = 'msb@aerosensei.vn'),                                    'Vietnam Maritime Commercial Joint Stock Bank', 26275.67, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'tpb@aerosensei.vn'),                                    'TPBank',                                      24339.91, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'petrovietnam.power@aerosensei.vn'),                     'PetroVietnam Power',                          23469.74, (SELECT id FROM sectors WHERE name = 'Energy')),
    ((SELECT id FROM users WHERE email = 'gelex.group.joint.stock.company@aerosensei.vn'),        'GELEX Group',                                 17828.18, (SELECT id FROM sectors WHERE name = 'Industrials')),
    ((SELECT id FROM users WHERE email = 'eib@aerosensei.vn'),                                    'Eximbank',                                    11965.23, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'ocb.orient.commercial.joint.stock.bank@aerosensei.vn'), 'OCB',                                         15175.42, (SELECT id FROM sectors WHERE name = 'Banking')),
    ((SELECT id FROM users WHERE email = 'phu.nhuan.jewelry.pnj@aerosensei.vn'),                  'Phu Nhuan Jewelry',                           12987.65, (SELECT id FROM sectors WHERE name = 'Retail')),
    ((SELECT id FROM users WHERE email = 'ree@aerosensei.vn'),                                    'REE Corporation',                             18078.55, (SELECT id FROM sectors WHERE name = 'Industrials')),
    ((SELECT id FROM users WHERE email = 'hcm@aerosensei.vn'),                                    'HSC Securities',                               6255.03, (SELECT id FROM sectors WHERE name = 'Financial Services')),
    ((SELECT id FROM users WHERE email = 'vietcap.securities@aerosensei.vn'),                     'Vietcap Securities',                          15638.36, (SELECT id FROM sectors WHERE name = 'Financial Services')),
    ((SELECT id FROM users WHERE email = 'kdh@aerosensei.vn'),                                    'KDH',                                          7004.80, (SELECT id FROM sectors WHERE name = 'Real Estate')),
    ((SELECT id FROM users WHERE email = 'duc.giang.chemicals.group@aerosensei.vn'),              'Duc Giang Chemicals Group',                   11006.12, (SELECT id FROM sectors WHERE name = 'Materials')),
    ((SELECT id FROM users WHERE email = 'vinh.hoan.corporation@aerosensei.vn'),                  'Vinh Hoan Corporation',                        9346.93, (SELECT id FROM sectors WHERE name = 'Consumer Staples')),
    -- Government regulator: owns the public/ambient air-quality monitoring stations
    -- (non-industrial sites). Linked to the seeded Government user.
    ((SELECT id FROM users WHERE email = 'government@example.com'),                               'Government Environmental Agency',                  0.00, NULL)
ON CONFLICT DO NOTHING;
