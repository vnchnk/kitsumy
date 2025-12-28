# FLUX Kontext RunPod Worker

RunPod Serverless worker для генерації зображень з FLUX Kontext.

## Швидкий старт

### 1. Білд
```bash
docker build -t kitsumy-kontext .
```

### 2. Локальний тест (потрібна NVIDIA GPU)
```bash
docker-compose up
```

### 3. Push на Docker Hub
```bash
docker tag kitsumy-kontext YOUR_DOCKER_HUB/kitsumy-kontext:latest
docker push YOUR_DOCKER_HUB/kitsumy-kontext:latest
```

### 4. Створити Serverless Endpoint на RunPod
1. Йди на https://runpod.io/console/serverless
2. Create Endpoint → Custom
3. Docker Image: `YOUR_DOCKER_HUB/kitsumy-kontext:latest`
4. GPU: L40S або A40 (24GB VRAM)

## API формат

```json
{
  "input": {
    "workflow": { ... },  // ComfyUI workflow JSON
    "images": [
      {
        "name": "input.png",
        "image": "base64_encoded_image_data"
      }
    ]
  }
}
```

## Вартість

~$0.003/зображення (8x дешевше за Replicate)
