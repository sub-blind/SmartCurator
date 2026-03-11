# Deployment Decision

## Recommended Architecture

- Frontend: Vercel
- Backend API: Render Web Service
- Celery Worker: Render Background Worker
- PostgreSQL: Render PostgreSQL or Railway PostgreSQL
- Redis: Render Key Value or Railway Redis
- Qdrant: Qdrant Cloud

## Why This Fits This Project

- The frontend is a standard Next.js 14 app and fits Vercel well.
- The backend is a long-running FastAPI service and needs stable Python process hosting.
- Celery must run as a separate background process from the API.
- PostgreSQL and Redis are standard managed dependencies and do not need custom ops work.
- Qdrant is the least convenient part to self-host for a small portfolio deploy, so managed Qdrant is the safest choice.

## Deployment Split

### Frontend

- Platform: Vercel
- Build command: `npm run build`
- Runtime env:
  - `NEXT_PUBLIC_API_BASE_URL`

### Backend API

- Platform: Render Web Service
- Start command:
  - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Predeploy / first setup:
  - `pip install -r requirements.txt`
  - `alembic upgrade head`
  - `python init_vector_db.py`

### Celery Worker

- Platform: Render Background Worker
- Start command:
  - `celery -A app.core.celery_app worker --loglevel=info`

### Data Services

- PostgreSQL: managed
- Redis: managed
- Qdrant: managed

## Required Backend Environment Variables

- `ENV`
- `DEBUG`
- `ALLOWED_ORIGINS`
- `DATABASE_URL`
- `ASYNC_DATABASE_URL`
- `SECRET_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `QDRANT_URL` or `QDRANT_HOST` + `QDRANT_PORT`
- `QDRANT_API_KEY` if using Qdrant Cloud

Notes:

- `DATABASE_URL` must be the sync driver for Celery and Alembic.
- `ASYNC_DATABASE_URL` must explicitly use `postgresql+asyncpg://...` for FastAPI.
- Do not leave async DB resolution to implicit conversion in production.

## Required Frontend Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`

## CORS Rule

- `ALLOWED_ORIGINS` must include the deployed frontend URL.
- Example:
  - `["http://localhost:3000","https://your-frontend.vercel.app"]`

## Minimal Deploy Order

1. Provision PostgreSQL, Redis, and Qdrant.
2. Set backend environment variables.
3. Deploy backend API.
4. Run migrations and initialize Qdrant collection.
5. Deploy Celery worker.
6. Deploy frontend with deployed API base URL.
7. Verify `/health`, login, content create, search, and AI assist.

## Operational Notes

- If Qdrant is empty after deploy, run `python scripts/reindex_vectors.py`.
- If content stays in `pending`, check Celery worker logs and Redis connection.
- If frontend login works but API calls fail, check `NEXT_PUBLIC_API_BASE_URL` and `ALLOWED_ORIGINS`.
- If you keep the current `.env` file in git-ignored local storage, rotate any leaked API keys before deploy.

## Decision Status

- Chosen default for this project: `Vercel + Render + managed Postgres/Redis + Qdrant Cloud`
- Reason: lowest ops complexity while preserving separate API and worker processes.
