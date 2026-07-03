import time
import random
import os
import sys
import logging
import psycopg2
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None

# --- LOGGING CONFIGURATION FOR DOCKER ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stdout
)
logger = logging.getLogger("TrafficSimulator")

# --- CONFIGURATION ---
INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "my-super-secret-admin-token-12345")
INFLUX_ORG = os.getenv("INFLUX_ORG", "my-org")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensors_data")

PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = os.getenv("PG_PORT", "5432")
PG_DB = os.getenv("PG_DB", "postgresdb")
PG_USER = os.getenv("PG_USER", "admin")
PG_PASS = os.getenv("PG_PASS", "ChangeThisPassword123!")

OPENAQ_API_BASE = os.getenv("OPENAQ_API_BASE", "https://api.openaq.org/v3")
OPENAQ_API_KEY = os.getenv("OPENAQ_API_KEY", "")
OPENAQ_REFRESH_SECONDS = int(os.getenv("OPENAQ_REFRESH_SECONDS", "600"))
OPENAQ_TIMEOUT_SECONDS = int(os.getenv("OPENAQ_TIMEOUT_SECONDS", "12"))
OPENAQ_HCMC_BBOX = (106.35, 10.35, 107.15, 11.20)  # min lon, min lat, max lon, max lat

# Redis holds the demo override flag (set by the backend's /api/demo/emission-mode,
# driven by the frontend buttons). "warning"/"breached" make ALL sensors emit that
# level; missing/"normal" = default simulation. Optional — if Redis is unreachable
# the seeder just runs in normal mode.
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
DEMO_MODE_KEY = "demo:emission_mode"

READING_INTERVAL = 15

logger.info("Starting API Traffic Simulator...")


def is_hcm_sensor(sensor):
    lat = sensor.get("latitude")
    lon = sensor.get("longitude")
    return lat is not None and lon is not None and 10.35 <= lat <= 11.20 and 106.35 <= lon <= 107.15


def normalize_parameter_name(value):
    return str(value or "").lower().replace(" ", "").replace("_", "").replace(".", "")


def parameter_key(parameter):
    if isinstance(parameter, dict):
        raw_name = parameter.get("name") or parameter.get("displayName")
    else:
        raw_name = parameter

    name = normalize_parameter_name(raw_name)
    if name in ("pm25", "pm2_5", "pm2.5"):
        return "pm2_5"
    if name == "pm10":
        return "pm10"
    return None


def distance_sq(lat1, lon1, lat2, lon2):
    return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2


class OpenAQClient:
    def __init__(self):
        self.enabled = bool(OPENAQ_API_KEY)
        self.last_refresh = None
        self.profiles = []
        self.warned_disabled = False

    def request_json(self, path, params=None):
        query = urllib.parse.urlencode(params or {})
        url = f"{OPENAQ_API_BASE.rstrip('/')}/{path.lstrip('/')}"
        if query:
            url = f"{url}?{query}"

        req = urllib.request.Request(url, headers={
            "X-API-Key": OPENAQ_API_KEY,
            "Accept": "application/json",
            "User-Agent": "AeroSenseiSeeder/1.0",
        })
        with urllib.request.urlopen(req, timeout=OPENAQ_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))

    def refresh_if_needed(self):
        if not self.enabled:
            if not self.warned_disabled:
                logger.warning("OPENAQ_API_KEY is not set; Ho Chi Minh City sensors will use fallback synthetic values.")
                self.warned_disabled = True
            return

        now = datetime.now(timezone.utc)
        if self.last_refresh and (now - self.last_refresh).total_seconds() < OPENAQ_REFRESH_SECONDS:
            return

        try:
            self.profiles = self.fetch_hcm_profiles(now)
            self.last_refresh = now
            if self.profiles:
                logger.info(f"OpenAQ refresh loaded {len(self.profiles)} Ho Chi Minh City PM profiles.")
            else:
                logger.warning("OpenAQ refresh returned no Ho Chi Minh City PM2.5/PM10 values; using fallback values.")
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.warning(f"OpenAQ refresh failed ({e}); using fallback synthetic HCMC values until next refresh.")
            self.last_refresh = now

    def fetch_hcm_profiles(self, now):
        bbox = ",".join(str(v) for v in OPENAQ_HCMC_BBOX)
        locations_payload = self.request_json("locations", {
            "bbox": bbox,
            "iso": "VN",
            "limit": 100,
            "page": 1,
        })

        profiles = []
        datetime_min = (now - timedelta(days=7)).replace(microsecond=0).isoformat()
        for location in locations_payload.get("results", []):
            coords = location.get("coordinates") or {}
            lat = coords.get("latitude")
            lon = coords.get("longitude")
            if lat is None or lon is None:
                continue

            sensor_parameters = {}
            for sensor in location.get("sensors", []):
                key = parameter_key(sensor.get("parameter"))
                if key:
                    sensor_parameters[sensor.get("id")] = key

            if not sensor_parameters:
                continue

            latest_payload = self.request_json(f"locations/{location['id']}/latest", {
                "limit": 100,
                "page": 1,
                "datetime_min": datetime_min,
            })

            values = {}
            for reading in latest_payload.get("results", []):
                key = sensor_parameters.get(reading.get("sensorsId")) or parameter_key(reading.get("parameter"))
                value = reading.get("value")
                if key and isinstance(value, (int, float)) and value >= 0:
                    values[key] = float(value)

            if "pm2_5" in values or "pm10" in values:
                profiles.append({
                    "location_id": location["id"],
                    "location_name": location.get("name") or f"OpenAQ location {location['id']}",
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "values": values,
                })

        return profiles

    def values_for_sensor(self, sensor):
        self.refresh_if_needed()
        if not self.profiles:
            return None

        nearest = min(
            self.profiles,
            key=lambda profile: distance_sq(sensor["latitude"], sensor["longitude"], profile["latitude"], profile["longitude"])
        )
        values = dict(nearest["values"])
        if "pm2_5" not in values and "pm10" in values:
            values["pm2_5"] = values["pm10"] * random.uniform(0.42, 0.62)
        if "pm10" not in values and "pm2_5" in values:
            values["pm10"] = values["pm2_5"] * random.uniform(1.55, 2.25)

        pm25 = round(max(0.0, values["pm2_5"] + random.uniform(-1.5, 1.5)), 2)
        pm10 = round(max(pm25, values["pm10"] + random.uniform(-3.0, 3.0)), 2)
        pm1 = round(max(1.0, pm25 * random.uniform(0.38, 0.58)), 2)
        pm4 = round(pm25 + (pm10 - pm25) * random.uniform(0.35, 0.60), 2)
        nc05 = round(450 + pm25 * random.uniform(24, 42) + pm10 * random.uniform(4, 10), 2)
        return {"pm1_0": pm1, "pm2_5": pm25, "pm4_0": pm4, "pm10": pm10, "nc0_5": nc05}


openaq_client = OpenAQClient()


def gen_hcm_openaq_values(sensor, when=None):
    # OpenAQ-style urban readings: real-world-ish PM2.5/PM10 magnitudes with
    # rush-hour bumps, site profiles, and occasional haze spikes.
    if when is None:
        when = datetime.now(timezone.utc)

    local_hour = (when + timedelta(hours=7)).hour
    rush_hour = 1.0 if 6 <= local_hour <= 9 or 16 <= local_hour <= 20 else 0.0
    night_stagnation = 1.0 if local_hour >= 22 or local_hour <= 4 else 0.0

    site_name = sensor["site_name"].lower()
    if "cat lai" in site_name:
        profile_pm25, profile_pm10 = 8.0, 22.0
    elif "tan thuan" in site_name or "hi-tech" in site_name:
        profile_pm25, profile_pm10 = 5.0, 15.0
    elif "tan binh" in site_name:
        profile_pm25, profile_pm10 = 7.0, 13.0
    elif "district 1" in site_name or "binh thanh" in site_name:
        profile_pm25, profile_pm10 = 6.0, 12.0
    else:
        profile_pm25, profile_pm10 = 4.0, 10.0

    haze_spike = random.uniform(8, 20) if random.random() < 0.08 else 0.0
    pm25 = round(
        random.uniform(14, 29)
        + profile_pm25
        + random.uniform(5, 11) * rush_hour
        + random.uniform(2, 6) * night_stagnation
        + haze_spike,
        2
    )
    pm10 = round(
        pm25
        + profile_pm10
        + random.uniform(8, 24)
        + random.uniform(6, 14) * rush_hour,
        2
    )
    pm1 = round(max(2.0, pm25 * random.uniform(0.38, 0.58)), 2)
    pm4 = round(pm25 + (pm10 - pm25) * random.uniform(0.35, 0.60), 2)
    nc05 = round(450 + pm25 * random.uniform(24, 42) + pm10 * random.uniform(4, 10), 2)
    return {"pm1_0": pm1, "pm2_5": pm25, "pm4_0": pm4, "pm10": pm10, "nc0_5": nc05}


def hcm_values(sensor, when=None):
    real_values = openaq_client.values_for_sensor(sensor)
    if real_values is not None:
        return real_values
    return gen_hcm_openaq_values(sensor, when)


# --- PM VALUE GENERATION (per sensor, per mode) ---
# Per-sensor state (backend calculateBreachLogic): WARNING when PM2.5 in [30,40]
# or PM10 in [50,75]; BREACHED when PM2.5 > 40 or PM10 > 75. The bands below stay
# safely inside those ranges so a mode reliably produces that state.
def gen_values(mode, sensor, critical_site_id, when=None):
    site_id = sensor["site_id"]
    if mode == "breached":
        pm25 = round(random.uniform(80, 110), 2)   # well above the >40 breach line
        pm10 = round(random.uniform(140, 180), 2)  # well above the >75 breach line
        nc05 = round(random.uniform(2500, 4500), 2)
    elif mode == "warning":
        pm25 = round(random.uniform(32, 39), 2)     # inside 30-40 warning band
        pm10 = round(random.uniform(55, 72), 2)     # inside 50-75 warning band
        nc05 = round(random.uniform(1200, 2200), 2)
    else:
        # NORMAL (default for EVERY sensor): safe/healthy levels. PM2.5 stays
        # under ~27 and PM10 under ~40, comfortably below the backend's WARNING
        # thresholds (PM2.5>=30 / PM10>=50). The old always-critical demo site and
        # the HCMC OpenAQ path were removed here so all sensors read healthy unless
        # a demo mode explicitly forces 'warning'/'breached'.
        pm1 = round(random.uniform(2, 12), 2)
        pm25 = round(pm1 + random.uniform(0, 15), 2)
        pm4 = round(pm25 + random.uniform(0, 5), 2)
        pm10 = round(pm4 + random.uniform(0, 8), 2)
        nc05 = round(random.uniform(200, 1000), 2)
        return {"pm1_0": pm1, "pm2_5": pm25, "pm4_0": pm4, "pm10": pm10, "nc0_5": nc05}

    pm1 = round(pm25 * 0.5, 2)
    pm4 = round((pm25 + pm10) / 2, 2)
    return {"pm1_0": pm1, "pm2_5": pm25, "pm4_0": pm4, "pm10": pm10, "nc0_5": nc05}


def make_point(sensor, fields, when):
    p = (
        Point("air_quality")
        .tag("sensor_id", sensor["sensor_uuid"])
        .tag("site_id", str(sensor["site_id"]))
        .tag("site_name", sensor["site_name"])
        .time(when, WritePrecision.NS)
    )
    for k, v in fields.items():
        p.field(k, v)
    return p

# --- 1. FETCH SENSORS & SITES FROM POSTGRESQL ---
# Each sensor carries its registry UUID (the InfluxDB sensor_id tag), plus its
# site's id/name so the InfluxDB alert task can group readings by site without
# needing to join back out to Postgres.
sensors = []
while True:
    try:
        logger.info(f"Connecting to PostgreSQL at {PG_HOST}:{PG_PORT}...")
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            dbname=PG_DB,
            user=PG_USER,
            password=PG_PASS
        )
        cur = conn.cursor()

        # All sensors. ORDER BY keeps the critical-site pick deterministic.
        cur.execute(
            "SELECT sr.id, sr.site_id, cs.site_name, sr.latitude, sr.longitude "
            "FROM sensor_registry sr "
            "JOIN company_sites cs ON sr.site_id = cs.id "
            # Only simulate the mock sensor families (hn_/hcm_). Physical devices
            # such as the vinuni_ ESP32 write their own real readings — the seeder
            # must not clobber them with synthetic values.
            "WHERE sr.sensor_id LIKE 'hn\\_%' OR sr.sensor_id LIKE 'hcm\\_%' "
            "ORDER BY sr.sensor_id;"
        )
        rows = cur.fetchall()

        sensors = [
            {
                "sensor_uuid": str(row[0]),
                "site_id": row[1],
                "site_name": row[2],
                "latitude": float(row[3]),
                "longitude": float(row[4]),
            }
            for row in rows
        ]

        cur.close()
        conn.close()

        if len(sensors) > 0:
            logger.info(f"Successfully fetched {len(sensors)} sensors from PostgreSQL!")
            break
        else:
            logger.warning("Connected to DB, but no sensors found. Waiting 5s...")
            time.sleep(5)

    except Exception as e:
        logger.error(f"Waiting for PostgreSQL to start... Error: {e}")
        time.sleep(3)

# --- 2. CONNECT TO INFLUXDB ---
logger.info(f"Connecting to InfluxDB at {INFLUX_URL}...")
client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

while True:
    try:
        if client.ping():
            logger.info("InfluxDB is awake and ready!")
            break
    except Exception:
        logger.info("Waiting for InfluxDB...")
        time.sleep(2)

write_api = client.write_api(write_options=SYNCHRONOUS)

# --- 3. CONNECT TO REDIS (optional demo-mode flag) ---
redis_client = None
if redis_lib is not None:
    try:
        redis_client = redis_lib.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        redis_client.ping()
        logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT} — demo mode buttons enabled.")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}); demo mode buttons disabled, running normal simulation.")
        redis_client = None
else:
    logger.warning("redis library not installed; demo mode buttons disabled.")


def read_mode():
    if redis_client is None:
        return "normal"
    try:
        return (redis_client.get(DEMO_MODE_KEY) or "normal").lower()
    except Exception:
        return "normal"


# When the mode changes, first DELETE the last ~15 minutes of air_quality so no
# residual points from the previous mode remain, then backfill the window at the
# new level for every sensor. The backend averages the whole 15-minute window to
# decide each sensor's state, so without the delete a small warning band (just
# above the 30 threshold) would be dragged back below it by leftover normal/breached
# points and never register — deleting makes the mean equal the target exactly.
def backfill(mode):
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=16)
    stop = now + timedelta(minutes=1)
    try:
        client.delete_api().delete(
            start, stop, '_measurement="air_quality"', bucket=INFLUX_BUCKET, org=INFLUX_ORG
        )
    except Exception as e:
        logger.error(f"Failed to clear last-15-min window for mode '{mode}': {e}")

    pts = []
    steps = 16  # ~1 point/min across the 15-min window
    for i in range(steps):
        when = now - timedelta(minutes=(steps - 1 - i))
        for sensor in sensors:
            fields = gen_values(mode, sensor, critical_site_id, when)
            pts.append(make_point(sensor, fields, when))
    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=pts)
        logger.warning(f"DEMO MODE -> '{mode}': cleared window + backfilled {len(pts)} points for all {len(sensors)} sensors.")
    except Exception as e:
        logger.error(f"Backfill for mode '{mode}' failed: {e}")


# --- 4. SELECT THE CRITICAL SITE (default mode) ---
hcm_count = sum(1 for s in sensors if is_hcm_sensor(s))
critical_seed = next((s for s in sensors if not is_hcm_sensor(s)), sensors[0])
critical_site_id = critical_seed["site_id"]
critical_count = sum(1 for s in sensors if s["site_id"] == critical_site_id)
logger.info(f"Default critical site: {critical_site_id} ({critical_count} sensors).")
logger.info(f"Simulating {len(sensors)} sensors ({hcm_count} Ho Chi Minh City OpenAQ-like) -> InfluxDB bucket '{INFLUX_BUCKET}' every {READING_INTERVAL} seconds...")

# --- 5. CONTINUOUS DATA GENERATION ---
last_mode = None
while True:
    mode = read_mode()
    if mode != last_mode:
        # Skip the clear+backfill on a normal startup so we don't wipe the
        # freshly-seeded history; only backfill on real transitions / forced modes.
        if not (last_mode is None and mode == "normal"):
            backfill(mode)
        last_mode = mode

    utc_now = datetime.now(timezone.utc)
    points = [
        make_point(sensor, gen_values(mode, sensor, critical_site_id, utc_now), utc_now)
        for sensor in sensors
    ]

    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        logger.info(f"[{mode}] Wrote {len(points)} readings.")
    except Exception as e:
        logger.error(f"Failed to write points to InfluxDB: {e}")
    time.sleep(READING_INTERVAL)
