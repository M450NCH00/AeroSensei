// Real-time PM2.5/PM10 breach alerting, running natively inside InfluxDB.
//
// Every 20 seconds, average each site's last 5 minutes of air_quality readings
// and — if a site is over threshold — POST straight to the ai-agent's /alert
// endpoint (same payload shape the old backend SlidingWindowService sent).
// The ai-agent composes the Telegram message and forwards it; nothing else in
// this stack is involved. Re-checking every 20 seconds without extra state
// means a still-breached site keeps getting re-alerted at that cadence.
import "http"
import "json"
import "math"
import "influxdata/influxdb/secrets"

option task = {name: "pm-realtime-alert", every: 20s}

alertSecret = secrets.get(key: "INTERNAL_ALERT_SECRET")

pm25Threshold = 55.0
pm10Threshold = 120.0

sendAlert = (siteId, siteName, pmType, measured, threshold) =>
    http.post(
        url: "http://ai-agent:5001/alert",
        headers: {"Content-Type": "application/json", "X-Internal-Secret": alertSecret},
        data: json.encode(v: {
            sensor_id: "SITE-" + siteId,
            site_name: siteName,
            pm_type: pmType,
            measured_value: measured,
            threshold_value: threshold,
            alert_level: "critical",
        }),
    )

from(bucket: "sensors_data")
    |> range(start: -5m)
    |> filter(fn: (r) => r._measurement == "air_quality")
    |> filter(fn: (r) => r._field == "pm2_5" or r._field == "pm10")
    |> group(columns: ["site_id", "site_name", "_field"])
    |> mean()
    |> filter(fn: (r) =>
        (r._field == "pm2_5" and r._value > pm25Threshold) or
        (r._field == "pm10" and r._value > pm10Threshold))
    |> map(fn: (r) => ({r with _status: sendAlert(
            siteId: string(v: r.site_id),
            siteName: r.site_name,
            pmType: r._field,
            measured: math.round(x: r._value * 100.0) / 100.0,
            threshold: if r._field == "pm2_5" then pm25Threshold else pm10Threshold,
        )}))
