# api/Dockerfile
# Multi-stage build for minimal final image

# ── Stage 1: Build ────────────────────────────────────────
FROM golang:alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /finflow-api ./cmd/main.go

# ── Stage 2: Run ──────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates curl tzdata

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /finflow-api .
RUN chown appuser:appgroup /finflow-api

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["./finflow-api"]
