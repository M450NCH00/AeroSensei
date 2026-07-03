#!/bin/sh
# Idempotent: safe to run on every `docker compose up`.
set -e

# Stash the ai-agent's internal shared secret in InfluxDB's secret store so the
# Flux task script doesn't need to hardcode it in plain text.
influx secret update --org "$INFLUX_ORG" --host "$INFLUX_URL" --token "$INFLUX_TOKEN" \
  --key INTERNAL_ALERT_SECRET --value "$INTERNAL_API_SECRET"

# Create the task if missing, otherwise UPDATE it in place so edits to the flux
# (e.g. the `every:` schedule) are actually applied on redeploy.
TASK_ID=$(influx task list --org "$INFLUX_ORG" --host "$INFLUX_URL" --token "$INFLUX_TOKEN" \
  | grep "pm-realtime-alert" | awk '{print $1}')
if [ -n "$TASK_ID" ]; then
  influx task update --id "$TASK_ID" -f /tasks/pm_alert_task.flux \
    --host "$INFLUX_URL" --token "$INFLUX_TOKEN"
  echo "Task pm-realtime-alert updated (id $TASK_ID)."
else
  influx task create -f /tasks/pm_alert_task.flux --org "$INFLUX_ORG" --host "$INFLUX_URL" --token "$INFLUX_TOKEN"
  echo "Task pm-realtime-alert created."
fi
