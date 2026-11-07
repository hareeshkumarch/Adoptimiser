FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 appgroup \
    && useradd -u 10001 -g appgroup -m -s /sbin/nologin appuser

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
RUN chown -R appuser:appgroup /app

USER appuser
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "75"]
