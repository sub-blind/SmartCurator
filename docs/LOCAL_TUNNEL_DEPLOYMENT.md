# Local + Tunnel Deployment (0 KRW/month)

This setup keeps monthly infra cost near zero by running backend services on your notebook.

## Architecture

- Frontend: Vercel (Free)
- Backend API: Local `uvicorn`
- Celery Worker: Local process
- Database/Queue/Vector DB: Local Docker (`Postgres`, `Redis`, `Qdrant`)
- Public API endpoint: Cloudflare Tunnel (recommended) or ngrok

## Required Env Changes

Backend `.env`:

```env
ALLOWED_ORIGINS=["http://localhost:3000","https://your-frontend.vercel.app"]
# Optional for Vercel preview domains
# ALLOWED_ORIGIN_REGEX=^https://.*\.vercel\.app$
```

Frontend (`frontend/.env.local` or Vercel Project Env):

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain-or-tunnel-url
```

## Run Sequence

1. Start Docker containers: Postgres, Redis, Qdrant.
2. Start API: `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
3. Start worker: `celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1` (Windows).
4. Start tunnel to `localhost:8000`.
5. Update `NEXT_PUBLIC_API_BASE_URL` to tunnel/custom domain.

## Operational Notes

- Others can use your service only while your notebook and processes are running.
- Sleep/reboot/network disconnect will stop service.
- Keep API keys and secrets rotated and never expose admin endpoints publicly.
