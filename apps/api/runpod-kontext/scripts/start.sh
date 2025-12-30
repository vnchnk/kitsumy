#!/bin/bash
# Custom start script for FLUX Kontext worker
# 1. Initialize models (from volume or download)
# 2. Start the original ComfyUI worker

set -e

echo "=========================================="
echo "FLUX Kontext Worker Starting..."
echo "=========================================="

# Run model initialization
/init_models.sh

echo "=========================================="
echo "Starting ComfyUI Worker..."
echo "=========================================="

# Start the original worker (from base image)
exec /start.sh
