-- Create sectors table for government-defined carbon credit formulas
CREATE TABLE IF NOT EXISTS sectors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    formula TEXT,
    description TEXT
);

-- Seed sectors with GHG Protocol / IPCC Tier 1 emission formulas (tCO2e output)

-- Power Generation: fuel combustion emissions (IPCC 2006, Table 2.2)
INSERT INTO sectors (name, formula, description)
VALUES ('Power Generation',
        '{natural_gas_GJ} * 56.1 + {coal_GJ} * 94.6 + {oil_GJ} * 73.3',
        'Combustion emissions from fossil fuels used in electricity generation. Parameters in GJ. Factors: natural gas 56.1, coal 94.6, oil 73.3 kg CO2/GJ (IPCC 2006).')
ON CONFLICT (name) DO NOTHING;

-- Steel (BF-BOF route): IPCC Guidelines for National GHG Inventories, Metal Industry
INSERT INTO sectors (name, formula, description)
VALUES ('Steel',
        '{crude_steel_tonnes} * 1.85 + {electricity_kwh} * 0.000233',
        'Emissions from integrated blast furnace-basic oxygen furnace (BF-BOF) steelmaking. crude_steel_tonnes: output in tonnes (factor 1.85 tCO2/t, World Steel Association); electricity_kwh: purchased electricity (factor 0.233 kg CO2/kWh, IEA global average).')
ON CONFLICT (name) DO NOTHING;

-- Cement: process (calcination) + energy emissions (CSI Cement CO2 Protocol v2.0 / IPCC)
INSERT INTO sectors (name, formula, description)
VALUES ('Cement',
        '{clinker_tonnes} * 0.525 + {fuel_GJ} * 89.0 + {electricity_kwh} * 0.000233',
        'Emissions from cement manufacturing. clinker_tonnes: clinker produced (calcination factor 0.525 tCO2/t, IPCC Tier 1); fuel_GJ: kiln fuel consumption (average factor 89 kg CO2/GJ for coal/petcoke mix); electricity_kwh: grid electricity (0.233 kg CO2/kWh).')
ON CONFLICT (name) DO NOTHING;

-- Service / Office: Scope 1 (gas combustion) + Scope 2 (electricity) per GHG Protocol Corporate Standard
INSERT INTO sectors (name, formula, description)
VALUES ('Service',
        '{natural_gas_m3} * 1.921 + {electricity_kwh} * 0.000233 + {diesel_litres} * 2.68',
        'Office/service sector Scope 1+2 emissions. natural_gas_m3: natural gas consumed in m3 (1.921 kg CO2/m3, UK BEIS 2023); electricity_kwh: purchased electricity (0.233 kg CO2/kWh); diesel_litres: diesel for backup generators (2.68 kg CO2/litre, GHG Protocol).')
ON CONFLICT (name) DO NOTHING;
