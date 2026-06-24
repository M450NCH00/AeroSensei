# Use a lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Ensure Python output is sent straight to terminal (Docker logs)
ENV PYTHONUNBUFFERED=1

# Set your timezone so working hours align with your local time
ENV TZ=Asia/Singapore

# Install Python packages
# (requests for the API calls, psycopg2-binary for PostgreSQL without needing GCC)
RUN pip install --no-cache-dir psycopg2-binary requests

# Copy your script into the container
COPY sensor.py .

# Run the script
CMD ["python", "sensor.py"]