import random
import psycopg2
from datetime import datetime, timedelta

# Major Vietnam locations with their base coordinates (Latitude, Longitude)
VIETNAM_LOCATIONS = [
    ("Hanoi", 21.0285, 105.8542),
    ("Ho Chi Minh City", 10.8231, 106.6297),
    ("Da Nang", 16.0544, 108.2022),
    ("Nha Trang", 12.2388, 109.1967),
    ("Da Lat", 11.9404, 108.4583),
    ("Hue", 16.4637, 107.5905),
    ("Hai Phong", 20.8449, 106.6881),
    ("Can Tho", 10.0452, 105.7469),
    ("Vung Tau", 10.3460, 107.0843),
    ("Hoi An", 15.8801, 108.3380)
]

STATUSES = ['active', 'active', 'active', 'maintenance', 'offline']

# Database connection settings
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "sensor_metadata"
DB_USER = "admin"
DB_PASSWORD = "ChangeThisPassword123!"

def generate_and_insert_data(num_records=50, filename="vietnam_sensors_record.sql"):
    print(f"Generating {num_records} mock sensor records...")
    
    # 1. Generate the SQL string
    sql_header = "INSERT INTO sensor_registry (sensor_id, location_name, latitude, longitude, status, installation_date) VALUES\n"
    values = []
    
    for i in range(1, num_records + 1):
        sensor_id = f"SENS-VN-{i:03d}" # Added -VN- to distinguish from previous data
        city, base_lat, base_lon = random.choice(VIETNAM_LOCATIONS)
        lat = base_lat + random.uniform(-0.05, 0.05)
        lon = base_lon + random.uniform(-0.05, 0.05)
        status = random.choice(STATUSES)
        days_ago = random.randint(0, 730)
        install_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
        row = f"    ('{sensor_id}', '{city}', {lat:.8f}, {lon:.8f}, '{status}', '{install_date}')"
        values.append(row)
        
    full_query = sql_header + ",\n".join(values) + "\nON CONFLICT (sensor_id) DO NOTHING;"
    
    # 2. Write to a file for your records only
    with open(filename, "w") as f:
        f.write("-- Backup record of auto-generated mock data\n")
        f.write(full_query)
    print(f"[*] Record file saved to: {filename}")

    # 3. Connect to PostgreSQL and insert directly
    try:
        print("[*] Connecting to PostgreSQL database...")
        connection = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = connection.cursor()
        
        print("[*] Dumping data into the database...")
        cursor.execute(full_query)
        connection.commit()
        
        print("[*] Success! Data successfully inserted into sensor_registry.")

    except (Exception, psycopg2.Error) as error:
        print(f"[!] Error while connecting or inserting to PostgreSQL: {error}")
    
    finally:
        # Always close the connection when done
        if 'connection' in locals() and connection:
            cursor.close()
            connection.close()
            print("[*] Database connection closed.")

if __name__ == "__main__":
    generate_and_insert_data(50)