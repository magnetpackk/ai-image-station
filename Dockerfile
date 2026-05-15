# ---- Stage 1: Build Go backend ----
FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/server ./cmd/server

# ---- Stage 2: Final image ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /build/server /server
COPY frontend/dist/ /app/frontend/
VOLUME ["/data"]
ENV ADDR=:8080
ENV DATA_DIR=/data
ENV STATIC_DIR=/app/frontend
EXPOSE 8080
ENTRYPOINT ["/server"]
