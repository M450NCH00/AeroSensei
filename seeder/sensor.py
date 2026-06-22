import time
import random
import os
import psycopg2
from datetime import datetime, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

# --- CONFIGURATION ---
# InfluxDB Config
INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "my-super-secret-auth-token")
INFLUX_ORG = os.getenv("INFLUX_ORG", "aerosensei")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensor_data")

# PostgreSQL Config
PG_HOST = os.getenv("PG_HOST", "postgres")
PG_PORT = os.getenv("PG_PORT", "5432")
PG_DB = os.getenv("PG_DB", "aerosensei_db")
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASS = os.getenv("PG_PASS", "postgres")

# Sensor Config
READING_INTERVAL = int(os.getenv("READING_INTERVAL", "15")) # Seconds between readings

print("🔄 Starting Continuous Sensor Service...", flush=True)

# --- 1. FETCH UUIDS FROM POSTGRESQL ---
sensors = []
while True:
    try:
        print(f"🔌 Connecting to PostgreSQL at {PG_HOST}:{PG_PORT}...", flush=True)
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            dbname=PG_DB,
            user=PG_USER,
            password=PG_PASS
        )
        cur = conn.cursor()

        # Fetch up to 9 UUIDs from the registry table
        cur.execute("SELECT id FROM sensor_registry LIMIT 9;")
        rows = cur.fetchall()
        sensors = [str(row[0]) for row in rows]

        cur.close()
        conn.close()

        if len(sensors) > 0:
            print(f"✅ Successfully fetched {len(sensors)} sensor UUIDs from PostgreSQL!", flush=True)
            break
        else:
            print("⚠️ Connected to DB, but no sensors found. Waiting 5s...", flush=True)
            time.sleep(5)

    except Exception as e:
        print(f"⏳ Waiting for PostgreSQL to start... Error: {e}", flush=True)
        time.sleep(3)


# --- 2. CONNECT TO INFLUXDB ---
print(f"🔌 Connecting to InfluxDB at {INFLUX_URL}...", flush=True)
client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

while True:
    try:
        if client.ping():
            print("✅ InfluxDB is awake and ready!", flush=True)
            break
    except Exception:
        print("⏳ Waiting for InfluxDB...", flush=True)
        time.sleep(2)


# --- 3. HELPER: WORKING HOURS LOGIC ---
def is_working_hours(current_time):
    # Weekdays (Monday=0, Sunday=6) -> < 5 means Mon-Fri
    is_weekday = current_time.weekday() < 5
    # Working hours: 8:00 AM to 6:00 PM (18:00)
    is_active_hours = 8 <= current_time.hour < 18
    return is_weekday and is_active_hours


# --- 4. CONTINUOUS DATA GENERATION ---
write_api = client.write_api(write_options=SYNCHRONOUS)
print(f"Starting continuous data generation for {len(sensors)} sensors (Interval: {READING_INTERVAL}s)...", flush=True)

while True:
    try:
        # Use container's local time for working hour logic, but UTC for InfluxDB timestamp
        local_now = datetime.now() 
        utc_now = datetime.now(timezone.utc)
        
        points = []
        working_hours = is_working_hours(local_now)

        for sensor_uuid in sensors:
            if working_hours:
                # HIGHER POLLUTION DURING WORKING HOURS
                pm1 = round(random.uniform(15, 35), 2)
                nc05 = round(random.uniform(1000, 3000), 2)
            else:
                # LOWER POLLUTION DURING OFF-HOURS
                pm1 = round(random.uniform(2, 12), 2)
                nc05 = round(random.uniform(200, 1000), 2)

            # Dependent values scale up based on the base pm1 value
            pm25 = round(pm1 + random.uniform(0, 15), 2)
            pm4 = round(pm25 + random.uniform(0, 5), 2)
            pm10 = round(pm4 + random.uniform(0, 8), 2)

            point = Point("air_quality") \
                .tag("sensor_id", sensor_uuid) \
                .field("pm1_0", pm1) \
                .field("pm2_5", pm25) \
                .field("pm4_0", pm4) \
                .field("pm10", pm10) \
                .field("nc0_5", nc05) \
                .time(utc_now, WritePrecision.NS)
            
            points.append(point)

        # Write the batch of points
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        status = "Working Hours (High Pollution)" if working_hours else "🌙 Off-Hours (Low Pollution)"
        print(f"[{utc_now.strftime('%H:%M:%S UTC')}] Inserted {len(points)} records. Status: {status}", flush=True)

    except Exception as e:
        print(f"Error writing to InfluxDB: {e}", flush=True)

    # Wait before the next reading
    time.sleep(READING_INTERVAL)