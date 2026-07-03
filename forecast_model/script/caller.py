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

def _query_influx_with_fallback(influx_client, flux_template, org, windows=("-60m", "-24h", "-7d")):
    """Try progressively wider time windows until data is found."""
    for window in windows:
        flux = flux_template.format(window=window)
        tables = influx_client.query_api().query(flux, org=org)
        records = [r for t in tables for r in t.records]
        if records:
            return tables
    return []

def fetch_site_sensor_data(
    site_id: int,
    bucket: str,
    org: str,
    influx_client,
    pg_conn,
) -> dict | None:
    """
    Fetch aggregated sensor data for a given site_id.

    1. Fetches site latitude/longitude from company_sites.
    2. Fetches all active sensor UUIDs under that site from sensor_registry.
    3. Queries InfluxDB for the latest pm2_5 and pm10 per sensor.
    4. Returns averaged pm2_5/pm10 with timestamp from the latest reading.

    Returns {
        "year": int, "month": int, "day": int, "hour": int,
        "latitude": float, "longitude": float,
        "pm2_5": float, "pm10": float,
    } or None if no sensors or no InfluxDB data found.
    """
    # Step 1: Fetch site location from company_sites
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT latitude, longitude
            FROM company_sites
            WHERE id = %s
            """,
            (site_id,),
        )
        site_row = cur.fetchone()

    if site_row is None:
        return None

    site_latitude, site_longitude = float(site_row[0]), float(site_row[1])

    # Step 2: Fetch all active sensor UUIDs under this site
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM sensor_registry
            WHERE site_id = %s
              AND status = 'active'
            """,
            (site_id,),
        )
        rows = cur.fetchall()

    if not rows:
        return None

    uuid_list = [str(row[0]) for row in rows]

    # Step 3: Query InfluxDB for latest pm2_5 and pm10 across all sensors
    uuids_flux   = str(uuid_list).replace("'", '"')
    flux_template = f'''
    uuids = {uuids_flux}

    from(bucket: "{bucket}")
      |> range(start: {{window}})
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> filter(fn: (r) => contains(value: r.sensor_id, set: uuids))
      |> filter(fn: (r) => r._field == "pm2_5" or r._field == "pm10")
      |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
      |> sort(columns:["_time"], desc: true)
      |> limit(n: {len(uuid_list)})
    '''

    tables = _query_influx_with_fallback(influx_client, flux_template, org)

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
        "latitude":  site_latitude,
        "longitude": site_longitude,
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
                (float(lat) - 0.15, float(lat) + 0.15, float(lon) - 0.15, float(lon) + 0.15),
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

        # PRIMARY PERF FIX (the ~10-minute slowdown):
        # This block used to build a giant `sensor_id == "u1" or ... or "uN"` Flux
        # query over every sensor in the ±0.15° box (which now catches most of the
        # city's few-hundred sensors), then — for EACH returned record — call
        # Open-Meteo again with THIS grid point's own (lat, lon). That's hundreds of
        # identical network calls per grid point (4 grid points × ~280 sensors ≈
        # ~1,100 calls), which is what made this take ~10 minutes. `pm25` was already
        # fetched once above from Open-Meteo for this grid point, so the per-record
        # recompute was pure redundant work — it is removed here.
        #
        # (Deferred "better" fix, not done in this change: read the neighbours' real
        #  measured PM from InfluxDB with ONE aggregated query — record.values.get(
        #  "pm2_5") + `|> group() |> last()` — and shrink the ±0.15° box.)

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


