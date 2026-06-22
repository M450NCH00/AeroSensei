# FROM python:3.9-slim

# WORKDIR /app

# # Install dependencies for InfluxDB and PostgreSQL
# RUN pip install influxdb-client psycopg2-binary

# COPY seeder.py .

# CMD ["python", "-u", "seeder.py"]

# Use a lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Ensure Python output is sent straight to terminal (Docker logs)
ENV PYTHONUNBUFFERED=1

# Set your timezone so working hours align with your local time
ENV TZ=Asia/Singapore 

# Install required system dependencies for psycopg2 (PostgreSQL)
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir psycopg2 influxdb-client

# Copy your script into the container
COPY sensor.py .

# Run the script
CMD ["python", "sensor.py"]