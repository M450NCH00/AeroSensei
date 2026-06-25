import time
import random
import os
import psycopg2
from datetime import datetime, timedelta, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

# --- CONFIGURATION ---
# InfluxDB Config
# INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
# INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "my-super-secret-auth-token")
# INFLUX_ORG = os.getenv("INFLUX_ORG", "aerosensei")
# INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensor_data")
INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv(
    "INFLUX_TOKEN",
    "my-super-secret-admin-token-12345"
)
INFLUX_ORG = os.getenv("INFLUX_ORG", "my-org")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensors_data")

# PostgreSQL Config
# PG_HOST = os.getenv("PG_HOST", "postgres")
# PG_PORT = os.getenv("PG_PORT", "5432")
# PG_DB = os.getenv("PG_DB", "aerosensei_db")
# PG_USER = os.getenv("PG_USER", "postgres")
# PG_PASS = os.getenv("PG_PASS", "postgres")
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = os.getenv("PG_PORT", "5432")
PG_DB = os.getenv("PG_DB", "postgresdb")
PG_USER = os.getenv("PG_USER", "admin")
PG_PASS = os.getenv("PG_PASS", "ChangeThisPassword123!")

print("🔄 Starting Seeder Service...")

# --- 1. FETCH UUIDS FROM POSTGRESQL ---
sensors = []
while True:
    try:
        print(f"🔌 Connecting to PostgreSQL at {PG_HOST}:{PG_PORT}...")
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            dbname=PG_DB,
            user=PG_USER,
            password=PG_PASS
        )
        cur = conn.cursor()

        # Fetch all UUIDs from the registry table
        cur.execute("SELECT id FROM sensor_registry;")
        rows = cur.fetchall()
        sensors = [str(row[0]) for row in rows]

        cur.close()
        conn.close()

        if len(sensors) > 0:
            print(f"Successfully fetched {len(sensors)} sensor UUIDs from PostgreSQL!")
            break
        else:
            print("Connected to DB, but no sensors found. Waiting 5s for Spring Boot to seed...")
            time.sleep(5)

    except Exception as e:
        print(f"Waiting for PostgreSQL to start... Error: {e}")
        time.sleep(3)


# --- 2. CONNECT TO INFLUXDB & WIPE DATA ---
print(f"🔌 Connecting to InfluxDB at {INFLUX_URL}...")
client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

while True:
    try:
        if client.ping():
            print("InfluxDB is awake and ready!")
            break
    except Exception:
        print("⏳ Waiting for InfluxDB...")
        time.sleep(2)

print("Wiping out all existing 'air_quality' data in the bucket...")
delete_api = client.delete_api()
start_time_delete = "1970-01-01T00:00:00Z"
stop_time_delete = "2099-01-01T00:00:00Z"
delete_api.delete(start_time_delete, stop_time_delete, '_measurement="air_quality"', bucket=INFLUX_BUCKET, org=INFLUX_ORG)
print("Bucket wiped clean!")


# --- 3. GENERATE NEW DATA (-1 HOUR TO +1 HOUR) ---
write_api = client.write_api(write_options=SYNCHRONOUS)

now = datetime.now(timezone.utc)
start_time = now - timedelta(hours=15)
end_time = now + timedelta(hours=2)

print(f"Generating mock data from {start_time.strftime('%H:%M:%S')} to {end_time.strftime('%H:%M:%S')} (UTC)...")

current_time = start_time
points = []
record_count = 0

while current_time <= end_time:
    for sensor_uuid in sensors:
        pm1 = round(random.uniform(2, 12), 2)
        pm25 = round(pm1 + random.uniform(0, 15), 2)
        pm4 = round(pm25 + random.uniform(0, 5), 2)
        pm10 = round(pm4 + random.uniform(0, 8), 2)
        nc05 = round(random.uniform(200, 1000), 2)

        point = Point("air_quality") \
            .tag("sensor_id", sensor_uuid) \
            .field("pm1_0", pm1) \
            .field("pm2_5", pm25) \
            .field("pm4_0", pm4) \
            .field("pm10", pm10) \
            .field("nc0_5", nc05) \
            .time(current_time, WritePrecision.NS)
        points.append(point)
        record_count += 1

    current_time += timedelta(minutes=1)

write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
print(f"Success! Inserted {record_count} new records. Seeder shutting down.")