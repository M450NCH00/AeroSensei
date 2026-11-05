import os
import gzip
from datetime import datetime, timedelta
import boto3
from influxdb_client import InfluxDBClient

# --- CONFIGURATION ---
# For Local Dev, use localhost. For Lambda, these will be Environment Variables.
INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "my-super-secret-admin-token-12345")
INFLUX_ORG = os.getenv("INFLUX_ORG", "my-org")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensors_data")

# --- MINIO CONFIGURATION ---
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")  # Default MinIO user
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")  # Default MinIO pass
BUCKET_NAME = os.getenv("BUCKET_NAME", "influx-backups")    # Must exist in MinIO

# Lookback window in days (default 1 = a daily backup). The window ENDS at the
# moment the backup is triggered, so today's data up to now is included.
LOOKBACK_DAYS = int(os.getenv("BACKUP_LOOKBACK_DAYS", "1"))


def main():
    # 1. Time window: from LOOKBACK_DAYS ago up to right now (the trigger moment).
    now = datetime.utcnow()
    end_date = now
    start_date = end_date - timedelta(days=LOOKBACK_DAYS)

    start_time_iso = start_date.isoformat() + "Z"
    # Nudge the stop 1 minute past now so the most recent points are included
    # (Flux range stop is exclusive).
    end_time_iso = (end_date + timedelta(minutes=1)).isoformat() + "Z"

    print(f"Extracting {LOOKBACK_DAYS} day(s) of data from {start_time_iso} to {now.isoformat()}Z...")

    # 2. Initialize InfluxDB Client
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    query_api = client.query_api()

    # 3. Flux query to extract raw annotated CSV data
    flux_query = f'''
    from(bucket: "{INFLUX_BUCKET}")
        |> range(start: {start_time_iso}, stop: {end_time_iso})
        |> filter(fn: (r) => r._measurement == "air_quality")
        // THIS IS THE FIX: It pivots the data rows back into clean wide columns
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    
    csv_result = query_api.query_raw(flux_query)
    raw_data = csv_result.read()

    text = raw_data.decode("utf-8", "replace") if isinstance(raw_data, bytes) else raw_data
    data_rows = [ln for ln in text.splitlines() if ln.strip() and not ln.startswith("#") and not ln.startswith(",result")]
    if len(data_rows) <= 1:  # only the header row (or nothing)
        print("No data found in the window. Skipping backup.")
        return

    # 4. Create a descriptive, unique filename (includes time so multiple runs
    # per day don't overwrite each other) and compress it.
    print("Compressing data...")
    start_str = start_date.strftime("%Y-%m-%d_%H%M")
    end_str = end_date.strftime("%Y-%m-%d_%H%M")
    filename = f"influx_backup_{start_str}_to_{end_str}.csv.gz"
    
    compressed_data = gzip.compress(text.encode("utf-8"))

    # 5. Connect to local MinIO using the S3 protocol client
    print(f"Uploading {filename} to MinIO bucket '{BUCKET_NAME}'...")
    s3 = boto3.client(
        's3',
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY
    )
    
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=f"air_quality_backups/{filename}",
        Body=compressed_data
    )
    print("Weekly backup successfully stored in MinIO!")

if __name__ == "__main__":
    main()