-- Auto-generated seed: Vietnam largest companies
-- Source: https://companiesmarketcap.com/sgd/vietnam/largest-companies-in-vietnam-by-market-cap/

BEGIN;

-- Vingroup Company (VIC.VN)  market-cap S$71,702,942,144
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vingroup.company@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vingroup Company', 'Conglomerate', 'enterprise', 65047.58
FROM new_user
ON CONFLICT DO NOTHING;

-- Vinhomes (VHM.VN)  market-cap S$27,864,201,840
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vinhomes@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vinhomes', 'Real Estate', 'enterprise', 54393.25
FROM new_user
ON CONFLICT DO NOTHING;

-- BIDV  (Commercial Bank for Investment and Development of Vietnam) (BID.VN)  market-cap S$14,616,733,515
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('bid@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'BIDV  (Commercial Bank for Investment and Development of Vietnam)', 'Banking', 'enterprise', 67890.7
FROM new_user
ON CONFLICT DO NOTHING;

-- VPBank (Vietnam Prosperity Joint Stock Commercial Bank) (VPB.VN)  market-cap S$10,089,352,394
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vpb@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'VPBank (Vietnam Prosperity Joint Stock Commercial Bank)', 'Banking', 'enterprise', 79003.84
FROM new_user
ON CONFLICT DO NOTHING;

-- Petrovietnam Gas (GAS.VN)  market-cap S$10,043,376,025
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('petrovietnam.gas@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Petrovietnam Gas', 'Energy', 'enterprise', 65797.02
FROM new_user
ON CONFLICT DO NOTHING;

-- Hoa Phat Group (HPG.VN)  market-cap S$9,580,480,999
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('hoa.phat.group@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Hoa Phat Group', 'Materials', 'large', 24964.22
FROM new_user
ON CONFLICT DO NOTHING;

-- VinFast Auto (VFS)  market-cap S$9,461,751,380
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vinfast.auto@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'VinFast Auto', 'Automotive', 'large', 26882.56
FROM new_user
ON CONFLICT DO NOTHING;

-- Asia Commercial Joint Stock Bank (ACB.VN)  market-cap S$6,657,762,451
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('asia.commercial.joint.stock.bank@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Asia Commercial Joint Stock Bank', 'Banking', 'large', 25677.28
FROM new_user
ON CONFLICT DO NOTHING;

-- Saigon Thuong Tin Commercial Bank (STB.VN)  market-cap S$6,537,462,312
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('saigon.thuong.tin.commercial.bank@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Saigon Thuong Tin Commercial Bank', 'Banking', 'large', 48242.98
FROM new_user
ON CONFLICT DO NOTHING;

-- HD Bank (Ho Chi Minh City Development Joint Stock Commercial Bank) (HDB.VN)  market-cap S$6,169,223,019
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('hdb@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'HD Bank (Ho Chi Minh City Development Joint Stock Commercial Bank)', 'Banking', 'large', 30893.53
FROM new_user
ON CONFLICT DO NOTHING;

-- FPT Corporation (FPT.VN)  market-cap S$6,123,971,634
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('fpt.corporation@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'FPT Corporation', 'Technology', 'large', 34451.04
FROM new_user
ON CONFLICT DO NOTHING;

-- Vinamilk (Vietnam Dairy Products) (VNM.VN)  market-cap S$6,031,022,300
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vinamilk.vietnam.dairy.products@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vinamilk (Vietnam Dairy Products)', 'Consumer Staples', 'large', 36127.21
FROM new_user
ON CONFLICT DO NOTHING;

-- VietJet Aviation (VJC.VN)  market-cap S$5,231,627,260
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vietjet.aviation@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'VietJet Aviation', 'Transportation', 'large', 24559.48
FROM new_user
ON CONFLICT DO NOTHING;

-- Masan Group (MSN.VN)  market-cap S$5,028,221,894
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('masan.group@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Masan Group', 'Consumer Staples', 'large', 49821.67
FROM new_user
ON CONFLICT DO NOTHING;

-- Vietnam Airlines (HVN.VN)  market-cap S$3,218,709,935
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vietnam.airlines@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vietnam Airlines', 'Transportation', 'large', 22674.91
FROM new_user
ON CONFLICT DO NOTHING;

-- SSI Securities Corporation (SSI.VN)  market-cap S$3,186,136,536
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('ssi.securities.corporation@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'SSI Securities Corporation', 'Financial Services', 'large', 46204.57
FROM new_user
ON CONFLICT DO NOTHING;

-- Vincom Retail Joint Stock Company (VRE.VN)  market-cap S$3,178,609,136
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vincom.retail.joint.stock.company@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vincom Retail Joint Stock Company', 'Retail', 'large', 20043.0
FROM new_user
ON CONFLICT DO NOTHING;

-- SHB (Saigon - Hanoi Commercial Joint Stock Bank) (SHB.VN)  market-cap S$3,151,519,685
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('shb@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'SHB (Saigon - Hanoi Commercial Joint Stock Bank)', 'Banking', 'large', 49608.14
FROM new_user
ON CONFLICT DO NOTHING;

-- Sabeco Brewery (Saigon Beer) (SAB.VN)  market-cap S$3,048,713,935
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('sabeco.brewery.saigon.beer@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Sabeco Brewery (Saigon Beer)', 'Consumer Staples', 'large', 28969.13
FROM new_user
ON CONFLICT DO NOTHING;

-- VIB (Vietnam International Commercial Joint Stock Bank) (VIB.VN)  market-cap S$2,688,838,420
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vib@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'VIB (Vietnam International Commercial Joint Stock Bank)', 'Banking', 'large', 26711.23
FROM new_user
ON CONFLICT DO NOTHING;

-- Becamex (Investment and Industrial Development Corporation) (BCM.VN)  market-cap S$2,662,735,309
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('bcm@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Becamex (Investment and Industrial Development Corporation)', 'Industrials', 'large', 33029.41
FROM new_user
ON CONFLICT DO NOTHING;

-- Vietnam National Petroleum Group (PLX.VN)  market-cap S$2,488,918,270
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vietnam.national.petroleum.group@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vietnam National Petroleum Group', 'Energy', 'large', 36191.22
FROM new_user
ON CONFLICT DO NOTHING;

-- SeABank (Southeast Asia Commercial Joint Stock Bank) (SSB.VN)  market-cap S$2,440,096,535
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('ssb@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'SeABank (Southeast Asia Commercial Joint Stock Bank)', 'Banking', 'large', 23129.89
FROM new_user
ON CONFLICT DO NOTHING;

-- Bao Viet Holdings (BVH.VN)  market-cap S$2,381,762,823
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('bao.viet.holdings@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Bao Viet Holdings', 'Insurance', 'large', 35217.72
FROM new_user
ON CONFLICT DO NOTHING;

-- Vietnam Maritime Commercial Joint Stock Bank (MSB.VN)  market-cap S$2,289,010,427
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('msb@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vietnam Maritime Commercial Joint Stock Bank', 'Banking', 'large', 26275.67
FROM new_user
ON CONFLICT DO NOTHING;

-- TPBank (Tien Phong Commercial Joint Stock Bank) (TPB.VN)  market-cap S$2,218,372,915
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('tpb@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'TPBank (Tien Phong Commercial Joint Stock Bank)', 'Banking', 'large', 24339.91
FROM new_user
ON CONFLICT DO NOTHING;

-- PetroVietnam Power (POW.VN)  market-cap S$2,025,672,241
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('petrovietnam.power@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'PetroVietnam Power', 'Energy', 'large', 23469.74
FROM new_user
ON CONFLICT DO NOTHING;

-- GELEX Group Joint Stock Company (GEX.VN)  market-cap S$1,953,051,791
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('gelex.group.joint.stock.company@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'GELEX Group Joint Stock Company', 'Industrials', 'medium', 17828.18
FROM new_user
ON CONFLICT DO NOTHING;

-- Eximbank (Vietnam Export Import Commercial Joint Stock Bank) (EIB.VN)  market-cap S$1,885,905,647
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('eib@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Eximbank (Vietnam Export Import Commercial Joint Stock Bank)', 'Banking', 'medium', 11965.23
FROM new_user
ON CONFLICT DO NOTHING;

-- OCB (Orient Commercial Joint Stock Bank) (OCB.VN)  market-cap S$1,621,626,869
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('ocb.orient.commercial.joint.stock.bank@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'OCB (Orient Commercial Joint Stock Bank)', 'Banking', 'medium', 15175.42
FROM new_user
ON CONFLICT DO NOTHING;

-- Phu Nhuan Jewelry (PNJ) (PNJ.VN)  market-cap S$1,551,776,189
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('phu.nhuan.jewelry.pnj@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Phu Nhuan Jewelry (PNJ)', 'Retail', 'medium', 12987.65
FROM new_user
ON CONFLICT DO NOTHING;

-- REE (Refrigeration Electrical Engineering Corporation) (REE.VN)  market-cap S$1,535,520,263
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('ree@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'REE (Refrigeration Electrical Engineering Corporation)', 'Industrials', 'medium', 18078.55
FROM new_user
ON CONFLICT DO NOTHING;

-- HSC (Ho Chi Minh City Securities Corporation) (HCM.VN)  market-cap S$1,426,172,221
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('hcm@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'HSC (Ho Chi Minh City Securities Corporation)', 'Financial Services', 'medium', 6255.03
FROM new_user
ON CONFLICT DO NOTHING;

-- Vietcap Securities (VCI.VN)  market-cap S$1,324,700,429
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vietcap.securities@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vietcap Securities', 'Financial Services', 'medium', 15638.36
FROM new_user
ON CONFLICT DO NOTHING;

-- KDH (Khang Dien House Trading and Investment) (KDH.VN)  market-cap S$1,267,914,332
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('kdh@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'KDH (Khang Dien House Trading and Investment)', 'Real Estate', 'medium', 7004.8
FROM new_user
ON CONFLICT DO NOTHING;

-- Duc Giang Chemicals Group (DGC.VN)  market-cap S$849,812,756
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('duc.giang.chemicals.group@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Duc Giang Chemicals Group', 'Consumer Staples', 'medium', 11006.12
FROM new_user
ON CONFLICT DO NOTHING;

-- Vinh Hoan Corporation (VHC.VN)  market-cap S$626,850,109
WITH new_user AS (
  INSERT INTO users (email, password_hash, role)
  VALUES ('vinh.hoan.corporation@aerosensei.vn', '$2b$10$PzfNVIJCRcOOkDvf.L73ceKp/5ZRBnRml4PJmJZBURec.64Ubr/qO', 'Company')
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id
)
INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
SELECT id, 'Vinh Hoan Corporation', 'Consumer Staples', 'medium', 9346.93
FROM new_user
ON CONFLICT DO NOTHING;

COMMIT;