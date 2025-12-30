#!/bin/bash
# Download FLUX Kontext models from HuggingFace to Network Volume
# Usage: HF_TOKEN=your_token ./download_models.sh [fp8|full]
#
# This script downloads all required models for FLUX Kontext workflow:
# - FLUX Kontext Dev (FP8 or Full precision)
# - CLIP L encoder
# - T5XXL FP8 encoder
# - VAE (ae.safetensors)
#
# IMPORTANT: Models are stored on the Network Volume at /workspace/models/
# When used with Serverless, this becomes /runpod-volume/models/
#
# Directory structure:
#   /workspace/models/
#   ├── diffusion_models/
#   │   └── flux1-kontext-dev-fp8.safetensors
#   ├── unet/
#   │   └── flux1-kontext-dev-fp8.safetensors (copy for compatibility)
#   ├── clip/
#   │   ├── clip_l.safetensors
#   │   └── t5xxl_fp8_e4m3fn.safetensors
#   └── vae/
#       └── ae.safetensors

set -e

# Configuration
MODEL_TYPE="${1:-fp8}"  # fp8 or full

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Models directory can be overridden via environment variable
# Default: /workspace/models (for Pod with Network Volume)
# Docker: /comfyui/models (when downloading inside container)
MODELS_DIR="${MODELS_DIR:-/workspace/models}"

log_info "============================================"
log_info "FLUX Kontext Model Downloader"
log_info "============================================"
log_info "Model type: $MODEL_TYPE"
log_info "Target directory: $MODELS_DIR"
log_info ""

# Check HuggingFace token
if [ -z "$HF_TOKEN" ]; then
    log_error "HF_TOKEN environment variable is required"
    log_info "Get your token from: https://huggingface.co/settings/tokens"
    exit 1
fi

# Ensure pip has huggingface_hub
log_info "Ensuring huggingface_hub is installed..."
pip install -q huggingface_hub 2>/dev/null || true

# Create directories
log_info "Creating model directories..."
mkdir -p "$MODELS_DIR/diffusion_models"
mkdir -p "$MODELS_DIR/unet"
mkdir -p "$MODELS_DIR/clip"
mkdir -p "$MODELS_DIR/vae"

# Download function using Python (more reliable than CLI)
download_model() {
    local repo_id="$1"
    local filename="$2"
    local local_dir="$3"
    local target_name="${4:-}"  # Optional: rename after download

    python3 << EOF
import os
from huggingface_hub import hf_hub_download
import shutil

token = os.environ.get('HF_TOKEN')
local_path = hf_hub_download(
    repo_id="$repo_id",
    filename="$filename",
    local_dir="$local_dir",
    token=token
)

target_name = "$target_name"
if target_name:
    target_path = os.path.join("$local_dir", target_name)
    if os.path.exists(local_path) and local_path != target_path:
        shutil.move(local_path, target_path)
        print(f"Downloaded and renamed to: {target_path}")
    else:
        print(f"Downloaded to: {local_path}")
else:
    print(f"Downloaded to: {local_path}")
EOF
}

# Download FLUX Kontext model
if [ "$MODEL_TYPE" = "full" ]; then
    MODEL_FILE="flux1-kontext-dev.safetensors"
    log_info "Downloading FLUX Kontext Dev (Full Precision, ~23GB)..."

    if [ -f "$MODELS_DIR/diffusion_models/$MODEL_FILE" ]; then
        log_warn "$MODEL_FILE already exists, skipping..."
    else
        download_model "black-forest-labs/FLUX.1-Kontext-dev" "$MODEL_FILE" "$MODELS_DIR/diffusion_models"
    fi
else
    MODEL_FILE="flux1-kontext-dev-fp8.safetensors"
    log_info "Downloading FLUX Kontext Dev (FP8, ~12GB)..."

    if [ -f "$MODELS_DIR/diffusion_models/$MODEL_FILE" ]; then
        log_warn "$MODEL_FILE already exists, skipping..."
    else
        # FP8 from Comfy-Org has different filename
        download_model "Comfy-Org/flux1-kontext-dev_ComfyUI" \
            "split_files/diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors" \
            "$MODELS_DIR/diffusion_models" \
            "$MODEL_FILE"
    fi
fi

# Copy to unet folder for compatibility (some workflows use unet/ instead of diffusion_models/)
log_info "Creating unet copy for compatibility..."
if [ ! -f "$MODELS_DIR/unet/$MODEL_FILE" ]; then
    cp "$MODELS_DIR/diffusion_models/$MODEL_FILE" "$MODELS_DIR/unet/$MODEL_FILE"
    log_info "  Copied to unet folder"
else
    log_warn "  unet/$MODEL_FILE already exists"
fi

# Download CLIP L
log_info "Downloading CLIP L encoder (~235MB)..."
if [ -f "$MODELS_DIR/clip/clip_l.safetensors" ]; then
    log_warn "clip_l.safetensors already exists, skipping..."
else
    download_model "comfyanonymous/flux_text_encoders" "clip_l.safetensors" "$MODELS_DIR/clip"
fi

# Download T5XXL FP8
log_info "Downloading T5XXL FP8 encoder (~4.6GB)..."
if [ -f "$MODELS_DIR/clip/t5xxl_fp8_e4m3fn.safetensors" ]; then
    log_warn "t5xxl_fp8_e4m3fn.safetensors already exists, skipping..."
else
    download_model "comfyanonymous/flux_text_encoders" "t5xxl_fp8_e4m3fn.safetensors" "$MODELS_DIR/clip"
fi

# Download VAE
log_info "Downloading VAE (~320MB)..."
if [ -f "$MODELS_DIR/vae/ae.safetensors" ]; then
    log_warn "ae.safetensors already exists, skipping..."
else
    download_model "black-forest-labs/FLUX.1-dev" "ae.safetensors" "$MODELS_DIR/vae"
fi

# Cleanup any leftover directories from HF download
log_info "Cleaning up..."
rm -rf "$MODELS_DIR/diffusion_models/split_files" 2>/dev/null || true
rm -rf "$MODELS_DIR/diffusion_models/.cache" 2>/dev/null || true
rm -rf "$MODELS_DIR/clip/.cache" 2>/dev/null || true
rm -rf "$MODELS_DIR/vae/.cache" 2>/dev/null || true

# Verify downloads
log_info ""
log_info "============================================"
log_info "Verifying downloads..."
log_info "============================================"
MISSING=0

check_file() {
    if [ -f "$1" ]; then
        SIZE=$(du -h "$1" | cut -f1)
        log_info "  ✓ $(basename $1) ($SIZE)"
    else
        log_error "  ✗ $1 NOT FOUND"
        MISSING=$((MISSING + 1))
    fi
}

log_info "diffusion_models/:"
check_file "$MODELS_DIR/diffusion_models/$MODEL_FILE"

log_info "unet/:"
check_file "$MODELS_DIR/unet/$MODEL_FILE"

log_info "clip/:"
check_file "$MODELS_DIR/clip/clip_l.safetensors"
check_file "$MODELS_DIR/clip/t5xxl_fp8_e4m3fn.safetensors"

log_info "vae/:"
check_file "$MODELS_DIR/vae/ae.safetensors"

if [ $MISSING -gt 0 ]; then
    log_error ""
    log_error "$MISSING files missing!"
    exit 1
fi

log_info ""
log_info "============================================"
log_info "All models downloaded successfully!"
log_info "============================================"
log_info "Models location: $MODELS_DIR"
log_info "Total size: $(du -sh $MODELS_DIR | cut -f1)"
log_info ""
log_info "For Serverless, these will be available at:"
log_info "  /runpod-volume/models/diffusion_models/"
log_info "  /runpod-volume/models/clip/"
log_info "  /runpod-volume/models/vae/"
log_info ""
log_info "Next steps:"
log_info "  1. Create Serverless endpoint with this Network Volume"
log_info "  2. Use Docker image: timpietruskyblibla/runpod-worker-comfy:3.1.0-base"
log_info "  3. GPU: RTX 4090 or higher (24GB VRAM required)"
