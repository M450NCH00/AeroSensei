#!/bin/sh
# Idempotent: safe to run on every `docker compose up`.
set -e

# Stash the ai-agent's internal shared secret in InfluxDB's secret store so the
# Flux task script doesn't need to hardcode it in plain text.
influx secret update --org "$INFLUX_ORG" --host "$INFLUX_URL" --token "$INFLUX_TOKEN" \
  --key INTERNAL_ALERT_SECRET --value "$INTERNAL_API_SECRET"

if influx task list --org "$INFLUX_ORG" --host "$INFLUX_URL" --token "$INFLUX_TOKEN" | grep -q "pm-realtime-alert"; then
  echo "Task pm-realtime-alert already exists, skipping."
else
  influx task create -f /tasks/pm_alert_task.flux --org "$INFLUX_ORG" --host "$INFLUX_URL" --token "$INFLUX_TOKEN"
  echo "Task pm-realtime-alert created."
fi
