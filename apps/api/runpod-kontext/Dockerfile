# FLUX Kontext + ControlNet worker for RunPod Serverless
FROM runpod/worker-comfyui:5.7.1-flux1-dev

# Download FLUX Kontext model (public fp8 version)
RUN wget -q --show-progress -O /comfyui/models/diffusion_models/flux1-kontext-dev-fp8.safetensors \
    "https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev/resolve/main/flux1-kontext-dev-fp8.safetensors"

# Download ControlNet Union Pro
RUN mkdir -p /comfyui/models/controlnet && \
    wget -q --show-progress -O /comfyui/models/controlnet/flux-controlnet-union-pro.safetensors \
    "https://huggingface.co/InstantX/FLUX.1-dev-Controlnet-Union-Pro/resolve/main/diffusion_pytorch_model.safetensors"

# Install ControlNet aux custom nodes
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/Fannovel16/comfyui_controlnet_aux.git && \
    cd comfyui_controlnet_aux && pip install -r requirements.txt

CMD ["/start.sh"]
