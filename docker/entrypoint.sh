#!/bin/sh
# =============================================================================
# ai-image-station — Docker entrypoint
# =============================================================================
# Ensures data directories exist before starting the application.
# =============================================================================

set -e

DATA_DIR="${DATA_DIR:-/data}"

echo "=== ai-image-station ==="
echo "DATA_DIR=${DATA_DIR}"
echo "PORT=${PORT:-8080}"

# Create required directories
mkdir -p "${DATA_DIR}/images" \
         "${DATA_DIR}/meta" \
         "${DATA_DIR}/tmp"

echo "Data directories ready."

# Start the Go server
exec /app/server
