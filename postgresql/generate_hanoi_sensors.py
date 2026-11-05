"""Generate the Hanoi mock-sensor seed data.

Produces two SQL files consumed by docker-compose's postgres init:
  - query/company_site_initialization.sql   (Hanoi sites: industrial + ambient)
  - query/sensor_registry_initialization.sql (sensors, 3-5 per site)

Layout requested:
  * 70 sites, Hanoi only, each with 3-5 sensors (~210-350 sensors total).
  * Most sites cluster around real Hanoi industrial parks (khu cong nghiep) and
    are owned by the industrial company operating there.
  * The remaining (non-industrial) sites are ambient monitoring stations spread
    evenly across Hanoi and owned by the Government Environmental Agency
    (see company_registry_initialization.sql).

Deterministic: a fixed RNG seed means re-running yields the same data, so the
generated SQL is stable in git. Re-run after editing the config below:

    python postgresql/generate_hanoi_sensors.py

Industrial-park coordinates are approximate real locations of Hanoi's major
industrial zones.
"""
import math
import random
from datetime import date, timedelta
from pathlib import Path

RNG = random.Random(20260702)  # fixed seed -> reproducible output

TOTAL_SITES = 70
INDUSTRIAL_SITE_COUNT = 46          # most sites are industrial
GOV_SITE_COUNT = TOTAL_SITES - INDUSTRIAL_SITE_COUNT  # 24 ambient/government
SENSORS_PER_SITE = (3, 5)           # inclusive range, per site

GOV_COMPANY = "Government Environmental Agency"

# --- Real Hanoi industrial parks (name, owning company, lat, lon, weight) ---
# weight biases how many *sites* land in each park (bigger zone -> more sites).
INDUSTRIAL_ZONES = [
    ("Thang Long Industrial Park",             "Hoa Phat Group",            21.19200, 105.82900, 1.4),
    ("Bac Thang Long Industrial Park",         "GELEX Group",               21.18750, 105.80150, 1.2),
    ("Noi Bai Industrial Park",                "VinFast Auto",              21.22500, 105.79300, 1.1),
    ("Quang Minh Industrial Park",             "Becamex",                   21.18100, 105.73000, 1.0),
    ("Sai Dong B Industrial Park",             "REE Corporation",           21.04300, 105.90600, 1.0),
    ("HANEL Sai Dong A Industrial Park",       "FPT Corporation",           21.03300, 105.89900, 0.9),
    ("Vinh Tuy - Minh Khai Industrial Cluster","Sabeco Brewery",            20.99700, 105.87200, 0.8),
    ("Ngoc Hoi Industrial Cluster",            "Duc Giang Chemicals Group", 20.92000, 105.84500, 0.9),
    ("Phu Nghia Industrial Park",              "Masan Group",               20.89800, 105.66000, 0.8),
    ("Thach That - Quoc Oai Industrial Park",  "Vinamilk",                  21.01800, 105.56000, 0.8),
    ("Cau Dien - Tu Liem Industrial Cluster",  "Vingroup Company",          21.05000, 105.75500, 0.9),
    ("Mai Dinh Industrial Park",               "PetroVietnam Power",        21.24000, 105.83000, 0.8),
]

# District anchors — used only to give government ambient stations readable names.
DISTRICT_ANCHORS = [
    ("Ba Dinh",     21.03500, 105.81400),
    ("Hoan Kiem",   21.02850, 105.85200),
    ("Dong Da",     21.01800, 105.82900),
    ("Cau Giay",    21.03600, 105.79000),
    ("Tay Ho",      21.07000, 105.82000),
    ("Ha Dong",     20.97100, 105.77900),
    ("Hoang Mai",   20.97200, 105.85000),
    ("Long Bien",   21.05000, 105.89000),
    ("Bac Tu Liem", 21.07500, 105.77000),
]

# Hanoi bounding box — the border every sensor must fall within. Governs the
# evenly-spread government ambient sites AND filters out any industrial park
# whose center lies outside it (so no sensor lands beyond the border).
LAT_MIN, LAT_MAX = 20.883, 21.383   # N–S extent of Hanoi + margin
LON_MIN, LON_MAX = 105.733, 106.033  # W–E

# --- Geohash (base32) encoder, precision 9 to match the backend ---
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def geohash_encode(lat, lon, precision=9):
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True
    while len(geohash) < precision:
        if even:
            mid = (lon_range[0] + lon_range[1]) / 2
            if lon > mid:
                ch |= bits[bit]
                lon_range[0] = mid
            else:
                lon_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat > mid:
                ch |= bits[bit]
                lat_range[0] = mid
            else:
                lat_range[1] = mid
        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(_BASE32[ch])
            bit = 0
            ch = 0
    return "".join(geohash)


def jitter_km(lat, lon, sigma_km):
    """Offset a coordinate by a 2-D Gaussian with the given std-dev in km."""
    d_north = RNG.gauss(0, sigma_km)
    d_east = RNG.gauss(0, sigma_km)
    dlat = d_north / 111.0
    dlon = d_east / (111.0 * math.cos(math.radians(lat)))
    return lat + dlat, lon + dlon


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def random_status():
    r = RNG.random()
    if r < 0.92:
        return "active"
    if r < 0.97:
        return "maintenance"
    return "offline"


def random_install_date():
    start = date(2024, 1, 1)
    return (start + timedelta(days=RNG.randint(0, 900))).isoformat()


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def build_sites():
    """Return a list of dicts: {name, company, lat, lon}."""
    sites = []

    # Keep only industrial parks whose center is within the Hanoi border, so no
    # industrial sensor lands outside it.
    zones = [z for z in INDUSTRIAL_ZONES
             if LAT_MIN <= z[2] <= LAT_MAX and LON_MIN <= z[3] <= LON_MAX]
    dropped = [z[0] for z in INDUSTRIAL_ZONES if z not in zones]
    if dropped:
        print("Excluded industrial parks outside the Hanoi border: " + ", ".join(dropped))

    # Industrial sites: distribute across parks by weight, jitter ~0.8 km so
    # multiple sites in the same park are distinct locations within the zone.
    weights = [z[4] for z in zones]
    wsum = sum(weights)
    counts = [int(round(INDUSTRIAL_SITE_COUNT * w / wsum)) for w in weights]
    while sum(counts) < INDUSTRIAL_SITE_COUNT:
        counts[counts.index(min(counts))] += 1
    while sum(counts) > INDUSTRIAL_SITE_COUNT:
        counts[counts.index(max(counts))] -= 1

    for (park, company, lat, lon, _w), count in zip(zones, counts):
        for k in range(1, count + 1):
            slat, slon = jitter_km(lat, lon, sigma_km=0.8)
            sites.append({
                "name": f"{park} - Lot {k}",
                "company": company,
                "lat": slat,
                "lon": slon,
            })

    # Government ambient sites: spread evenly across Hanoi using a grid (+jitter),
    # owned by the government regulator, named after the nearest district.
    cols = math.ceil(math.sqrt(GOV_SITE_COUNT * (LON_MAX - LON_MIN) / (LAT_MAX - LAT_MIN)))
    rows = math.ceil(GOV_SITE_COUNT / cols)
    placed = 0
    district_seq = {}
    for r in range(rows):
        for c in range(cols):
            if placed >= GOV_SITE_COUNT:
                break
            # cell center + jitter, so coverage is even but not a rigid grid
            lat = LAT_MIN + (r + 0.5) * (LAT_MAX - LAT_MIN) / rows
            lon = LON_MIN + (c + 0.5) * (LON_MAX - LON_MIN) / cols
            lat, lon = jitter_km(lat, lon, sigma_km=1.0)
            district = min(DISTRICT_ANCHORS, key=lambda d: haversine_km(lat, lon, d[1], d[2]))[0]
            district_seq[district] = district_seq.get(district, 0) + 1
            sites.append({
                "name": f"Hanoi Ambient Station - {district} {district_seq[district]}",
                "company": GOV_COMPANY,
                "lat": lat,
                "lon": lon,
            })
            placed += 1

    return sites


def main():
    out_dir = Path(__file__).parent / "query"
    sites = build_sites()

    # ---- company_sites ----
    site_lines = []
    for s in sites:
        site_lines.append(
            f"    ((SELECT id FROM companies WHERE company_name = {sql_str(s['company'])}), "
            f"{sql_str(s['name'])}, 0, 0, {s['lat']:.6f}, {s['lon']:.6f})"
        )

    n_gov = sum(1 for s in sites if s["company"] == GOV_COMPANY)
    n_ind = len(sites) - n_gov

    sites_sql = (
        "CREATE TABLE IF NOT EXISTS company_sites\n"
        "(\n"
        "    id             SERIAL PRIMARY KEY,\n"
        "    company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,\n"
        "    site_name      VARCHAR(100) NOT NULL,\n"
        "    pm2_5_value    NUMERIC(10, 2) NOT NULL,\n"
        "    pm10_value     NUMERIC(10, 2) NOT NULL,\n"
        "    latitude       NUMERIC(11, 8) NOT NULL,\n"
        "    longitude      NUMERIC(11, 8) NOT NULL,\n"
        "    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n"
        "    UNIQUE (company_id, site_name)\n"
        "    );\n\n"
        "-- AUTO-GENERATED by postgresql/generate_hanoi_sensors.py — do not edit by hand.\n"
        f"-- {len(sites)} Hanoi sites: {n_ind} industrial (company-owned) + "
        f"{n_gov} ambient (Government-owned).\n"
        "INSERT INTO company_sites (company_id, site_name, pm2_5_value, pm10_value, latitude, longitude)\n"
        "VALUES\n"
        + ",\n".join(site_lines)
        + "\nON CONFLICT (company_id, site_name) DO NOTHING;\n"
    )
    (out_dir / "company_site_initialization.sql").write_text(sites_sql)

    # ---- sensors: 3-5 tightly co-located sensors per site ----
    sensor_rows = []  # (sensor_id, site_name, lat, lon, geohash, status, install_date)
    idx = 1
    for s in sites:
        for _ in range(RNG.randint(*SENSORS_PER_SITE)):
            slat, slon = jitter_km(s["lat"], s["lon"], sigma_km=0.15)  # co-located ~150 m
            # Clamp to the border so edge jitter never places a sensor outside Hanoi.
            slat = min(max(slat, LAT_MIN), LAT_MAX)
            slon = min(max(slon, LON_MIN), LON_MAX)
            sensor_rows.append((
                f"hn_{idx:04d}", s["name"], slat, slon,
                geohash_encode(slat, slon), random_status(), random_install_date(),
            ))
            idx += 1

    sensor_lines = []
    for sid, site_name, lat, lon, gh, status, inst in sensor_rows:
        sensor_lines.append(
            f"    ({sql_str(sid)}, (SELECT id FROM company_sites WHERE site_name = {sql_str(site_name)}), "
            f"{lat:.8f}, {lon:.8f}, {sql_str(gh)}, {sql_str(status)}, {sql_str(inst)})"
        )

    sensors_sql = (
        "CREATE TABLE IF NOT EXISTS sensor_registry\n"
        "(\n"
        "    id UUID DEFAULT gen_random_uuid() UNIQUE,\n"
        "    sensor_id VARCHAR(50) PRIMARY KEY,\n"
        "    site_id INTEGER REFERENCES company_sites(id) ON DELETE SET NULL,\n"
        "    latitude NUMERIC(11, 8) NOT NULL,\n"
        "    longitude NUMERIC(11, 8) NOT NULL,\n"
        "    geohash VARCHAR(12) NOT NULL,\n"
        "    status VARCHAR(20) DEFAULT 'active',\n"
        "    installation_date DATE,\n"
        "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n"
        "    );\n\n"
        "CREATE INDEX IF NOT EXISTS idx_sensor_geohash ON sensor_registry (geohash varchar_pattern_ops);\n\n"
        "-- AUTO-GENERATED by postgresql/generate_hanoi_sensors.py — do not edit by hand.\n"
        f"-- {len(sensor_rows)} mock sensors across {len(sites)} Hanoi sites (3-5 sensors each).\n"
        "INSERT INTO sensor_registry (sensor_id, site_id, latitude, longitude, geohash, status, installation_date)\n"
        "VALUES\n"
        + ",\n".join(sensor_lines)
        + "\nON CONFLICT (sensor_id) DO NOTHING;\n"
    )
    (out_dir / "sensor_registry_initialization.sql").write_text(sensors_sql)

    print(f"Wrote {len(sites)} sites ({n_ind} industrial / {n_gov} government) "
          f"and {len(sensor_rows)} sensors (3-5 per site).")


if __name__ == "__main__":
    main()
