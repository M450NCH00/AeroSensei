FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py agent.py config.py auth.py tools.py knowledge_base.py skills.py research.py reporting.py report_standards.py storage.py ./
COPY providers ./providers

EXPOSE 5001
CMD ["python", "app.py"]
