# 🦊 Kitsumy

**Kitsumy** is an AI-powered educational platform that turns complex topics into engaging, infinite comic books. It uses an agentic workflow to architect, write, and visualize stories on the fly.

![Project Status](https://img.shields.io/badge/Status-MVP-success)
![Tech](https://img.shields.io/badge/Stack-Node.js_•_Fastify_•_React_•_LangChain-blue)

## ✨ Core Concept

Instead of dry textbooks, Kitsumy generates **Graphic Novels** tailored to the user.
*   **Input**: "WWII", "Photosynthesis", "The Matrix with Cats".
*   **Output**: A multi-chapter, visual story with characters, dialogue, and cinematic shots.

### The "Deep Dive" Engine
Kitsumy doesn't just ask ChatGPT to "make a comic". It uses a multi-stage **Agentic Pipeline**:
1.  **The Architect**: Analyzes the topic and builds a narrative arc (6-10 chapters).
2.  **The Dramaturg**: Assigns a POV character (e.g., "A terrified radio operator") and emotional core to each chapter.
3.  **The Writer**: Scripts cinematic panels using "Show, Don't Tell" principles.
4.  **The Visualizer**: Generates consistent, stylized art via DALL-E 3 (or mocks for testing).

## 🏗 Architecture (Monorepo)

The project is built as a **TypeScript Monorepo** using npm workspaces.

```
kitsumy/
├── apps/
│   ├── api/          # Node.js v22 + Fastify + LangChain
│   └── web/          # React 19 + Vite + Tailwind v4 + Framer Motion
├── packages/
│   └── types/        # Shared TypeScript definitions (Contract)
```

## 🚀 Getting Started

### Prerequisites
*   Node.js (v20+)
*   OpenAI API Key (GPT-4 Turbo & DALL-E 3 required)

### Installation

1.  **Clone & Install**
    ```bash
    git clone https://github.com/yourusername/kitsumy.git
    cd kitsumy
    npm install
    ```

2.  **Environment Setup**
    Create a `.env` file in `apps/api/`:
    ```env
    OPENAI_API_KEY=sk-your-key-here
    ```

3.  **Build Shared Types**
    ```bash
    npm run build -w packages/types
    ```

4.  **Run Development Server**
    Starts both API (3001) and Web (3000) concurrently:
    ```bash
    npm run dev
    ```

## ⚙️ Configuration

### Cost Saving (Mock Mode)
Generating images with DALL-E 3 is expensive (~$0.04/image).
To test the *narrative logic* without burning money, go to `apps/api/src/services/orchestrator.ts` and set:
```typescript
private MOCK_IMAGES = true; // Set to 'false' for real production generation
```

## 🎨 UI Features
*   **Dynamic Comic Layout**: CSS Grid system that mimics comic book paneling (wide shots, splits, details).
*   **Vintage Process**: Procedural CSS filters for "Old Paper", "Ink Bleed", and "Halftone Dots".
*   **Adaptive Bubbles**: Speech bubbles that respect the artwork's negative space.

## 🔮 Roadmap
- [ ] **Persistence**: Save generated comics to a database (SQLite/Postgres).
- [ ] **Voice**: ElevenLabs integration for audio narration.
- [ ] **Multiplayer**: "Club" mode where users share comics.
- [ ] **Character Consistency**: LoRA/Fine-tuning for recurring avatars.

---
*Built with ❤️ by vnchnk*

