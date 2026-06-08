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

def main():
    # 1. Calculate the 1-week time window
    now = datetime.utcnow()
    
    # End time: Midnight today (excluding today's partial data)
    end_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Start time: Midnight exactly 7 days ago
    start_date = end_date - timedelta(days=7)
    
    start_time_iso = start_date.isoformat() + "Z"
    end_time_iso = end_date.isoformat() + "Z"
    
    print(f"Extracting 1 week of data from {start_time_iso} to {end_time_iso}...")

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

    if not raw_data or len(raw_data) < 50:
        print("No data found for this week. Skipping backup.")
        return

    # 4. Create a descriptive date-range filename and compress it
    print("Compressing data...")
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    filename = f"influx_backup_{start_str}_to_{end_str}.csv.gz"
    
    compressed_data = gzip.compress(raw_data)

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