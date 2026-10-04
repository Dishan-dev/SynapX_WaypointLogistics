FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN pip install --no-cache-dir .

RUN chmod +x docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
