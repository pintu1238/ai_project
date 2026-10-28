# Troubleshooting

## Health check shows database or Redis error

- Run `docker compose up -d` from the repo root.
- Confirm `DATABASE_URL` and `REDIS_URL` in `.env` match Compose defaults.

## Upload succeeds but project stays QUEUED

- Start the worker: `cd backend && npm run worker`.
- Check Redis connectivity and worker logs (JSON lines).

## Transcription fails

- Install FFmpeg and ensure `ffmpeg -version` works.
- Install Python dependency: `pip install faster-whisper`.
- For UI testing without Whisper, set `DEMO_MODE=true` (labeled in transcript metadata).

## Ollama / moment or post generation fails

- Start Ollama and pull the model in `OLLAMA_MODEL`.
- Or enable `DEMO_MODE=true` for fallback templates.

## Publishing fails immediately

Expected when:

- Social account not connected
- Platform OAuth app IDs missing in `.env`
- Token lacks required scopes

Inspect `PublishingLog` rows via Prisma Studio (`npx prisma studio`) or API logs.

## CORS / auth issues from frontend

- `CORS_ORIGIN` must match the Next.js origin (default `http://localhost:3000`).
- Frontend fetch must use `credentials: "include"`.

## Large uploads

Adjust `MAX_UPLOAD_BYTES` in `.env`. Multer streams to disk under `UPLOAD_DIR`.
