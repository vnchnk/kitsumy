# FLUX Kontext ComfyUI Worker for RunPod Serverless
#
# Supports two modes:
# 1. With Network Volume: Uses pre-downloaded models from /runpod-volume/models (instant start)
# 2. Without Volume: Downloads models from HuggingFace on cold start (~3-5 min)
#
# Build: docker build -t kitsumy-kontext:latest .
# Push:  docker push YOUR_REGISTRY/kitsumy-kontext:latest

FROM timpietruskyblibla/runpod-worker-comfy:3.1.0-base

# Install huggingface_hub for model downloads
RUN pip install --no-cache-dir huggingface_hub

# Update ComfyUI to latest version (includes FluxKontextImageScale, ReferenceLatent nodes)
RUN cd /comfyui && git pull origin master

# Copy init script and download script
# Note: paths relative to repo root (RunPod builds from root)
COPY apps/api/runpod-kontext/scripts/init_models.sh /init_models.sh
COPY apps/api/runpod-kontext/scripts/download_models.sh /download_models.sh
COPY apps/api/runpod-kontext/scripts/start.sh /start_custom.sh
RUN chmod +x /init_models.sh /download_models.sh /start_custom.sh

# Set environment variables
ENV MODEL_TYPE=fp8
# HF_TOKEN should be passed at runtime for downloads without volume

CMD ["/start_custom.sh"]
