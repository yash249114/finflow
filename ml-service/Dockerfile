# ml-service/Dockerfile
# Multi-stage build to minimize attack surface in runtime image
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim

RUN addgroup --system --gid 1001 mluser && \
    adduser --system --uid 1001 mluser

WORKDIR /app

# Copy only installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=mluser:mluser . .
RUN mkdir -p /app/models && chown mluser:mluser /app/models

USER mluser

EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
