import os
import json
import numpy as np
import pandas as pd
from constants import GRID_POINTS, N_NEIGHBORS, WEATHER_VARS, INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET
from constants import PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASS
from math_helper import _haversine_km
from model import ForecastModel
from feature_eng import add_time_features, add_wind_features, add_spatial_features, prepare_features
from caller import *
from builder import *

try:
    from influxdb_client import InfluxDBClient
except ImportError:
    InfluxDBClient = None

import psycopg2
from retry_requests import retry

def main(site_id: str):

    # ── config ───────────────────────────

    if InfluxDBClient is None:
        print(json.dumps({"error": "influxdb_client not installed"}))
        return
    if not all((INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET)):
        print(json.dumps({"error": "influx env vars not set"}))
        return

    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG, timeout = 120_000)

    conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            dbname=PG_DB,
            user=PG_USER,
            password=PG_PASS
        )

    # ── 1. sensor reading ───────────────────────
    sensor_data = fetch_site_sensor_data(
        site_id=site_id,
        bucket=INFLUX_BUCKET,
        org=INFLUX_ORG,
        influx_client=client,
        pg_conn=conn,
    )
    if sensor_data is None:
        print(json.dumps({"error": f"no recent data for site {site_id}"}))
        return
    else: 
        print("Extracted sensor data: ", sensor_data)

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
        INFLUX_BUCKET, INFLUX_ORG, client, conn, sensor_data
    )

    # ── 4. weather for ALL points (self + neighbours) ──
    weather_by_point = fetch_weather_for_points([nearest_points[0]])

    # ── 5. assemble raw df ──────────────────────
    raw_df = assemble_raw_df(
        sensor_data, nearest_points, neighbour_pm, weather_by_point
    )

    # ── 6. feature engineering ──────────────────
    feature_df = build_forecast_table(raw_df)
    X = prepare_features(feature_df)

    # ── 7. predict ──────────────────────────────
    result = None

    from collections import Counter
    dupes = [col for col, count in Counter(X.columns).items() if count > 1]
    print("Duplicate feature columns:", dupes)

    # ── load model ──────────────────────────────
    models= [ForecastModel(25,1), ForecastModel(25,3), ForecastModel(10,1), ForecastModel(10,3)]

    results = []

    for model in models:                 
        if hasattr(model, "predict"):
            try:
                result = model.predict(X)
                print("Predicted result: ", result)
                results.append(result)
            except Exception as e:
                print(f"[predict] error: {e}", flush=True)

    print(json.dumps({
        "site_id":  site_id,
        "latitude":   sensor_data["latitude"],
        "longitude":  sensor_data["longitude"],
        "pm2_5":      f"{sensor_data['pm2_5']:.3f}",
        "pm10":       f"{sensor_data['pm10']:.3f}",
        "prediction": None if not results else (
            [f"{float(r):.3f}" for r in results]
        ),
    }))


if __name__ == "__main__":
    import sys
    #sid = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SENSOR_ID")
    sid = 1
    if not sid:
        print(json.dumps({"error": "site_id required as argument or SITE_ID env var"}))
        sys.exit(1)
    main(sid)
