FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends cron \
    && rm -rf /var/lib/apt/lists/*

COPY backup_to_s3.py /app/backup_to_s3.py
COPY cron-backup /etc/cron.d/backup_to_s3

RUN pip install --no-cache-dir boto3 influxdb-client \
    # Strip any CR (Windows CRLF) — a trailing \r silently breaks cron jobs on Linux.
    && sed -i 's/\r$//' /etc/cron.d/backup_to_s3 \
    && chmod 0644 /etc/cron.d/backup_to_s3 \
    && crontab /etc/cron.d/backup_to_s3 \
    && touch /var/log/cron.log

CMD ["sh", "-c", "env | grep -E 'INFLUX_|MINIO_|BUCKET_' > /etc/environment && cron -f"]