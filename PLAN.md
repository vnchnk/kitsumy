# Kitsumy — План рефакторингу генерації коміксів

## Мета

Розділити генерацію коміксу на **два незалежні етапи**:
1. **Планування** — AI генерує детальний JSON-план коміксу (без картинок)
2. **Генерація** — На основі плану створюються картинки + збірка для Editor

---

## Етап 1: Планування коміксу

### Endpoint

```
POST /api/comic/plan
```

### Request

```typescript
interface PlanRequest {
  prompt: string;           // "World War II", "Пригоди кота"
  style: ComicStyle;        // "noir", "manga", "american-classic"
  maxPages?: number;        // 1-20, default: 5
  language?: string;        // "uk", "en", default: "uk"
}
```

### Response (JSON плану)

```typescript
interface ComicPlan {
  title: string;
  style: ComicStyle;

  characters: Character[];

  chapters: Chapter[];
}

interface Character {
  id: string;               // "char-1"
  name: string;             // "Marcus"
  appearance: string;       // Детальний опис зовнішності
  clothing: string;         // Одяг за замовчуванням
  role: string;             // Роль в історії
  seed?: number;            // Seed для консистентності (генерується автоматично)
}

interface Chapter {
  id: string;
  title: string;
  pages: Page[];
}

interface Page {
  id: string;
  pageNumber: number;
  layout: TemplateId;       // "single" | "grid-2x2" | "big-top" | etc.
  panels: PanelPlan[];
}

type TemplateId =
  | "single"           // 1 панель
  | "two-horizontal"   // 2 панелі вертикально
  | "two-vertical"     // 2 панелі горизонтально
  | "three-rows"       // 3 ряди
  | "grid-2x2"         // 4 панелі 2x2
  | "big-left"         // велика зліва + 2 маленькі
  | "big-right"        // 2 маленькі + велика справа
  | "big-top"          // велика зверху + 2 внизу
  | "big-bottom"       // 2 зверху + велика внизу
  | "strip-3"          // 3 колонки
  | "manga-3"          // манга стиль
  | "action";          // 5 панелей екшен

interface PanelPlan {
  id: string;               // "ch1-p1-pan1"
  position: number;         // 1, 2, 3... (порядок в темплейті)

  // Контент
  characters: string[];     // ["char-1", "char-2"] — ID персонажів
  action: string;           // "Marcus runs through explosions"
  location: string;         // "Normandy beach, dawn, smoke"
  mood: string;             // "intense", "romantic", "scary"

  // Камера
  camera: string;           // "close-up", "wide shot", "low angle"

  // Текст
  dialogue: Dialogue[];
  narrative: string | null; // Текст наратора
  sfx: string | null;       // "BOOM!", "CRASH!"
}

interface Dialogue {
  character: string;        // ID персонажа
  text: string;
}
```

### Внутрішня логіка (промпти)

```
Користувач: prompt + maxPages
                ↓
┌─────────────────────────────────────┐
│  ПРОМПТ 1: Персонажі                │
│  Input: prompt, style               │
│  Output: characters[]               │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  ПРОМПТ 2: Структура                │
│  Input: prompt, characters, maxPages│
│  Output: chapters[] з pages[]       │
│  (AI обирає layout для кожної page) │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  ПРОМПТ 3: Деталі панелей           │
│  Input: chapter, page, characters   │
│  Output: panels[] з усіма деталями  │
└─────────────────────────────────────┘
                ↓
            ComicPlan JSON
```

### Обмеження maxPages

| maxPages | Поведінка |
|----------|-----------|
| 1 | 1 chapter, 1 page, 1-4 panels |
| 2-3 | 1 chapter, 2-3 pages |
| 4-10 | 1-2 chapters |
| 11-20 | 2-4 chapters |
| undefined | default: 5 pages |

---

## Етап 2: Генерація картинок (ПОТІМ)

Після того як Етап 1 працює і JSON плану задовільний.

### Endpoint

```
POST /api/comic/generate
```

### Request

```typescript
interface GenerateRequest {
  plan: ComicPlan;          // JSON з етапу 1
  // або
  planId: string;           // ID збереженого плану
}
```

### Логіка

1. Для кожного персонажа згенерувати `seed`
2. Для кожної панелі:
   - Зібрати prompt: style + camera + action + character descriptions
   - Додати seed персонажів
   - Згенерувати картинку через Flux
3. Зібрати Editor JSON

---

## Етап 3: Editor JSON (ПОТІМ)

Фінальний JSON який можна відкрити в Editor.

---

## Що робимо ЗАРАЗ

### Крок 1: Створити структуру
- [ ] Створити `/apps/api/src/services/comicPlanner.ts`
- [ ] Додати типи в `packages/types/src/index.ts`
- [ ] Додати endpoint `POST /api/comic/plan`

### Крок 2: Реалізувати промпти
- [ ] Промпт 1: генерація персонажів
- [ ] Промпт 2: генерація структури (chapters + pages + layout)
- [ ] Промпт 3: генерація деталей панелей

### Крок 3: Тестування
- [ ] Тест через Postman
- [ ] Перевірка JSON структури
- [ ] Перевірка що layout відповідає кількості панелей

---

## Файли

| Файл | Опис |
|------|------|
| `apps/api/src/services/comicPlanner.ts` | Новий сервіс планування |
| `apps/api/src/services/orchestrator.ts` | Залишається для генерації картинок (стилі) |
| `packages/types/src/comic.ts` | Нові типи для плану |

---

## Приклад виклику

```bash
curl -X POST http://localhost:3001/api/comic/plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "World War II soldier returns home",
    "style": "noir",
    "maxPages": 3
  }'
```

Відповідь: повний JSON плану коміксу (без картинок).

---

## TODO: Генерація зображень

### Поточне рішення
- **FLUX Kontext** — для консистентності персонажів (95%+)
- RunPod endpoint `cprbb2e4dtmvjz` — не працює (невідомий формат воркера)
- Fallback: Replicate flux-kontext ($0.025/зображення)

### Поточна конфігурація (працює)
- **RunPod Serverless** з FLUX Kontext Dev FP8
- **Endpoint ID**: `idgm4jgoh9gxae`
- **Volume**: `kitsumy-models`
- **GPU**: RTX 4090 (24GB)
- **Час генерації**: ~50 сек/зображення

### Моделі на volume
- `flux1-kontext-dev-fp8.safetensors` (~12GB)
- `clip_l.safetensors` (235MB)
- `t5xxl_fp8_e4m3fn.safetensors` (4.6GB)
- `ae.safetensors` (320MB)

---

## TODO: Оптимізації та покращення

### Швидкість генерації
- [ ] **Менше steps** — зараз 28, спробувати 20-24 (Kontext працює добре з меншою кількістю)
- [ ] **Менша роздільність** — 768x1024 замість 1024x1024 для прев'ю
- [ ] **Batch generation** — генерувати кілька панелей одночасно на одному воркері
- [ ] **Більше воркерів** — паралельна генерація на кількох GPU (scale out)
- [ ] **Потужніші GPU** — A100/H100 для ~30-50% прискорення

### Якість зображень
- [ ] **Full precision замість FP8** — перехід з `flux1-kontext-dev-fp8.safetensors` на `flux1-kontext-dev.safetensors` (23GB)
- [ ] **IP-Adapter/ControlNet** — для збереження деталей одягу, татуювань, логотипів
- [ ] **Детальніші промпти** — явно вказувати деталі одягу в кожному промпті

### AI планування
- [ ] **OpenAI/Claude для планування** — використовувати більш потужні моделі для генерації сценаріїв

---

## Infrastructure as Code ✓ COMPLETED

### Що було зроблено
- [x] **Аналіз опцій** — Network Volume + download script (найпростіше рішення)
- [x] **Автоматичне завантаження моделей** — `scripts/download_models.sh` завантажує всі моделі з HuggingFace
- [x] **Документація** — `runpod-kontext/README.md` з повною інструкцією
- [ ] **Тестування full precision** — можна спробувати `./download_models.sh full`

### Ключовий інсайт
**Pod vs Serverless mount paths:**
- Pod: `/workspace/` = Network Volume
- Serverless: `/runpod-volume/` = Network Volume

Моделі МАЮТЬ бути в `/workspace/models/` (а НЕ в `/workspace/runpod-slim/ComfyUI/models/`), щоб Serverless їх знайшов.

### Швидкий старт
```bash
# 1. Створити Network Volume в RunPod Console
# 2. Підняти тимчасовий Pod з цим volume
# 3. SSH і запустити скрипт:
export HF_TOKEN="your_token"
bash /workspace/download_models.sh fp8
# 4. Видалити Pod, створити Serverless endpoint з volume
```

### Аналіз підходів (результат дослідження)

| Підхід | Плюси | Мінуси |
|--------|-------|--------|
| **1. Dockerfile з моделями** | Немає cold start download, все в образі | Образ ~20-30GB, довгий build/push, при оновленні моделі — rebuild |
| **2. Network Volume + symlinks** | Моделі окремо від образу, легко оновлювати | Прив'язка до datacenter, потрібні symlinks в handler |
| **3. runpod-worker-comfyui** | Готовий worker, тестований, підтримується | Менше контролю, треба адаптувати під Kontext workflow |
| **4. Custom handler + Network Volume** | Повний контроль, можна використати існуючий volume | Треба написати свій handler |

### Рекомендований підхід: Network Volume + Init Script

**Чому:**
1. Volume `kitsumy-models` вже існує і працює
2. Моделі можна оновлювати без rebuild образу
3. Можна використати готовий `runpod-worker-comfyui` образ
4. Init script завантажить моделі якщо їх немає

**Структура:**
```
apps/api/runpod-kontext/
├── Dockerfile              # Базується на runpod-worker-comfyui
├── scripts/
│   └── download_models.sh  # Завантаження моделей з HuggingFace
├── extra_model_paths.yaml  # Шляхи до моделей на /runpod-volume
└── README.md               # Документація
```

**Важливо:**
- Network volume монтується в `/runpod-volume` (serverless) або `/workspace` (pod)
- Потрібні symlinks: `ln -s /runpod-volume/models /comfyui/models`
- Volume прив'язує endpoint до конкретного datacenter

### Джерела
- [RunPod Network Volumes](https://docs.runpod.io/storage/network-volumes)
- [runpod-workers/worker-comfyui](https://github.com/runpod-workers/worker-comfyui)
- [RunPod Deploy Workers](https://docs.runpod.io/serverless/workers/deploy)
