# ContentFlow AI

AI-powered content repurposing SaaS: upload long-form media, transcribe locally, detect high-value moments, generate platform-specific posts, render brand graphics, review, schedule, and publish.

## Repository assessment (initial state)

- **Frontend:** Next.js 16 App Router + Tailwind 4 scaffold (default landing page only).
- **Backend:** `package.json` with Express/BullMQ dependencies but **no application source code**.
- **Infrastructure:** No Docker Compose, database schema, or documentation.
- **Git:** Remote `origin` → `https://github.com/pintu1238/ai_project.git`, no commits yet.

## Folder structure

```
ai_project/
├── docker-compose.yml          # PostgreSQL + Redis
├── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── TROUBLESHOOTING.md
├── backend/
│   ├── prisma/                 # Schema, migrations, seed
│   ├── scripts/transcribe.py   # faster-whisper CLI
│   └── src/                    # Express API + BullMQ worker
└── frontend/                   # Next.js UI
```

## Hardware (local MVP)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16 GB+ |
| Disk | 10 GB free | SSD for media + models |
| GPU | Optional | Speeds Whisper/Ollama |

## Quick start

### 1. Infrastructure

```powershell
cd D:\RagAndAgentic\ai_project
Copy-Item .env.example .env
docker compose up -d
```

### 2. Backend

```powershell
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

In a **second terminal** (required for processing uploads):

```powershell
cd backend
npm run worker
```

### 3. Frontend

```powershell
cd frontend
npm install
Copy-Item ..\.env.example .env.local
# Ensure NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Seed user:** `demo@contentflow.local` / `password123`

### 4. Optional local AI stack

- **FFmpeg:** install and ensure `ffmpeg` is on `PATH` (or set `FFMPEG_PATH`).
- **Whisper:** `pip install faster-whisper` (uses `backend/scripts/transcribe.py`).
- **Ollama:** [https://ollama.com](https://ollama.com) — `ollama pull llama3.2:3b` (or change `OLLAMA_MODEL`).

If Whisper/Ollama are missing, set `DEMO_MODE=true` in `.env` for labeled demo inference (transcript metadata includes `demoMode`).

## Implementation phases

| Phase | Status | Notes |
|-------|--------|-------|
| 1 | Done | Docker, health API, frontend shell |
| 2 | Done | Auth, Prisma models, upload |
| 3 | Done | FFmpeg + Whisper integration |
| 4 | Done | Moment detection (Ollama JSON) |
| 5 | Done | Post generation |
| 6 | Done | SVG brand graphics + brand kit |
| 7 | Done | Review / approval UI |
| 8 | Done | Scheduling + publish adapters (real API calls when configured) |
| 9 | Done | Seed, unit test, docs |

## Scripts

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | backend | REST API |
| `npm run worker` | backend | Pipeline + publish jobs |
| `npm run test` | backend | Unit tests |
| `npm run dev` | frontend | Web UI |

## Social publishing

Publishing **never fakes success**. Without OAuth app credentials and connected accounts, scheduled jobs fail with explicit log messages and remain auditable in `PublishingLog`.

Configure platform keys in `.env` and connect accounts via `POST /api/social/connect-manual` (dev) or future OAuth routes.

## License

ISC (default npm package license in backend).
