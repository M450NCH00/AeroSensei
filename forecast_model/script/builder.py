import pandas as pd
import numpy as np
from feature_eng import add_time_features, add_wind_features, add_spatial_features
from constants import GRID_POINTS

def assemble_raw_df(
    sensor_data:    dict,
    nearest_points: list,
    neighbour_pm:   dict,
    weather_by_point: dict,
) -> pd.DataFrame:
    """
    Combine sensor reading + neighbour PM data into a single-row DataFrame.

    sensor_data keys: year, month, day, hour, latitude, longitude, pm2_5, pm10
    nearest_points[0] is the grid point closest to the sensor ("self").
    nearest_points[1:] are the spatial neighbours, matched to neighbour_pm keys.
    neighbour_pm values: {pm2_5, wind_speed, distance_km}
    """
    self_name = nearest_points[0][0]

    row = {
        "time": pd.Timestamp(
            year=sensor_data["year"],
            month=sensor_data["month"],
            day=sensor_data["day"],
            hour=sensor_data["hour"],
        ),
        "location":  self_name,
        "latitude":  sensor_data["latitude"],
        "longitude": sensor_data["longitude"],
        "aq_pm2_5":  sensor_data["pm2_5"],
        "aq_pm10":   sensor_data["pm10"],
    }

    # Neighbour PM2.5, wind speed, and distance (neighbours are points 1…N)
    for rank, (nname, _nlat, _nlon) in enumerate(nearest_points[1:], start=1):
        nbr = neighbour_pm.get(nname, {})
        row[f"neighbor_{rank}_pm25"]    = nbr.get("pm2_5",       np.nan)
        row[f"neighbor_{rank}_wspd"]    = nbr.get("wind_speed",  np.nan)
        row[f"neighbor_{rank}_dist_km"] = nbr.get("distance_km", np.nan)

    # Distance-weighted average of neighbour PM2.5 as upwind_pm25 proxy
    weights, weighted_pm25 = [], []
    for r in range(1, len(nearest_points)):
        pm25    = row.get(f"neighbor_{r}_pm25",    np.nan)
        dist_km = row.get(f"neighbor_{r}_dist_km", np.nan)
        if not np.isnan(pm25) and not np.isnan(dist_km) and dist_km > 0:
            w = 1.0 / dist_km
            weights.append(w)
            weighted_pm25.append(w * pm25)

    row["upwind_pm25"] = float(np.sum(weighted_pm25) / np.sum(weights)) \
                         if weights else np.nan
    
    row["weather_temperature_2m"] = weather_by_point.get("weather_temperature_2m", np.nan)
    row["weather_relative_humidity_2m"] = weather_by_point.get("weather_relative_humidity_2m", np.nan)
    row["weather_dew_point_2m"] = weather_by_point.get("weather_dew_point_2m", np.nan)
    row["weather_apparent_temperature"] = weather_by_point.get("weather_apparent_temperature", np.nan)
    row["weather_precipitation"] = weather_by_point.get("weather_precipitation", np.nan)
    row["weather_rain"] = weather_by_point.get("weather_rain", np.nan)
    row["weather_surface_pressure"] = weather_by_point.get("weather_surface_pressure", np.nan)
    row["weather_wind_speed_10m"] = weather_by_point.get("weather_wind_speed_10m", np.nan)
    row["weather_wind_direction_10m"] = weather_by_point.get("weather_wind_direction_10m", np.nan)
    row["weather_wind_gusts_10m"] = weather_by_point.get("weather_wind_gusts_10m", np.nan)
    row["weather_boundary_layer_height"] = weather_by_point.get("weather_boundary_layer_height", np.nan)

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

    df.drop(columns=["hour","month","dayofyear","dayofweek"], inplace=True, errors="ignore")

    return df