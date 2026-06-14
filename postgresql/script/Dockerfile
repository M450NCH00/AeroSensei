FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scrape_vietnam_companies.py .

CMD ["python3", "scrape_vietnam_companies.py"]
