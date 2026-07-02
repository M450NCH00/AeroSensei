import time
import random
import os
import sys
import logging
import psycopg2
from datetime import datetime, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

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

READING_INTERVAL = 15

logger.info("Starting API Traffic Simulator...")

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

        cur.execute(
            "SELECT sr.id, sr.site_id, cs.site_name "
            "FROM sensor_registry sr "
            "JOIN company_sites cs ON sr.site_id = cs.id "
            "LIMIT 9;"
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

# --- 3. SELECT THE CRITICAL SITE ---
critical_site_id = sensors[0]["site_id"]
logger.warning(f"TARGET LOCKED: Site ID {critical_site_id} will consistently simulate PM2.5 > 55 & PM10 > 120!")
logger.info(f"Writing directly to InfluxDB bucket '{INFLUX_BUCKET}' every {READING_INTERVAL} seconds...")

# --- 4. CONTINUOUS DATA GENERATION ---
while True:
    utc_now = datetime.now(timezone.utc)
    points = []

    for sensor in sensors:
        sensor_uuid = sensor["sensor_uuid"]
        site_id = sensor["site_id"]
        site_name = sensor["site_name"]

        # --- DATA GENERATION LOGIC ---
        if site_id == critical_site_id:
            # ALERT SITE: Force both PM2.5 and PM10 to exceed the alert thresholds
            pm25 = round(random.uniform(60, 80), 2)   # Threshold is 55.0
            pm10 = round(random.uniform(125, 150), 2) # Threshold is 120.0

            # Fill in the blanks logically to make the payload look realistic
            pm1 = round(pm25 * 0.5, 2)
            pm4 = round((pm25 + pm10) / 2, 2)
            nc05 = round(random.uniform(2000, 4000), 2)
        else:
            # NORMAL SITE: Safe PM levels
            pm1 = round(random.uniform(2, 12), 2)
            pm25 = round(pm1 + random.uniform(0, 15), 2)
            pm4 = round(pm25 + random.uniform(0, 5), 2)
            pm10 = round(pm4 + random.uniform(0, 8), 2)
            nc05 = round(random.uniform(200, 1000), 2)

        point = (
            Point("air_quality")
            .tag("sensor_id", sensor_uuid)
            .tag("site_id", str(site_id))
            .tag("site_name", site_name)
            .field("pm1_0", pm1)
            .field("pm2_5", pm25)
            .field("pm4_0", pm4)
            .field("pm10", pm10)
            .field("nc0_5", nc05)
            .time(utc_now, WritePrecision.NS)
        )
        points.append(point)

        if site_id == critical_site_id:
            logger.warning(f"[CRITICAL] PM2.5: {pm25} | PM10: {pm10} for Sensor {sensor_uuid} (Site {site_id})")
        else:
            logger.info(f"[NORMAL]   PM2.5: {pm25} | PM10: {pm10} for Sensor {sensor_uuid} (Site {site_id})")

    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
    except Exception as e:
        logger.error(f"Failed to write points to InfluxDB: {e}")

    logger.info("-" * 60)
    time.sleep(READING_INTERVAL)
