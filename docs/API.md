# ContentFlow API (summary)

Base URL: `http://localhost:4000`

Auth uses HTTP-only cookie `contentflow_token` (JWT). All protected routes require a logged-in session (`credentials: include` from the frontend).

## Health

- `GET /api/health` — API, PostgreSQL, Redis checks

## Auth

- `POST /api/auth/signup` — `{ email, password, name?, workspaceName? }`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Workspaces

- `GET /api/workspaces`
- `GET /api/workspaces/:workspaceId/dashboard`

## Projects

- `GET /api/projects?workspaceId=`
- `POST /api/projects` — create
- `GET /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/upload` — multipart field `media`
- `POST /api/projects/:projectId/process` — enqueue pipeline
- `GET /api/projects/:projectId/transcript?q=`
- `GET /api/projects/:projectId/moments`

## Posts

- `GET /api/posts/project/:projectId`
- `PATCH /api/posts/:postId`
- `POST /api/posts/:postId/regenerate-caption`
- `POST /api/posts/:postId/regenerate-image`
- `POST /api/posts/:postId/approval` — `{ action: APPROVED|REJECTED, note? }`
- `POST /api/posts/bulk-approval`

## Brand

- `GET /api/brand/:workspaceId`
- `PUT /api/brand`

## Social

- `GET /api/social/:workspaceId/accounts`
- `POST /api/social/connect-manual` — dev token connect (owner/admin)

## Schedule

- `GET /api/schedule/:workspaceId`
- `POST /api/schedule` — `{ postId, scheduledAt ISO, timezone }` (approved posts only)
- `POST /api/schedule/:id/cancel`
- `POST /api/schedule/:id/retry`

## Pipeline (background)

Jobs on queue `contentflow-pipeline`:

1. `transcribe`
2. `detect-moments`
3. `generate-posts`
4. `render-graphics`

Run `npm run worker` in `backend/`.
