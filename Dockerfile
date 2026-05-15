# =============================================================================
# ai-image-station — Multi-stage Docker build
# =============================================================================
# The frontend (React + Vite) build output is expected to already exist at
# backend/static/ before running docker build. If you need to build the
# frontend as part of the Docker build, uncomment the "frontend-builder" stage.
# =============================================================================

# ---------------------------------------------------------------------------
# (Optional) Stage 0: Build frontend — uncomment if backend/static/ is absent
# ---------------------------------------------------------------------------
# FROM node:20-alpine AS frontend-builder
# WORKDIR /src
# COPY frontend/package*.json ./
# RUN npm ci
# COPY frontend/ ./
# RUN npm run build

# ---------------------------------------------------------------------------
# Stage 1: Build Go binary
# ---------------------------------------------------------------------------
FROM golang:1.22-alpine AS go-builder

RUN apk add --no-cache git ca-certificates

ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /build

# Cache dependencies
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source code
COPY backend/ ./

# If frontend was built in a previous stage, copy it in
# COPY --from=frontend-builder /src/dist ./static/

# Build statically-linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -trimpath -o /app/server ./cmd/server/

# ---------------------------------------------------------------------------
# Stage 2: Minimal runtime
# ---------------------------------------------------------------------------
FROM alpine:3.19

# Install ca-certificates for HTTPS requests to external AI APIs
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

# Set up application directory
WORKDIR /app

# Copy binary
COPY --from=go-builder /app/server .

# Copy embedded static files (frontend SPA)
COPY --from=go-builder /build/static ./static

# Copy entrypoint
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create data directories (runtime volumes will be mounted here)
RUN mkdir -p /data/images /data/meta /data/tmp && \
    chown -R appuser:appuser /data /app

USER appuser

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
