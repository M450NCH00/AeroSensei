import requests
import json
import hashlib
import time
import pandas as pd
from constants import CACHE_DIR

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