FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir flask flask-cors ollama

COPY app.py knowledge_base.py ./

EXPOSE 5001
CMD ["python", "app.py"]
