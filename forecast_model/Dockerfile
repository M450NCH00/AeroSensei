# Forecast model API (FastAPI + LightGBM/sklearn joblib bundles)
# numpy 2.5 / pandas 3.0 in requirements.txt require Python >= 3.12.
FROM python:3.12-slim

# libgomp1 is required at runtime by LightGBM.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1

# Install deps first for better layer caching.
COPY script/requirements.txt ./script/requirements.txt
RUN pip install --no-cache-dir -r script/requirements.txt

# The app code and the trained model bundles. ForecastModel loads
# "../model/..." relative to the CWD, so the app must run from /app/script
# with /app/model as its sibling — matching the local `cd script` layout.
COPY script ./script
COPY model ./model

WORKDIR /app/script

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
