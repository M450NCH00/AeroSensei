#!/bin/bash
set -e

echo "Starting CSV import..."

# The Influx CLI is already authenticated automatically by the container's entrypoint.
# We use the bucket variable defined in the docker-compose file.
influx write --bucket "$DOCKER_INFLUXDB_INIT_BUCKET" --org "$DOCKER_INFLUXDB_INIT_ORG" --token "$DOCKER_INFLUXDB_INIT_ADMIN_TOKEN" --file /docker-entrypoint-initdb.d/sps30_mock_influx_uuids.csv
echo "CSV import complete!"