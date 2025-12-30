# RunPod FLUX Kontext Infrastructure

Infrastructure as Code for deploying FLUX Kontext on RunPod Serverless.

## Quick Start

### 1. Create Network Volume

1. Go to [RunPod Console → Storage](https://www.runpod.io/console/user/storage)
2. Create new Network Volume:
   - Name: `kitsumy-models-v2` (or any name)
   - Size: 50GB (for FP8) or 100GB (for full precision)
   - Datacenter: Choose based on GPU availability (e.g., EU-RO-1)

### 2. Create Temporary Pod with Volume

1. Go to [RunPod Console → Pods](https://www.runpod.io/console/pods)
2. Deploy new Pod:
   - **GPU**: Any cheap GPU (RTX 3090, A4000, etc.) - only for downloading
   - **Template**: RunPod Pytorch or any Linux template
   - **Network Volume**: Select your volume from step 1
3. Wait for Pod to start and note the SSH connection details

### 3. Download Models to Volume

```bash
# SSH into the Pod (replace with your Pod's connection)
ssh -p PORT root@POD_IP

# Copy download script to Pod (from your local machine)
# Option A: curl from repo
curl -o /workspace/download_models.sh https://raw.githubusercontent.com/YOUR_REPO/scripts/download_models.sh

# Option B: scp from local
scp -P PORT scripts/download_models.sh root@POD_IP:/workspace/

# Run the download script
export HF_TOKEN="your_huggingface_token"  # Get from https://huggingface.co/settings/tokens
bash /workspace/download_models.sh fp8    # or 'full' for full precision

# Verify models are in correct location
ls -la /workspace/models/
```

**IMPORTANT**: Models MUST be in `/workspace/models/` (NOT in `/workspace/runpod-slim/ComfyUI/models/`). This path becomes `/runpod-volume/models/` when used with Serverless.

### 4. Terminate Pod and Create Serverless Endpoint

1. **Terminate the temporary Pod** (the volume persists independently)
2. Go to [RunPod Console → Serverless](https://www.runpod.io/console/serverless)
3. Create new Endpoint:
   - **Docker Image**: `timpietruskyblibla/runpod-worker-comfy:3.1.0-base`
   - **GPU**: RTX 4090 (24GB) or higher
   - **Network Volume**: Select your volume from step 1
   - **Idle Timeout**: 5 seconds (for cost savings)
   - **Max Workers**: 1-3 depending on needs

### 5. Update .env

```bash
RUNPOD_KONTEXT_ENDPOINT_ID=your_new_endpoint_id
```

## Directory Structure on Volume

**On Pod** (`/workspace/` = network volume):
```
/workspace/models/
├── diffusion_models/
│   └── flux1-kontext-dev-fp8.safetensors
├── unet/
│   └── flux1-kontext-dev-fp8.safetensors  # copy for compatibility
├── clip/
│   ├── clip_l.safetensors
│   └── t5xxl_fp8_e4m3fn.safetensors
└── vae/
    └── ae.safetensors
```

**On Serverless** (`/runpod-volume/` = network volume):
```
/runpod-volume/models/
├── diffusion_models/
│   └── flux1-kontext-dev-fp8.safetensors
├── unet/
│   └── flux1-kontext-dev-fp8.safetensors
├── clip/
│   ├── clip_l.safetensors
│   └── t5xxl_fp8_e4m3fn.safetensors
└── vae/
    └── ae.safetensors
```

## Model Variants

| Model | Size | Quality | Speed | Recommended |
|-------|------|---------|-------|-------------|
| FP8 | ~12GB | Good | Faster | Yes (default) |
| Full | ~23GB | Best | Slower | For final renders |

## Troubleshooting

### Models not found

Check that symlinks are correct:
```bash
ls -la /comfyui/models/
# Should show links to /runpod-volume/models/*
```

### Cold start too slow

1. Set `Min Workers: 1` to keep one worker warm
2. Use FP8 model instead of full precision
3. Consider datacenter with better GPU availability

### Volume not mounting

- Verify endpoint is in the same datacenter as volume
- Check volume status in RunPod console

## Files

| File | Description |
|------|-------------|
| `scripts/download_models.sh` | Downloads all models from HuggingFace |
| `extra_model_paths.yaml` | ComfyUI configuration for model paths |
| `README.md` | This documentation |

## Links

- [RunPod Network Volumes](https://docs.runpod.io/storage/network-volumes)
- [runpod-worker-comfyui](https://github.com/runpod-workers/worker-comfyui)
- [FLUX Kontext on HuggingFace](https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev)
