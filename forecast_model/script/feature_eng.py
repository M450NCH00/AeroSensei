import pandas as pd
import numpy as np

def add_time_features(df):
    df = df.copy()

    df["time"] = pd.to_datetime(df["time"])
    df["hour"] = df["time"].dt.hour
    df["dayofweek"] = df["time"].dt.dayofweek
    df["dayofyear"] = df["time"].dt.dayofyear
    df["month"] = df["time"].dt.month

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    df["day_sin"] = np.sin(2 * np.pi * df["dayofweek"] / 7)
    df["day_cos"] = np.cos(2 * np.pi * df["dayofweek"] / 7)

    df["year_sin"] = np.sin(2 * np.pi * df["dayofyear"] / 365.25)
    df["year_cos"] = np.cos(2 * np.pi * df["dayofyear"] / 365.25)

    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

    return df


def add_wind_features(df):
    """
    Add wind direction sine/cosine and wind u/v components.

    This version is robust against None / missing / non-numeric values.
    """

    df = df.copy()

    for level in ["10m"]:
        speed_col = f"weather_wind_speed_{level}"
        dir_col = f"weather_wind_direction_{level}"

        if speed_col not in df.columns or dir_col not in df.columns:
            print(f"Skipping {level}: missing {speed_col} or {dir_col}")
            continue

        # Force both columns to become numeric.
        # Bad values such as None become NaN.
        speed = pd.to_numeric(df[speed_col], errors="coerce")
        direction = pd.to_numeric(df[dir_col], errors="coerce")

        # If wind speed is missing, keep it as NaN.
        # If wind direction is missing while wind speed is almost zero,
        # direction physically does not matter, so set it to 0.
        direction = direction.where(~direction.isna(), 0.0)

        theta = np.deg2rad(direction)

        df[f"weather_wind_dir_{level}_sin"] = np.sin(theta)
        df[f"weather_wind_dir_{level}_cos"] = np.cos(theta)

        # Meteorological direction = where wind comes FROM.
        df[f"weather_wind_u_{level}"] = -speed * np.sin(theta)
        df[f"weather_wind_v_{level}"] = -speed * np.cos(theta)

        # Also overwrite original columns with numeric versions
        df[speed_col] = speed
        df[dir_col] = direction

        # Sanity check after calling add_wind_features
        assert "weather_wind_u_10m" in df.columns, "u-component missing — check add_wind_features"
        assert "weather_wind_v_10m" in df.columns, "v-component missing — check add_wind_features"

    return df


def add_spatial_features(df):
    df = df.copy()

    earth_radius_km = 6371.0
    lat0 = df["latitude"].mean()
    lon0 = df["longitude"].mean()

    lat_rad = np.deg2rad(df["latitude"])
    lon_rad = np.deg2rad(df["longitude"])
    lat0_rad = np.deg2rad(lat0)
    lon0_rad = np.deg2rad(lon0)

    df["lat_km"] = earth_radius_km * (lat_rad - lat0_rad)
    df["lon_km"] = earth_radius_km * np.cos(lat0_rad) * (lon_rad - lon0_rad)

    # df["region"] = pd.cut(
    #     df["latitude"],
    #     bins=[0, 13.5, 17.5, 30],
    #     labels=["south", "central", "north"],
    # )

    return df


def add_lag_features(df, lag_hours=(1, 2, 3, 6, 12, 24, 48, 72, 168)):
    df = df.copy()
    df = df.sort_values(["location", "time"])

    lag_cols = [
        "aq_pm2_5",
        "aq_pm10",
        "weather_temperature_2m",
        "weather_relative_humidity_2m",
        "weather_precipitation",
        "weather_surface_pressure",
        "weather_wind_speed_10m",
        "weather_wind_gusts_10m",
        "weather_boundary_layer_height",
    ]

    lag_cols = [col for col in lag_cols if col in df.columns]

    for col in lag_cols:
        for lag in lag_hours:
            df[f"{col}_lag_{lag}h"] = df.groupby("location")[col].shift(lag)

    return df


def add_rolling_features(df, windows=(3, 6, 12, 24, 72, 168)):
    df = df.copy()
    df = df.sort_values(["location", "time"])

    rolling_cols = [
        "aq_pm2_5",
        "aq_pm10",
        "weather_temperature_2m",
        "weather_relative_humidity_2m",
        "weather_precipitation",
        "weather_surface_pressure",
        "weather_wind_speed_10m",
        "weather_wind_gusts_10m",
        "weather_boundary_layer_height",
    ]

    rolling_cols = [col for col in rolling_cols if col in df.columns]

    grouped = df.groupby("location", group_keys=False)

    for col in rolling_cols:
        for window in windows:
            shifted = grouped[col].shift(1)

            df[f"{col}_roll_mean_{window}h"] = (
                shifted.groupby(df["location"])
                .rolling(window, min_periods=max(2, window // 2))
                .mean()
                .reset_index(level=0, drop=True)
            )

            df[f"{col}_roll_std_{window}h"] = (
                shifted.groupby(df["location"])
                .rolling(window, min_periods=max(2, window // 2))
                .std()
                .reset_index(level=0, drop=True)
            )

            if col in ["aq_pm2_5", "aq_pm10"]:
                df[f"{col}_roll_min_{window}h"] = (
                    shifted.groupby(df["location"])
                    .rolling(window, min_periods=max(2, window // 2))
                    .min()
                    .reset_index(level=0, drop=True)
                )

                df[f"{col}_roll_max_{window}h"] = (
                    shifted.groupby(df["location"])
                    .rolling(window, min_periods=max(2, window // 2))
                    .max()
                    .reset_index(level=0, drop=True)
                )

    return df


def add_trend_features(df):
    df = df.copy()
    df = df.sort_values(["location", "time"])

    for pm_col in ["aq_pm2_5", "aq_pm10"]:
        if pm_col in df.columns:
            df[f"{pm_col}_diff_1h"] = (
                df[pm_col] - df.groupby("location")[pm_col].shift(1)
            )

            df[f"{pm_col}_diff_3h"] = (
                df[pm_col] - df.groupby("location")[pm_col].shift(3)
            )

            # df[f"{pm_col}_diff_24h"] = (
            #     df[pm_col] - df.groupby("location")[pm_col].shift(24)
            # )

            # df[f"{pm_col}_ratio_24h"] = (
            #     df[pm_col] / (df.groupby("location")[pm_col].shift(24) + 1e-6)
            # )

    return df


def add_future_targets(df, horizon_hours=6):
    df = df.copy()
    df = df.sort_values(["location", "time"])

    df[f"target_pm2_5_tplus_{horizon_hours}h"] = (
        df.groupby("location")["aq_pm2_5"].shift(-horizon_hours)
    )

    df[f"target_pm10_tplus_{horizon_hours}h"] = (
        df.groupby("location")["aq_pm10"].shift(-horizon_hours)
    )

    return df

def add_neighbor_features(df):
    """
    For each grid point and timestamp, join the PM2.5, wind speed, and
    wind u/v components from its spatial neighbours.
    Also computes a wind-weighted upwind_pm25 score.

    Requires columns: time, location, latitude, longitude,
                      aq_pm2_5, weather_wind_speed_10m,
                      weather_wind_u_10m, weather_wind_v_10m
    (weather_wind_u/v are produced by add_wind_features, so call that first)
    """
    df = df.copy()

    # Build a lookup: (time, lat, lon) -> pm2_5 and wind
    loc_meta = (
        df[["location", "latitude", "longitude"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )

    # Precompute all unique (lat, lon) pairs
    coords = loc_meta[["latitude", "longitude"]].values  # shape (N, 2)

    # For each location, find its neighbours (all other grid points,
    # sorted by distance — you can limit to the closest 4 or 8)
    from scipy.spatial import cKDTree
    import numpy as np

    tree = cKDTree(coords)
    # Query the 5 nearest points: index 0 is the point itself, 1-4 are neighbours
    distances, indices = tree.query(coords, k=min(5, len(coords)))

    # Map location index back to location name
    loc_names = loc_meta["location"].values

    # Pivot to wide format indexed by (time, location) for fast lookup
    pivot_pm25 = df.pivot_table(
        index="time", columns="location", values="aq_pm2_5", aggfunc="first"
    )
    pivot_wspd = df.pivot_table(
        index="time", columns="location", values="weather_wind_speed_10m", aggfunc="first"
    )
    pivot_u = df.pivot_table(
        index="time", columns="location", values="weather_wind_u_10m", aggfunc="first"
    )
    pivot_v = df.pivot_table(
        index="time", columns="location", values="weather_wind_v_10m", aggfunc="first"
    )
    # pivot_dir = df.pivot_table(
    #     index="time", columns="location", values="weather_wind_direction_10m", aggfunc="first"
    # )

    # Build neighbour columns per location
    neighbor_records = {}
    for i, loc in enumerate(loc_names):
        neighbor_indices = indices[i, 1:]   # skip index 0 (self)
        neighbor_locs = loc_names[neighbor_indices]
        neighbor_dists = distances[i, 1:]

        rec = {}
        for rank, (nloc, ndist) in enumerate(zip(neighbor_locs, neighbor_dists), start=1):
            rec[f"neighbor_{rank}_pm25"]  = pivot_pm25[nloc]  if nloc in pivot_pm25.columns  else np.nan
            rec[f"neighbor_{rank}_wspd"]  = pivot_wspd[nloc]  if nloc in pivot_wspd.columns  else np.nan
            rec[f"neighbor_{rank}_dist_km"] = ndist * 111.0   # rough degrees->km
            #rec[f"neighbor_{rank}_dir"] = pivot_dir[nloc] if nloc in pivot_dir.columns else np.nan

        neighbor_records[loc] = pd.DataFrame(rec, index=pivot_pm25.index)

    # Compute upwind_pm25: weight each neighbour's PM2.5 by alignment
    # with the current wind vector at the TARGET location.
    #
    # Alignment = dot(wind_unit_vector, direction_FROM_neighbour_to_center)
    # A neighbour directly upwind scores close to 1.0; crosswind scores 0.
    upwind_records = {}
    for i, loc in enumerate(loc_names):
        center_lat = loc_meta.loc[i, "latitude"]
        center_lon = loc_meta.loc[i, "longitude"]

        neighbor_indices = indices[i, 1:]
        neighbor_locs    = loc_names[neighbor_indices]

        # Wind vector at the target location (u, v already computed)
        u_series = pivot_u[loc] if loc in pivot_u.columns else pd.Series(np.nan, index=pivot_pm25.index)
        v_series = pivot_v[loc] if loc in pivot_v.columns else pd.Series(np.nan, index=pivot_pm25.index)
        wind_mag = np.sqrt(u_series**2 + v_series**2).replace(0, np.nan)

        weighted_pm25 = pd.Series(0.0, index=pivot_pm25.index)
        total_weight  = pd.Series(0.0, index=pivot_pm25.index)

        for nloc in neighbor_locs:
            nlat = loc_meta.loc[loc_names.tolist().index(nloc), "latitude"]
            nlon = loc_meta.loc[loc_names.tolist().index(nloc), "longitude"]

            # Unit vector FROM neighbour TO center (the direction pollution travels)
            dlat = center_lat - nlat
            dlon = center_lon - nlon
            dist = np.sqrt(dlat**2 + dlon**2) + 1e-9
            # Normalise to unit vector (in the same x-y space as u/v)
            dx = dlon / dist   # eastward component
            dy = dlat / dist   # northward component

            # Dot product with wind unit vector
            alignment = (u_series / wind_mag) * dx + (v_series / wind_mag) * dy
            weight = alignment.clip(lower=0)   # only upwind neighbours count

            nbr_pm25 = pivot_pm25[nloc] if nloc in pivot_pm25.columns else pd.Series(np.nan, index=pivot_pm25.index)
            weighted_pm25 += weight * nbr_pm25.fillna(0)
            total_weight  += weight

        upwind_pm25 = (weighted_pm25 / total_weight.replace(0, np.nan))
        upwind_records[loc] = upwind_pm25.rename("upwind_pm25")

    # Merge everything back onto df
    all_neighbor_dfs = []
    for loc in loc_names:
        mask = df["location"] == loc
        sub  = df.loc[mask, ["time"]].set_index("time")

        nbr_df = neighbor_records[loc].reindex(sub.index)
        nbr_df["upwind_pm25"] = upwind_records[loc].reindex(sub.index)
        nbr_df.index = df.loc[mask].index   # restore original row index

        all_neighbor_dfs.append(nbr_df)

    neighbor_all = pd.concat(all_neighbor_dfs).sort_index()
    df = pd.concat([df, neighbor_all], axis=1)
    return df

def build_training_table(raw_df, horizon_hours=6):
    df = raw_df.copy()

    df = add_time_features(df)
    df = add_wind_features(df)
    df = add_spatial_features(df)
    df = add_neighbor_features(df)
    #df = add_lag_features(df, lag_hours=(1, 3))
    #df = add_rolling_features(df, windows=(3, 6))
    #df = add_trend_features(df)
    df = add_future_targets(df, horizon_hours=horizon_hours)

    df = df.replace([np.inf, -np.inf], np.nan)
    df.fillna(method="ffill", inplace=True)
    df.drop(["dayofweek","dayofyear","month","hour"], axis=1, inplace=True)

    target_cols = [
        f"target_pm2_5_tplus_{horizon_hours}h",
        f"target_pm10_tplus_{horizon_hours}h",
    ]

    # Only drop rows where the targets are missing.
    # Do not drop rows just because one weather feature is missing.
    df = df.dropna(subset=target_cols).reset_index(drop=True)

    return df

def date_chunks(start_date, end_date, freq="3MS"):
    """
    Split a long date range into smaller chunks.

    freq:
        "MS"  = monthly
        "3MS" = every 3 months
        "6MS" = every 6 months
        "YS"  = yearly
    """

    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)

    chunk_starts = pd.date_range(start=start, end=end, freq=freq)

    if len(chunk_starts) == 0 or chunk_starts[0] != start:
        chunk_starts = chunk_starts.insert(0, start)

    chunks = []

    for i, chunk_start in enumerate(chunk_starts):
        if i + 1 < len(chunk_starts):
            chunk_end = chunk_starts[i + 1] - pd.Timedelta(days=1)
        else:
            chunk_end = end

        if chunk_end > end:
            chunk_end = end

        chunks.append((
            chunk_start.strftime("%Y-%m-%d"),
            chunk_end.strftime("%Y-%m-%d"),
        ))

    return chunks