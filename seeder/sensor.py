import time
import random
import os
import sys
import logging
import psycopg2
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

# Redis holds the demo override flag (set by the backend's /api/demo/emission-mode,
# driven by the frontend buttons). "warning"/"breached" make ALL sensors emit that
# level; missing/"normal" = default simulation. Optional — if Redis is unreachable
# the seeder just runs in normal mode.
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
DEMO_MODE_KEY = "demo:emission_mode"

READING_INTERVAL = 15

logger.info("Starting API Traffic Simulator...")


# --- PM VALUE GENERATION (per sensor, per mode) ---
# Per-sensor state (backend calculateBreachLogic): WARNING when PM2.5 in [30,40]
# or PM10 in [50,75]; BREACHED when PM2.5 > 40 or PM10 > 75. The bands below stay
# safely inside those ranges so a mode reliably produces that state.
def gen_values(mode, site_id, critical_site_id):
    if mode == "breached":
        pm25 = round(random.uniform(80, 110), 2)   # well above the >40 breach line
        pm10 = round(random.uniform(140, 180), 2)  # well above the >75 breach line
        nc05 = round(random.uniform(2500, 4500), 2)
    elif mode == "warning":
        pm25 = round(random.uniform(32, 39), 2)     # inside 30-40 warning band
        pm10 = round(random.uniform(55, 72), 2)     # inside 50-75 warning band
        nc05 = round(random.uniform(1200, 2200), 2)
    elif site_id == critical_site_id:
        # Default demo: one always-critical site so the alert pipeline stays live.
        pm25 = round(random.uniform(60, 80), 2)
        pm10 = round(random.uniform(125, 150), 2)
        nc05 = round(random.uniform(2000, 4000), 2)
    else:
        # NORMAL: safe levels.
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

        # All Hanoi sensors. ORDER BY keeps the critical-site pick deterministic.
        cur.execute(
            "SELECT sr.id, sr.site_id, cs.site_name "
            "FROM sensor_registry sr "
            "JOIN company_sites cs ON sr.site_id = cs.id "
            "ORDER BY sr.sensor_id;"
        )
        rows = cur.fetchall()

        sensors = [
            {"sensor_uuid": str(row[0]), "site_id": row[1], "site_name": row[2]}
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
            fields = gen_values(mode, sensor["site_id"], critical_site_id)
            pts.append(make_point(sensor, fields, when))
    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=pts)
        logger.warning(f"DEMO MODE -> '{mode}': cleared window + backfilled {len(pts)} points for all {len(sensors)} sensors.")
    except Exception as e:
        logger.error(f"Backfill for mode '{mode}' failed: {e}")


# --- 4. SELECT THE CRITICAL SITE (default mode) ---
critical_site_id = sensors[0]["site_id"]
critical_count = sum(1 for s in sensors if s["site_id"] == critical_site_id)
logger.info(f"Default critical site: {critical_site_id} ({critical_count} sensors).")
logger.info(f"Simulating {len(sensors)} Hanoi sensors -> InfluxDB bucket '{INFLUX_BUCKET}' every {READING_INTERVAL} seconds...")

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
        make_point(sensor, gen_values(mode, sensor["site_id"], critical_site_id), utc_now)
        for sensor in sensors
    ]

    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        logger.info(f"[{mode}] Wrote {len(points)} readings.")
    except Exception as e:
        logger.error(f"Failed to write points to InfluxDB: {e}")
    time.sleep(READING_INTERVAL)
