"""AWS Lambda: AWS IoT Core -> InfluxDB writer.

Triggered by an AWS IoT Rule (see ../iot-rule.json) on the telemetry topic. The
rule SELECTs the device's JSON payload and invokes this function; the function
writes an `air_quality` point into InfluxDB with exactly the same measurement,
tags, and fields the on-prem sensors write directly (seeder/sensor.py and
hardware/esp32-sketch.ino). This keeps the existing InfluxDB alert task and the
Spring Boot dashboards working unchanged after the AWS IoT migration.

Expected event shape (one reading, as emitted by the ESP32 AWS sketch):
    {
        "sensor_id":    "<registry uuid>",
        "site_id":      "1",
        "site_name":    "VPBank Tower Hanoi",
        "pm1_0":  4.20, "pm2_5": 61.3, "pm4_0": 90.1, "pm10": 131.7, "nc0_5": 3100.0,
        "timestamp_ns": 1750000000000000000   # optional
    }

Environment variables:
    INFLUX_URL     e.g. https://<your-influx-host>:8086
    INFLUX_TOKEN   write token for the bucket
    INFLUX_ORG     e.g. my-org
    INFLUX_BUCKET  e.g. sensors_data
"""
import logging
import os

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("iot-to-influx")

INFLUX_URL = os.environ["INFLUX_URL"]
INFLUX_TOKEN = os.environ["INFLUX_TOKEN"]
INFLUX_ORG = os.environ["INFLUX_ORG"]
INFLUX_BUCKET = os.environ["INFLUX_BUCKET"]

# Reuse the client across warm invocations.
_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
_write_api = _client.write_api(write_options=SYNCHRONOUS)

_FIELDS = ("pm1_0", "pm2_5", "pm4_0", "pm10", "nc0_5")


def _build_point(reading: dict) -> Point:
    sensor_id = reading.get("sensor_id")
    if not sensor_id:
        raise ValueError("reading missing required 'sensor_id'")

    point = (
        Point("air_quality")
        .tag("sensor_id", str(sensor_id))
        .tag("site_id", str(reading.get("site_id", "")))
        .tag("site_name", str(reading.get("site_name", "")))
    )

    wrote_field = False
    for field in _FIELDS:
        value = reading.get(field)
        if value is not None:
            point.field(field, float(value))
            wrote_field = True
    if not wrote_field:
        raise ValueError("reading has no PM/NC fields to write")

    ts_ns = reading.get("timestamp_ns")
    if ts_ns is not None:
        point.time(int(ts_ns), WritePrecision.NS)
    # else: let InfluxDB stamp it at write time.

    return point


def handler(event, context):
    """IoT Rule invokes this with the message payload as the event.

    Supports either a single reading (dict) or a batch (list of dicts), so the
    same function works whether you route one message at a time or aggregate.
    """
    readings = event if isinstance(event, list) else [event]

    points = []
    for reading in readings:
        try:
            points.append(_build_point(reading))
        except (ValueError, TypeError) as e:
            # Don't fail the whole batch on one bad message; log and skip.
            log.warning("skipping bad reading %s: %s", reading, e)

    if not points:
        log.warning("no valid points in event; nothing written")
        return {"written": 0}

    _write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
    log.info("wrote %d point(s) to InfluxDB", len(points))
    return {"written": len(points)}
