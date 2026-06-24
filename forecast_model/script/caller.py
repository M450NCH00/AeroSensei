import requests
import json
import hashlib
import time
import pandas as pd
import numpy as np
from constants import CACHE_DIR, GRID_POINTS, N_NEIGHBORS, WEATHER_VARS, INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET
from math_helper import _haversine_km
import openmeteo_requests
import requests_cache
from retry_requests import retry

from datetime import datetime, timezone
from scipy.spatial import cKDTree

CACHE_DIR.mkdir(exist_ok=True)

def make_cache_key(url, params):
    """
    Create a stable filename from URL + params.
    """
    key = json.dumps(
        {"url": url, "params": params},
        sort_keys=True,
    )
    return hashlib.md5(key.encode()).hexdigest()


def call_open_meteo(
    url,
    params,
    max_retries=6,
    base_sleep=10,
    use_cache=True,
):
    """
    Safer Open-Meteo API caller.

    Handles:
    - local caching
    - HTTP 429 Too Many Requests
    - exponential backoff
    - Retry-After header
    """

    cache_key = make_cache_key(url, params)
    cache_path = CACHE_DIR / f"{cache_key}.json"

    if use_cache and cache_path.exists():
        with open(cache_path, "r") as f:
            return json.load(f)

    for attempt in range(max_retries):
        response = requests.get(url, params=params, timeout=120)

        if response.status_code == 200:
            data = response.json()

            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(data.get("reason", "Unknown Open-Meteo error"))

            if use_cache:
                with open(cache_path, "w") as f:
                    json.dump(data, f)

            return data

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")

            if retry_after is not None:
                sleep_time = int(retry_after)
            else:
                sleep_time = base_sleep * (2 ** attempt)

            print(
                f"429 Too Many Requests. "
                f"Sleeping {sleep_time} seconds before retry {attempt + 1}/{max_retries}..."
            )

            time.sleep(sleep_time)
            continue

        # For other errors, show useful debugging information
        print("URL:", response.url)
        print("Status code:", response.status_code)
        print("Response text:", response.text[:1000])

        response.raise_for_status()

    raise RuntimeError(
        f"Failed after {max_retries} retries due to repeated 429 errors."
    )


def hourly_json_to_dataframe(data, location_name, lat, lon, prefix=None):
    """
    Convert Open-Meteo hourly JSON into a pandas DataFrame.
    """

    hourly = data.get("hourly", None)

    if hourly is None:
        raise ValueError(f"No hourly data returned for {location_name}")

    df = pd.DataFrame(hourly)

    df["time"] = pd.to_datetime(df["time"])
    df["location"] = location_name
    df["latitude"] = lat
    df["longitude"] = lon

    if prefix is not None:
        rename_map = {
            col: f"{prefix}_{col}"
            for col in df.columns
            if col not in ["time", "location", "latitude", "longitude"]
        }
        df = df.rename(columns=rename_map)

    return df

def _fetch_open_meteo_pm2_5(lat: float, lon: float) -> float:
    """Fetch the most recent PM2.5 concentration from Open-Meteo for a coordinate."""
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude":        lat,
        "longitude":       lon,
        "current":         "pm2_5",
        "wind_speed_unit": "kmh",
        "forecast_days":   1,
    }
    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        return resp.json()["current"]["pm2_5"]
    except Exception:
        return np.nan

def _fetch_open_meteo_wind(lat: float, lon: float) -> float:
    """Fetch the most recent wind_speed_10m (km/h) from Open-Meteo for a coordinate."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude":        lat,
        "longitude":       lon,
        "current":         "wind_speed_10m",
        "wind_speed_unit": "kmh",
        "forecast_days":   1,
    }
    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        return resp.json()["current"]["wind_speed_10m"]
    except Exception:
        return np.nan

# ─────────────────────────────────────────────
# STEP 1 — InfluxDB: fetch sensor + neighbours
# ─────────────────────────────────────────────
def fetch_company_sensor_data(
    company_id: str,
    bucket: str,
    org: str,
    influx_client,
    pg_conn,
) -> dict | None:
    """
    Fetch aggregated sensor data for a given company_id.

    1. Fetches all sensor UUIDs, latitude, and longitude from PostgreSQL.
    2. Queries InfluxDB for the latest pm2_5 and pm10 per sensor.
    3. Returns averaged pm2_5 and pm10 across all sensors, with the
       timestamp broken into year/month/day/hour from the latest reading.

    Returns {
        "year": int, "month": int, "day": int, "hour": int,
        "latitude": float, "longitude": float,
        "pm2_5": float, "pm10": float,
    } or None if no sensors or no InfluxDB data found.
    """
    # Step 1: Fetch all sensor UUIDs and company location from PostgreSQL
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, latitude, longitude
            FROM sensor_registry
            WHERE company_id = %s
              AND status = 'active'
            """,
            (company_id,),
        )
        rows = cur.fetchall()

    if not rows:
        return None

    uuid_list      = [str(row[0]) for row in rows]
    comp_latitude  = float(rows[0][1])
    comp_longitude = float(rows[0][2])

    # Step 2: Query InfluxDB for latest pm2_5 and pm10 across all sensors
    uuid_filter = " or ".join(f'r.sensor_id == "{uid}"' for uid in uuid_list)

    flux = f'''
    from(bucket: "{bucket}")
      |> range(start: -60m)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> filter(fn: (r) => {uuid_filter})
      |> filter(fn: (r) => r._field == "pm2_5" or r._field == "pm10")
      |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
      |> sort(columns:["_time"], desc: true)
      |> limit(n: {len(uuid_list)})
    '''
    tables = influx_client.query_api().query(flux, org=org)

    pm25_values = []
    pm10_values = []
    latest_time = None

    for table in tables:
        for record in table.records:
            t = record.get_time()
            if latest_time is None or t > latest_time:
                latest_time = t

            pm25 = record.values.get("pm2_5")
            pm10 = record.values.get("pm10")
            if pm25 is not None:
                pm25_values.append(pm25)
            if pm10 is not None:
                pm10_values.append(pm10)

    if not pm25_values and not pm10_values:
        return None

    return {
        "year":      latest_time.year,
        "month":     latest_time.month,
        "day":       latest_time.day,
        "hour":      latest_time.hour,
        "latitude":  comp_latitude,
        "longitude": comp_longitude,
        "pm2_5":     float(np.mean(pm25_values)) if pm25_values else np.nan,
        "pm10":      float(np.mean(pm10_values)) if pm10_values else np.nan,
    }

def find_nearest_grid_points(sensor_lat: float, sensor_lon: float, n: int = N_NEIGHBORS + 1):
    """
    Given the sensor's coordinates, return the n closest grid points
    (including the grid point nearest to the sensor itself).
    Returns a list of (name, lat, lon) sorted by distance, closest first.
    """
    coords     = np.array([(lat, lon) for _, lat, lon in GRID_POINTS])
    names      = [name for name, _, _ in GRID_POINTS]
    tree       = cKDTree(coords)
    _, indices = tree.query([sensor_lat, sensor_lon], k=n)
    return [(names[i], coords[i][0], coords[i][1]) for i in indices]


def fetch_neighbour_pm_from_influx(
    neighbour_points: list,
    bucket: str,
    org: str,
    influx_client,
    pg_conn,
    sensor_data: dict,
    measurement: str = "air_quality",
) -> dict:
    """
    For each neighbour grid point, fetch the latest pm2_5 from InfluxDB,
    wind_speed_10m from Open-Meteo, and distance from the source sensor.

    1. Queries PostgreSQL to find active sensors within ±0.15° of each grid point.
    2. Uses sensor UUIDs to query InfluxDB for pm2_5.
    3. Fetches wind_speed_10m from Open-Meteo at the grid point coordinates.
    4. Computes haversine distance between the grid point and the source sensor
       (sensor_data["latitude"], sensor_data["longitude"]).

    Returns {grid_name: {"pm2_5": float, "wind_speed": float, "distance_km": float}}.
    Falls back to NaN if no data found for a grid point.
    """
    src_lat = sensor_data["latitude"]
    src_lon = sensor_data["longitude"]
    results = {}

    for name, lat, lon in neighbour_points:
        # Step 1: Find sensor UUIDs near this grid point from PostgreSQL
        with pg_conn.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM sensor_registry
                WHERE latitude  BETWEEN %s AND %s
                  AND longitude BETWEEN %s AND %s
                  AND status = 'active'
                """,
                (lat - 0.15, lat + 0.15, lon - 0.15, lon + 0.15),
            )
            rows = cur.fetchall()

        #pm25 = np.nan
        pm25 = _fetch_open_meteo_pm2_5(lat, lon)
        dist = _haversine_km(src_lat, src_lon, lat, lon)

        # Step 2: Fetch wind speed from Open-Meteo at the grid point
        wspd = _fetch_open_meteo_wind(lat, lon)

        if not rows:
            results[name] = {"pm2_5": pm25, "wind_speed": wspd, "distance_km": dist}
            continue

        # Step 3: Query InfluxDB for pm2_5 using sensor UUIDs
        uuid_list   = [str(row[0]) for row in rows]
        uuid_filter = " or ".join(f'r.sensor_id == "{uid}"' for uid in uuid_list)

        flux = f'''
        from(bucket: "{bucket}")
          |> range(start: -60m)
          |> filter(fn: (r) => r._measurement == "{measurement}")
          |> filter(fn: (r) => {uuid_filter})
          |> filter(fn: (r) => r._field == "pm2_5")
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
          |> sort(columns:["_time"], desc: true)
          |> limit(n: 1)
        '''
        tables = influx_client.query_api().query(flux, org=org)
        for table in tables:
            for record in table.records:
                #pm25 = record.values.get("pm2_5", np.nan)
                pm25 = _fetch_open_meteo_pm2_5(lat, lon)

        results[name] = {"pm2_5": pm25, "wind_speed": wspd, "distance_km": dist}

    return results


# ─────────────────────────────────────────────
# STEP 2 — Open-Meteo: fetch weather for all points
# ─────────────────────────────────────────────

def fetch_weather_for_points(points: list) -> dict:
    """
    Fetch current-hour weather for a list of (name, lat, lon) points
    using the Open-Meteo API.
    Returns {name: {variable: value}} for the latest available hour.
    """
    cache_session  = requests_cache.CachedSession(".cache", expire_after=300)
    retry_session  = retry(cache_session, retries=3, backoff_factor=0.3)
    om             = openmeteo_requests.Client(session=retry_session)

    results = {}
    for name, lat, lon in points:
        params = {
            "latitude":       lat,
            "longitude":      lon,
            "hourly":         WEATHER_VARS,
            "forecast_days":  1,
            "timezone":       "Asia/Bangkok",
        }
        try:
            responses = om.weather_api("https://api.open-meteo.com/v1/forecast", params=params)
            r         = responses[0]
            hourly    = r.Hourly()

            # Build a small DataFrame for this point, take the last row (most recent hour)
            hourly_data = {"time": pd.date_range(
                start   = pd.to_datetime(hourly.Time(),    unit="s", utc=True),
                end     = pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
                freq    = pd.Timedelta(seconds=hourly.Interval()),
                inclusive="left",
            )}
            for idx, var in enumerate(WEATHER_VARS):
                hourly_data[f"weather_{var}"] = hourly.Variables(idx).ValuesAsNumpy()

            point_df = pd.DataFrame(hourly_data).iloc[-1]   # latest hour
            results[name] = point_df.to_dict()

        except Exception as e:
            print(f"[weather] failed for {name} ({lat},{lon}): {e}", flush=True)
            results[name] = {f"weather_{v}": np.nan for v in WEATHER_VARS}

    return results


