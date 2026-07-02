# Use a lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Ensure Python output is sent straight to terminal (Docker logs)
ENV PYTHONUNBUFFERED=1

# Set your timezone so working hours align with your local time
ENV TZ=Asia/Singapore

# Install Python packages
# (psycopg2-binary for PostgreSQL without needing GCC, influxdb-client to write
# sensor readings directly into InfluxDB)
RUN pip install --no-cache-dir psycopg2-binary influxdb-client

# Copy your script into the container
COPY sensor.py .

# Run the script
CMD ["python", "sensor.py"]