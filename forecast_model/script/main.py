import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from scipy.spatial import cKDTree
from constants import GRID_POINTS, N_NEIGHBORS, WEATHER_VARIABLES
from model import ForecastModel
from feature_eng import add_time_features, add_wind_features, add_spatial_features

try:
    from influxdb_client import InfluxDBClient
except ImportError:
    InfluxDBClient = None

import openmeteo_requests
import requests_cache
from retry_requests import retry

# ─────────────────────────────────────────────
# STEP 1 — InfluxDB: fetch sensor + neighbours
# ─────────────────────────────────────────────

def fetch_sensor_data(sensor_id: str, bucket: str, org: str, client) -> dict | None:
    """
    Fetch the latest reading for a specific sensor_id from InfluxDB.
    Returns a dict with time, pm2_5, pm10, latitude, longitude.
    """
    flux = f'''
    from(bucket: "{bucket}")
      |> range(start: -60m)
      |> filter(fn: (r) => r._measurement == "air_quality")
      |> filter(fn: (r) => r.sensor_id == "{sensor_id}")
      |> pivot(
            rowKey:["_time"],
            columnKey: ["_field"],
            valueColumn: "_value"
         )
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
    '''
    tables = client.query_api().query(flux, org=org)
    for table in tables:
        for record in table.records:
            return {
                "time":      record.get_time(),
                "pm2_5":     record.values.get("pm2_5"),
                "pm10":      record.values.get("pm10"),
                "sensor_id": record.values.get("sensor_id"),
                "latitude":  float(record.values.get("latitude")),
                "longitude": float(record.values.get("longitude")),
            }
    return None


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
    client,
    measurement: str = "air_quality",
) -> dict:
    """
    For each neighbour grid point, fetch the latest pm2_5 and wind_speed
    from InfluxDB (sensors nearest to those grid coordinates).
    Returns {grid_name: {"pm2_5": float, "wind_speed": float}}.

    Falls back to NaN if no data found for a grid point.
    """
    results = {}
    for name, lat, lon in neighbour_points:
        # Query the sensor geographically closest to this grid point.
        # Tolerance of ±0.15 degrees (~15 km) to catch the nearest real sensor.
        flux = f'''
        from(bucket: "{bucket}")
          |> range(start: -60m)
          |> filter(fn: (r) => r._measurement == "{measurement}")
          |> filter(fn: (r) => float(v: r.latitude)  >= {lat  - 0.15}
                            and float(v: r.latitude)  <= {lat  + 0.15}
                            and float(v: r.longitude) >= {lon  - 0.15}
                            and float(v: r.longitude) <= {lon  + 0.15})
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
          |> sort(columns:["_time"], desc: true)
          |> limit(n: 1)
        '''
        tables = client.query_api().query(flux, org=org)
        pm25  = np.nan
        wspd  = np.nan
        for table in tables:
            for record in table.records:
                pm25 = record.values.get("pm2_5",      np.nan)
                wspd = record.values.get("wind_speed", np.nan)
        results[name] = {"pm2_5": pm25, "wind_speed": wspd}
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
            "hourly":         WEATHER_VARIABLES,
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
            for idx, var in enumerate(WEATHER_VARIABLES):
                hourly_data[f"weather_{var}"] = hourly.Variables(idx).ValuesAsNumpy()

            point_df = pd.DataFrame(hourly_data).iloc[-1]   # latest hour
            results[name] = point_df.to_dict()

        except Exception as e:
            print(f"[weather] failed for {name} ({lat},{lon}): {e}", flush=True)
            results[name] = {f"weather_{v}": np.nan for v in WEATHER_VARIABLES}

    return results


# ─────────────────────────────────────────────
# STEP 3 — Assemble the raw DataFrame
# ─────────────────────────────────────────────

def assemble_raw_df(
    sensor_data:      dict,
    nearest_points:   list,
    neighbour_pm:     dict,
    weather_by_point: dict,
) -> pd.DataFrame:
    """
    Combine sensor reading + weather into a single-row DataFrame
    that matches the schema expected by build_forecast_table().

    nearest_points[0] is the grid point closest to the sensor (the "self" point).
    nearest_points[1:] are the spatial neighbours.
    """
    self_name = nearest_points[0][0]
    weather   = weather_by_point.get(self_name, {})

    row = {
        "time":      pd.to_datetime(sensor_data["time"]).tz_localize(None)
                     if pd.to_datetime(sensor_data["time"]).tzinfo is None
                     else pd.to_datetime(sensor_data["time"]).tz_convert(None),
        "location":  self_name,
        "latitude":  sensor_data["latitude"],
        "longitude": sensor_data["longitude"],
        "aq_pm2_5":  sensor_data["pm2_5"],
        "aq_pm10":   sensor_data["pm10"],
    }

    # Weather variables for the sensor's own grid point
    for var in WEATHER_VARIABLES:
        row[f"weather_{var}"] = weather.get(f"weather_{var}", np.nan)

    # Neighbour PM2.5, wind speed, and distance (neighbours are points 1…N)
    for rank, (nname, nlat, nlon) in enumerate(nearest_points[1:], start=1):
        nbr_data  = neighbour_pm.get(nname, {})
        nbr_weather = weather_by_point.get(nname, {})
        dist_km   = (
            np.sqrt(
                ((nlat - sensor_data["latitude"])  * 111.0) ** 2 +
                ((nlon - sensor_data["longitude"]) * 111.0
                 * np.cos(np.deg2rad(sensor_data["latitude"]))) ** 2
            )
        )
        row[f"neighbor_{rank}_pm25"]     = nbr_data.get("pm2_5",      np.nan)
        row[f"neighbor_{rank}_wspd"]     = nbr_weather.get("weather_wind_speed_10m",
                                            nbr_data.get("wind_speed", np.nan))
        row[f"neighbor_{rank}_dist_km"]  = dist_km

    # upwind_pm25 — wind-weighted average of neighbour PM2.5
    # Uses the sensor's own wind u/v, computed later in add_wind_features,
    # so we approximate here with a simple distance-weighted mean and
    # let add_neighbor_features recompute the proper value if needed.
    nbr_pm25_vals = [
        row[f"neighbor_{r}_pm25"]
        for r in range(1, N_NEIGHBORS + 1)
        if not np.isnan(row.get(f"neighbor_{r}_pm25", np.nan))
    ]
    row["upwind_pm25"] = float(np.nanmean(nbr_pm25_vals)) if nbr_pm25_vals else np.nan

    return pd.DataFrame([row])


# ─────────────────────────────────────────────
# STEP 4 — build_forecast_table (slim pipeline)
# ─────────────────────────────────────────────

def build_forecast_table(df: pd.DataFrame) -> pd.DataFrame:
    """
    Applies only the feature-engineering steps that are safe for a
    single-row inference DataFrame (no lag/rolling — those need history).
    One-hot encodes location against the full 25-point grid.
    """
    df = df.copy()
    df["time"] = pd.to_datetime(df["time"])

    df = add_time_features(df)
    df = add_wind_features(df)
    df = add_spatial_features(df)

    # One-hot encode location against all known grid points
    all_locations = [name for name, _, _ in GRID_POINTS]
    for loc in all_locations:
        df[f"location_{loc}"] = (df["location"] == loc).astype(int)

    return df


# ─────────────────────────────────────────────
# STEP 5 — main
# ─────────────────────────────────────────────

def main(sensor_id: str):
    # ── load model ──────────────────────────────
    model = ForecastModel()

    # ── influx config ───────────────────────────
    INFLUX_URL    = os.environ.get("INFLUX_URL")
    INFLUX_TOKEN  = os.environ.get("INFLUX_TOKEN")
    INFLUX_ORG    = os.environ.get("INFLUX_ORG")
    INFLUX_BUCKET = os.environ.get("INFLUX_BUCKET")

    if InfluxDBClient is None:
        print(json.dumps({"error": "influxdb_client not installed"}))
        return
    if not all((INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET)):
        print(json.dumps({"error": "influx env vars not set"}))
        return

    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

    # ── 1. sensor reading ───────────────────────
    sensor_data = fetch_sensor_data(sensor_id, INFLUX_BUCKET, INFLUX_ORG, client)
    if sensor_data is None:
        print(json.dumps({"error": f"no recent data for sensor {sensor_id}"}))
        return

    # ── 2. find nearest grid points ─────────────
    # Returns N_NEIGHBORS+1 points: index 0 = self, 1..N = neighbours
    nearest_points = find_nearest_grid_points(
        sensor_data["latitude"],
        sensor_data["longitude"],
        n=N_NEIGHBORS + 1,
    )

    # ── 3. neighbour PM from InfluxDB ───────────
    neighbour_pm = fetch_neighbour_pm_from_influx(
        nearest_points[1:],          # skip self
        INFLUX_BUCKET, INFLUX_ORG, client,
    )

    # ── 4. weather for ALL points (self + neighbours) ──
    weather_by_point = fetch_weather_for_points(nearest_points)

    # ── 5. assemble raw df ──────────────────────
    raw_df = assemble_raw_df(
        sensor_data, nearest_points, neighbour_pm, weather_by_point
    )

    # ── 6. feature engineering ──────────────────
    feature_df = build_forecast_table(raw_df)
    X = model.prepare_features(feature_df)

    # ── 7. predict ──────────────────────────────
    result = None
    if hasattr(model, "predict"):
        try:
            result = model.predict(X)
        except Exception as e:
            print(f"[predict] error: {e}", flush=True)

    print(json.dumps({
        "timestamp":  sensor_data["time"].isoformat()
                      if hasattr(sensor_data["time"], "isoformat")
                      else str(sensor_data["time"]),
        "sensor_id":  sensor_id,
        "latitude":   sensor_data["latitude"],
        "longitude":  sensor_data["longitude"],
        "pm2_5":      sensor_data["pm2_5"],
        "pm10":       sensor_data["pm10"],
        "prediction": None if result is None else (
            result.tolist() if hasattr(result, "tolist") else result
        ),
    }))


if __name__ == "__main__":
    import sys
    sid = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SENSOR_ID")
    if not sid:
        print(json.dumps({"error": "sensor_id required as argument or SENSOR_ID env var"}))
        sys.exit(1)
    main(sid)