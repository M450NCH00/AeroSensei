import time
import random
import os
import sys
import logging
import psycopg2
import requests
from datetime import datetime, timezone

# --- LOGGING CONFIGURATION FOR DOCKER ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stdout
)
logger = logging.getLogger("TrafficSimulator")

# --- CONFIGURATION ---
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8081/api/sensors/ingest")

PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = os.getenv("PG_PORT", "5432")
PG_DB = os.getenv("PG_DB", "aerosensei_db")
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASS = os.getenv("PG_PASS", "postgres")

READING_INTERVAL = 15

logger.info("Starting API Traffic Simulator...")

# --- 1. FETCH SENSORS & SITES FROM POSTGRESQL ---
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

        cur.execute("SELECT sensor_id, site_id FROM sensor_registry LIMIT 9;")
        rows = cur.fetchall()

        sensors = [{"sensor_id": str(row[0]), "site_id": row[1]} for row in rows]

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

# --- 2. SELECT THE CRITICAL SITE ---
critical_site_id = sensors[0]["site_id"]
logger.warning(f"TARGET LOCKED: Site ID {critical_site_id} will consistently simulate PM2.5 > 55 & PM10 > 120!")
logger.info(f"Sending data to {BACKEND_API_URL} every {READING_INTERVAL} seconds...")

# --- 3. CONTINUOUS DATA GENERATION ---
while True:
    utc_now = datetime.now(timezone.utc).isoformat()

    for sensor in sensors:
        sensor_id = sensor["sensor_id"]
        site_id = sensor["site_id"]

        # --- DATA GENERATION LOGIC ---
        if site_id == critical_site_id:
            # ALERT SITE: Force both PM2.5 and PM10 to exceed your new thresholds
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

        payload = {
            "sensorId": sensor_id,
            "pm1_0": pm1,
            "pm2_5": pm25,
            "pm4_0": pm4,
            "pm10": pm10,
            "nc0_5": nc05,
            "timestamp": utc_now
        }

        try:
            response = requests.post(BACKEND_API_URL, json=payload, timeout=5)

            # Updated logs to show both values clearly
            if site_id == critical_site_id:
                logger.warning(f"[CRITICAL] Sent PM2.5: {pm25} | PM10: {pm10} for Sensor {sensor_id} (Site {site_id})")
            else:
                logger.info(f"[NORMAL]   Sent PM2.5: {pm25} | PM10: {pm10} for Sensor {sensor_id} (Site {site_id})")

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to reach Spring Boot Backend: {e}")

    logger.info("-" * 60)
    time.sleep(READING_INTERVAL)