FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY Middleware_UDP.py .

CMD ["python3", "Middleware_UDP.py"]