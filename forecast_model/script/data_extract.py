import time
import pandas as pd
from feature_eng import *
from caller import *
from constants import *
import argparse

parser = argparse.ArgumentParser(description="A sample script to accept arguments.")
parser.add_argument("--hr", type=int, default=1, help="Forecast horizon in hours (1, 3, 6, 12 or 24)")
args = parser.parse_args()

def fetch_air_quality(location_name, lat, lon, start_date, end_date):
    """
    Fetch PM2.5, PM10, AQI, AOD, and dust from Open-Meteo Air Quality API.
    """

    url = "https://air-quality-api.open-meteo.com/v1/air-quality"

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(AIR_QUALITY_VARS),
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "Asia/Ho_Chi_Minh",
        "domains": "cams_global",
    }

    data = call_open_meteo(url, params)

    return hourly_json_to_dataframe(
        data,
        location_name,
        lat,
        lon,
        prefix="aq",
    )

def fetch_air_quality(location_name, lat, lon, start_date, end_date):
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(AIR_QUALITY_VARS),
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "Asia/Ho_Chi_Minh",
        "domains": "cams_global",
    }

    data = call_open_meteo(url, params)

    return hourly_json_to_dataframe(
        data,
        location_name,
        lat,
        lon,
        prefix="aq",
    )


def fetch_weather_archive(location_name, lat, lon, start_date, end_date):
    url = "https://archive-api.open-meteo.com/v1/archive"

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(WEATHER_VARS),
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "Asia/Ho_Chi_Minh",
        "wind_speed_unit": "ms",
    }

    data = call_open_meteo(url, params)

    return hourly_json_to_dataframe(
        data,
        location_name,
        lat,
        lon,
        prefix="weather",
    )

def build_raw_dataset(
    start_date,
    end_date,
    chunk_freq="3MS",
    sleep_between_requests=3,
):
    all_chunks = []

    chunks = date_chunks(start_date, end_date, freq=chunk_freq)

    for name, lat, lon in GRID_POINTS:
        print(f"\n=== Downloading {name} ===")

        location_chunks = []

        for chunk_start, chunk_end in chunks:
            print(f"{name}: {chunk_start} to {chunk_end}")

            try:
                aq_df = fetch_air_quality(
                    name,
                    lat,
                    lon,
                    chunk_start,
                    chunk_end,
                )

                time.sleep(sleep_between_requests)

                weather_df = fetch_weather_archive(
                    name,
                    lat,
                    lon,
                    chunk_start,
                    chunk_end,
                )

                time.sleep(sleep_between_requests)

                merged = pd.merge(
                    aq_df,
                    weather_df,
                    on=["time", "location", "latitude", "longitude"],
                    how="inner",
                )

                location_chunks.append(merged)

            except Exception as e:
                print(f"Failed for {name}, {chunk_start} to {chunk_end}")
                print("Error:", e)

                # Continue instead of killing the whole download
                continue

        if len(location_chunks) > 0:
            location_df = pd.concat(location_chunks, ignore_index=True)
            all_chunks.append(location_df)
        else:
            print(f"No data downloaded for {name}")

    if len(all_chunks) == 0:
        raise RuntimeError("No data was downloaded.")

    full_df = pd.concat(all_chunks, ignore_index=True)

    full_df = (
        full_df
        .drop_duplicates(subset=["time", "location"])
        .sort_values(["location", "time"])
        .reset_index(drop=True)
    )

    return full_df

if __name__ == "__main__":

#     raw_df = build_raw_dataset(
#       start_date=START_DATE,
#       end_date=END_DATE,
#       chunk_freq="3MS",              # safer than one huge request
#       sleep_between_requests=3,      # increase to 5 or 10 if still rate-limited
#   )

#     OUTPUT_DIR.mkdir(exist_ok=True)

#     raw_df.to_csv(
#         OUTPUT_DIR / "vietnam_open_meteo_raw.csv",
#         index=False,
#     )
    raw_df = pd.read_csv(OUTPUT_DIR / "vietnam_open_meteo_raw.csv")
    for horizon in HORIZONS:
        training_df = build_training_table(
            raw_df,
            horizon_hours=horizon,
        )

        training_df.to_csv(
            OUTPUT_DIR / f"vietnam_training_table_{horizon}h_long.csv",
            index=False,
        )

        print(f"Saved horizon {horizon}h:", training_df.shape)

