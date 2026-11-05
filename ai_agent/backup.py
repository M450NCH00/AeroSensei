"""On-demand InfluxDB -> MinIO backup (powers the 'Backup now' button).

Mirrors the scheduled cron (s3/backup_to_s3.py) but runs inside the agent so the
Historical Data tab can trigger a backup for the current window (up to now) and
immediately see the new archive. Reuses the shared MinIO client from storage.py.
"""
from __future__ import annotations

import gzip
import logging
from datetime import datetime, timedelta, timezone

from influxdb_client import InfluxDBClient

import config
import storage

log = logging.getLogger("backup")

_BACKUP_PREFIX = "air_quality_backups/"


def run_backup(lookback_days: int | None = None) -> dict:
    """Extract the last `lookback_days` of air_quality data (up to now), gzip it,
    and upload to the backups bucket.

    Returns {status: "ok", key, name, size, start, end} on success, or
    {status: "empty"} when the window has no data.
    """
    days = lookback_days if lookback_days is not None else config.BACKUP_LOOKBACK_DAYS
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    # Flux range stop is exclusive — nudge past now so the latest points are kept.
    stop_iso = (now + timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

    flux = f'''
    from(bucket: "{config.INFLUX_BUCKET}")
        |> range(start: {start_iso}, stop: {stop_iso})
        |> filter(fn: (r) => r._measurement == "air_quality")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''

    client = InfluxDBClient(url=config.INFLUX_URL, token=config.INFLUX_TOKEN, org=config.INFLUX_ORG)
    try:
        raw = client.query_api().query_raw(flux).read()
    finally:
        client.close()

    text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw
    data_rows = [
        ln for ln in text.splitlines()
        if ln.strip() and not ln.startswith("#") and not ln.startswith(",result")
    ]
    if len(data_rows) <= 1:  # only the header row (or nothing)
        log.info("On-demand backup found no data in the last %s day(s).", days)
        return {"status": "empty"}

    name = (
        f"influx_backup_{start.strftime('%Y-%m-%d_%H%M')}"
        f"_to_{now.strftime('%Y-%m-%d_%H%M')}.csv.gz"
    )
    key = _BACKUP_PREFIX + name
    body = gzip.compress(text.encode("utf-8"))

    s3 = storage._s3()
    storage._ensure_bucket(s3, config.MINIO_BACKUPS_BUCKET)
    s3.put_object(Bucket=config.MINIO_BACKUPS_BUCKET, Key=key, Body=body)

    log.info("On-demand backup uploaded: %s (%d bytes)", key, len(body))
    return {
        "status": "ok",
        "key": key,
        "name": name,
        "size": len(body),
        "start": start_iso,
        "end": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
