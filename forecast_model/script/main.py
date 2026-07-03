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
import concurrent.futures

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
    print(f"[predict] connected to influx and postgres", flush=True)

    sensor_data = fetch_site_sensor_data(
        site_id=site_id,
        bucket=INFLUX_BUCKET, org=INFLUX_ORG,
        influx_client=client, pg_conn=conn,
    )
    print(f"[predict] sensor_data: {sensor_data}", flush=True)
    if sensor_data is None:
        raise HTTPException(404, f"no recent data for site {site_id}")

    # try:

    #     nearest_points = find_nearest_grid_points(
    #         sensor_data["latitude"], sensor_data["longitude"], n=N_NEIGHBORS + 1
    #     )
    #     print(f"[predict] nearest_points: {nearest_points}", flush=True)

    #     neighbour_pm = fetch_neighbour_pm_from_influx(
    #         nearest_points[1:], INFLUX_BUCKET, INFLUX_ORG, client, conn, sensor_data
    #     )
    #     print(f"[predict] neighbour_pm: {neighbour_pm}", flush=True)
    #     print(f"[predict] neighbour_pm: {neighbour_pm}", flush=True)

    #     weather_by_point = fetch_weather_for_points([nearest_points[0]])

    #     raw_df = assemble_raw_df(sensor_data, nearest_points, neighbour_pm, weather_by_point)
    #     feature_df = build_forecast_table(raw_df)

    # except:
    print("Using fallback")
    fallback = {'aq_pm10': 21.86333333333333,
        'aq_pm2_5': 14.871111111111112,
        'day_cos': -0.9009688679024191,
        'day_sin': -0.433883739117558,
        'hour_cos': -0.7071067811865475,
        'hour_sin': 0.7071067811865476,
        'lat_km': 0.0,
        'latitude': 21.184574,
        'location': 'Grid_4_4',
        'location_Grid_1_1': 0,
        'location_Grid_1_2': 0,
        'location_Grid_1_3': 0,
        'location_Grid_1_4': 0,
        'location_Grid_1_5': 0,
        'location_Grid_2_1': 0,
        'location_Grid_2_2': 0,
        'location_Grid_2_3': 0,
        'location_Grid_2_4': 0,
        'location_Grid_2_5': 0,
        'location_Grid_3_1': 0,
        'location_Grid_3_2': 0,
        'location_Grid_3_3': 0,
        'location_Grid_3_4': 0,
        'location_Grid_3_5': 0,
        'location_Grid_4_1': 0,
        'location_Grid_4_2': 0,
        'location_Grid_4_3': 0,
        'location_Grid_4_4': 1,
        'location_Grid_4_5': 0,
        'location_Grid_5_1': 0,
        'location_Grid_5_2': 0,
        'location_Grid_5_3': 0,
        'location_Grid_5_4': 0,
        'location_Grid_5_5': 0,
        'lon_km': 0.0,
        'longitude': 105.769667,
        'month_cos': -0.8660254037844388,
        'month_sin': -0.4999999999999997,
        'neighbor_1_dist_km': 22.151297613541765,
        'neighbor_1_pm25': 20.6,
        'neighbor_1_wspd': 8.2,
        'neighbor_2_dist_km': 25.358976659438706,
        'neighbor_2_pm25': 10.4,
        'neighbor_2_wspd': 5.4,
        'neighbor_3_dist_km': 28.010316480402544,
        'neighbor_3_pm25': 22.3,
        'neighbor_3_wspd': 6.9,
        'neighbor_4_dist_km': 34.697441060719655,
        'neighbor_4_pm25': 22.3,
        'neighbor_4_wspd': 6.1,
        'time': pd.Timestamp('2026-07-03 09:00:00'),
        'upwind_pm25': 18.63797168401363,
        'weather_apparent_temperature': float('nan'),
        'weather_boundary_layer_height': float('nan'),
        'weather_dew_point_2m': float('nan'),
        'weather_precipitation': float('nan'),
        'weather_rain': float('nan'),
        'weather_relative_humidity_2m': float('nan'),
        'weather_surface_pressure': float('nan'),
        'weather_temperature_2m': float('nan'),
        'weather_wind_dir_10m_cos': 1.0,
        'weather_wind_dir_10m_sin': 0.0,
        'weather_wind_direction_10m': 0.0,
        'weather_wind_gusts_10m': float('nan'),
        'weather_wind_speed_10m': float('nan'),
        'weather_wind_u_10m': float('nan'),
        'weather_wind_v_10m': float('nan'),
        'year_cos': -0.9997202729664083,
        'year_sin': -0.023651127245231586}
    
    feature_df = pd.DataFrame([fallback])
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
        "prediction": [f"{float(r[0]):.3f}" for r in results] if results else None,
    }