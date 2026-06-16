FROM python:3.9-slim

WORKDIR /app

# Install dependencies for InfluxDB and PostgreSQL
RUN pip install influxdb-client psycopg2-binary

COPY seeder.py .

CMD ["python", "-u", "seeder.py"]