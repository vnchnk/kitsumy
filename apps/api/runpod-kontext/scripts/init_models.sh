#!/bin/bash
# Initialize models for FLUX Kontext
# Checks for Network Volume first, downloads if not available

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INIT]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[INIT]${NC} $1"; }

# Paths
VOLUME_MODELS="/runpod-volume/models"
COMFYUI_MODELS="/comfyui/models"
MODEL_TYPE="${MODEL_TYPE:-fp8}"

# Determine model filename based on type
if [ "$MODEL_TYPE" = "full" ]; then
    KONTEXT_MODEL="flux1-kontext-dev.safetensors"
else
    KONTEXT_MODEL="flux1-kontext-dev-fp8.safetensors"
fi

log_info "Starting model initialization..."
log_info "Model type: $MODEL_TYPE"

# Check if Network Volume has models
if [ -d "$VOLUME_MODELS" ] && [ -f "$VOLUME_MODELS/diffusion_models/$KONTEXT_MODEL" ]; then
    log_info "Found models on Network Volume!"

    # Create symlinks from volume to ComfyUI models directory
    log_info "Creating symlinks to ComfyUI models..."

    # Link diffusion_models
    if [ -d "$VOLUME_MODELS/diffusion_models" ]; then
        for f in "$VOLUME_MODELS/diffusion_models"/*.safetensors; do
            [ -e "$f" ] || continue
            ln -sf "$f" "$COMFYUI_MODELS/diffusion_models/" 2>/dev/null || true
            log_info "  Linked: diffusion_models/$(basename $f)"
        done
    fi

    # Link unet (some workflows use this)
    if [ -d "$VOLUME_MODELS/unet" ]; then
        mkdir -p "$COMFYUI_MODELS/unet"
        for f in "$VOLUME_MODELS/unet"/*.safetensors; do
            [ -e "$f" ] || continue
            ln -sf "$f" "$COMFYUI_MODELS/unet/" 2>/dev/null || true
            log_info "  Linked: unet/$(basename $f)"
        done
    fi

    # Link clip
    if [ -d "$VOLUME_MODELS/clip" ]; then
        for f in "$VOLUME_MODELS/clip"/*.safetensors; do
            [ -e "$f" ] || continue
            ln -sf "$f" "$COMFYUI_MODELS/clip/" 2>/dev/null || true
            log_info "  Linked: clip/$(basename $f)"
        done
    fi

    # Link vae
    if [ -d "$VOLUME_MODELS/vae" ]; then
        for f in "$VOLUME_MODELS/vae"/*.safetensors; do
            [ -e "$f" ] || continue
            ln -sf "$f" "$COMFYUI_MODELS/vae/" 2>/dev/null || true
            log_info "  Linked: vae/$(basename $f)"
        done
    fi

    log_info "Models linked from Network Volume!"

else
    log_warn "No Network Volume detected or models missing"
    log_info "Downloading models from HuggingFace..."

    # Check for HF token
    if [ -z "$HF_TOKEN" ]; then
        log_warn "HF_TOKEN not set - some models may fail to download"
    fi

    # Download models directly to ComfyUI models directory
    MODELS_DIR="$COMFYUI_MODELS" /download_models.sh "$MODEL_TYPE"

    log_info "Models downloaded!"
fi

# Verify required models exist
log_info "Verifying models..."
MISSING=0

check_model() {
    local path="$1"
    local name="$2"
    if [ -f "$path" ] || [ -L "$path" ]; then
        log_info "  ✓ $name"
    else
        log_warn "  ✗ $name MISSING"
        MISSING=$((MISSING + 1))
    fi
}

check_model "$COMFYUI_MODELS/diffusion_models/$KONTEXT_MODEL" "diffusion_models/$KONTEXT_MODEL"
check_model "$COMFYUI_MODELS/clip/clip_l.safetensors" "clip/clip_l.safetensors"
check_model "$COMFYUI_MODELS/clip/t5xxl_fp8_e4m3fn.safetensors" "clip/t5xxl_fp8_e4m3fn.safetensors"
check_model "$COMFYUI_MODELS/vae/ae.safetensors" "vae/ae.safetensors"

if [ $MISSING -gt 0 ]; then
    log_warn "$MISSING models missing - worker may not function correctly"
else
    log_info "All models ready!"
fi
