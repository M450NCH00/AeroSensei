from pathlib import Path
import numpy as np
# ============================================================
# Data Extract Variables
# ============================================================

# Hanoi bounding box — covers all 5 HN zones plus upwind buffer
LAT_MIN, LAT_MAX = 20.6, 21.4   # N–S extent of Hanoi + margin
LON_MIN, LON_MAX = 104.8, 106.2  # W–E, extra buffer westward (dry season NNW source)

lats = np.round(np.linspace(LAT_MIN, LAT_MAX, 5), 2)  # [20.6, 20.8, 21.0, 21.2, 21.4]
lons = np.round(np.linspace(LON_MIN, LON_MAX, 5), 2)  # [104.8, 105.15, 105.5, 105.85, 106.2]

GRID_POINTS = [(f"Grid_{i+1}_{j+1}", lat, lon) for i, lat in enumerate(lats) for j, lon in enumerate(lons)]

VIETNAM_LOCATIONS = [
    ("Hanoi", 21.0200, 105.8400)
]

AIR_QUALITY_VARS = [
    "pm2_5",
    "pm10"
]

WEATHER_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "surface_pressure",
    #"visibility",
    "wind_speed_10m",
    #"wind_speed_80m",
    #"wind_speed_120m",
    "wind_direction_10m",
    #"wind_direction_80m",
    #"wind_direction_120m",
    "wind_gusts_10m",
    "boundary_layer_height",
]

# Temporal features to engineer from the timestamp
TEMP_FEATURES = [
    "hour",                        # peak PM2.5 at 4–7pm (Jan–May), varies by month
    "day_of_week",                 # weekday vs weekend (Sunday highest)
    "is_weekend",                  # boolean — paper shows Sundays reach 163.95 µg/m³
    "month",                       # dry season (Nov–Apr) vs wet (May–Oct)
    "is_dry_season",               # boolean — dry: 51.3–63.7 vs wet: 30.45–39.67 µg/m³
    "hour_sin", "hour_cos",        # cyclic encoding for hour of day
    "month_sin", "month_cos"       # cyclic encoding for month of year
]

CACHE_DIR = Path("open_meteo_cache")
START_DATE = "2025-06-01"
END_DATE = "2026-06-01"
OUTPUT_DIR = Path("data")

#HORIZONS = [1, 3, 6, 12, 24]
HORIZONS = [1]  # For testing, just do 1-hour ahead
N_NEIGHBORS = 4