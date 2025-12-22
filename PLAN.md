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
