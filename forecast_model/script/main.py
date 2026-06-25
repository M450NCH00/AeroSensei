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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json, os, sys
from collections import Counter

app = FastAPI()

# Allow your Next.js dev server (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/predict/{site_id}")
def predict(site_id: str):
    if InfluxDBClient is None:
        raise HTTPException(500, "influxdb_client not installed")
    if not all((INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET)):
        raise HTTPException(500, "influx env vars not set")

    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG, timeout=120_000)
    conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, dbname=PG_DB,
        user=PG_USER, password=PG_PASS
    )

    sensor_data = fetch_site_sensor_data(
        site_id=site_id,
        bucket=INFLUX_BUCKET, org=INFLUX_ORG,
        influx_client=client, pg_conn=conn,
    )
    if sensor_data is None:
        raise HTTPException(404, f"no recent data for site {site_id}")

    nearest_points = find_nearest_grid_points(
        sensor_data["latitude"], sensor_data["longitude"], n=N_NEIGHBORS + 1
    )
    neighbour_pm = fetch_neighbour_pm_from_influx(
        nearest_points[1:], INFLUX_BUCKET, INFLUX_ORG, client, conn, sensor_data
    )
    weather_by_point = fetch_weather_for_points([nearest_points[0]])
    raw_df = assemble_raw_df(sensor_data, nearest_points, neighbour_pm, weather_by_point)
    feature_df = build_forecast_table(raw_df)
    X = prepare_features(feature_df)

    models = [ForecastModel(25, 1), ForecastModel(25, 3), ForecastModel(10, 1), ForecastModel(10, 3)]
    results = []
    for model in models:
        if hasattr(model, "predict"):
            try:
                results.append(model.predict(X))
            except Exception as e:
                print(f"[predict] error: {e}", flush=True)

    return {
        "site_id": site_id,
        "latitude":   sensor_data["latitude"],
        "longitude":  sensor_data["longitude"],
        "pm2_5":      f"{sensor_data['pm2_5']:.3f}",
        "pm10":       f"{sensor_data['pm10']:.3f}",
        "prediction": [f"{float(r):.3f}" for r in results] if results else None,
    }