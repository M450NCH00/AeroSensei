-- Create sectors table for government-defined carbon credit formulas
CREATE TABLE IF NOT EXISTS sectors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    formula TEXT,            -- emissions formula (tCO2e)
    activity_formula TEXT,   -- activity-level / output formula (intensity denominator)
    description TEXT
);

-- Seed sectors with GHG Protocol / IPCC Tier 1 emission formulas (tCO2e output)
-- plus an activity-level (output) formula used as the denominator of intensity.

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Banking',
 '{electricity_kwh} * 0.000233 + {natural_gas_m3} * 1.921 + {diesel_litres} * 2.68',
 '{revenue_million}',
 'Scope 1+2 emissions for commercial banks. electricity_kwh: office & data centre grid electricity (0.233 kg CO2/kWh, IEA); natural_gas_m3: building heating (1.921 kg CO2/m3, BEIS 2023); diesel_litres: backup generators (2.68 kg CO2/litre, GHG Protocol). Activity = operating revenue (USD million).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Energy',
 '{gas_produced_GJ} * 56.1 + {flaring_GJ} * 56.1 + {electricity_kwh} * 0.000233',
 '{gas_produced_GJ}',
 'Upstream oil & gas emissions. gas_produced_GJ: natural gas combustion (56.1 kg CO2/GJ, IPCC 2006); flaring_GJ: associated gas flaring (56.1 kg CO2/GJ); electricity_kwh: facility electricity use (0.233 kg CO2/kWh). Activity = energy produced (GJ).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Materials',
 '{crude_steel_tonnes} * 1.85 + {electricity_kwh} * 0.000233 + {coal_GJ} * 94.6',
 '{crude_steel_tonnes}',
 'Emissions from steel and metals production. crude_steel_tonnes: BF-BOF route output (1.85 tCO2/t, World Steel Association); electricity_kwh: purchased electricity (0.233 kg CO2/kWh); coal_GJ: coking coal combustion (94.6 kg CO2/GJ, IPCC 2006). Activity = crude steel produced (tonnes).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Automotive',
 '{vehicles_produced} * 2.1 + {electricity_kwh} * 0.000233 + {natural_gas_GJ} * 56.1',
 '{vehicles_produced}',
 'Vehicle manufacturing emissions. vehicles_produced: estimated process emissions per unit (2.1 tCO2e/vehicle, ICCT); electricity_kwh: assembly plant grid electricity (0.233 kg CO2/kWh); natural_gas_GJ: paint shop & heating (56.1 kg CO2/GJ). Activity = vehicles produced (units).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Technology',
 '{electricity_kwh} * 0.000233 + {natural_gas_m3} * 1.921 + {diesel_litres} * 2.68',
 '{revenue_million}',
 'IT and software sector Scope 1+2 emissions. electricity_kwh: offices and data centres (0.233 kg CO2/kWh, IEA); natural_gas_m3: building heating (1.921 kg CO2/m3); diesel_litres: generator fuel (2.68 kg CO2/litre). Activity = operating revenue (USD million).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Consumer Staples',
 '{production_tonnes} * 0.45 + {electricity_kwh} * 0.000233 + {fuel_GJ} * 73.3',
 '{production_tonnes}',
 'Food, beverage and household products. production_tonnes: process emissions from manufacturing (0.45 tCO2e/t, GHG Protocol Food & Beverage); electricity_kwh: processing plant electricity (0.233 kg CO2/kWh); fuel_GJ: boiler & process heat, oil-based (73.3 kg CO2/GJ, IPCC). Activity = goods produced (tonnes).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Transportation',
 '{fuel_tonnes} * 3.16 + {electricity_kwh} * 0.000233 + {diesel_litres} * 2.68',
 '{revenue_tonne_km_million}',
 'Aviation and ground transport emissions. fuel_tonnes: jet fuel combustion (3.16 tCO2/t, IPCC 2006 aviation factor); electricity_kwh: ground operations electricity (0.233 kg CO2/kWh); diesel_litres: ground vehicles and equipment (2.68 kg CO2/litre). Activity = transport work (million revenue tonne-km).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Financial Services',
 '{electricity_kwh} * 0.000233 + {natural_gas_m3} * 1.921 + {diesel_litres} * 2.68',
 '{revenue_million}',
 'Securities, asset management and brokerage. electricity_kwh: office and trading floor electricity (0.233 kg CO2/kWh); natural_gas_m3: building heating (1.921 kg CO2/m3); diesel_litres: backup generator diesel (2.68 kg CO2/litre). Activity = operating revenue (USD million).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Real Estate',
 '{floor_area_m2} * 0.042 + {electricity_kwh} * 0.000233 + {cement_tonnes} * 0.525',
 '{floor_area_m2}',
 'Property development and management. floor_area_m2: embodied carbon in construction (0.042 tCO2/m2, RICS 2017 benchmark); electricity_kwh: common area and facility electricity (0.233 kg CO2/kWh); cement_tonnes: clinker calcination in construction (0.525 tCO2/t, IPCC). Activity = floor area developed/managed (m2).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Retail',
 '{electricity_kwh} * 0.000233 + {natural_gas_m3} * 1.921 + {fleet_km} * 0.000089',
 '{revenue_million}',
 'Retail stores and distribution. electricity_kwh: store lighting, cooling and POS systems (0.233 kg CO2/kWh); natural_gas_m3: store heating (1.921 kg CO2/m3); fleet_km: delivery vehicle kilometres driven (0.089 kg CO2/km, GHG Protocol freight factor). Activity = retail sales revenue (USD million).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Industrials',
 '{production_units} * 0.85 + {electricity_kwh} * 0.000233 + {fuel_GJ} * 73.3',
 '{production_units}',
 'General industrial manufacturing and engineering. production_units: process emissions per output unit (0.85 tCO2e/unit, generic GHG Protocol manufacturing); electricity_kwh: factory electricity (0.233 kg CO2/kWh); fuel_GJ: furnace and process heat, fuel oil (73.3 kg CO2/GJ, IPCC). Activity = output (production units).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Insurance',
 '{electricity_kwh} * 0.000233 + {natural_gas_m3} * 1.921 + {diesel_litres} * 2.68',
 '{gross_premiums_million}',
 'Insurance and reinsurance companies. electricity_kwh: office electricity (0.233 kg CO2/kWh); natural_gas_m3: building heating (1.921 kg CO2/m3); diesel_litres: generator and company vehicle fuel (2.68 kg CO2/litre). Activity = gross written premiums (USD million).')

ON CONFLICT (name) DO NOTHING;

INSERT INTO sectors (name, formula, activity_formula, description) VALUES

('Conglomerate',
 '{electricity_kwh} * 0.000233 + {fuel_GJ} * 73.3 + {natural_gas_m3} * 1.921',
 '{revenue_million}',
 'Diversified conglomerates with mixed operations. electricity_kwh: aggregate electricity across business units (0.233 kg CO2/kWh); fuel_GJ: oil-based process and transport fuel (73.3 kg CO2/GJ, IPCC); natural_gas_m3: building and process gas (1.921 kg CO2/m3). Activity = aggregate revenue (USD million).')

ON CONFLICT (name) DO NOTHING;
