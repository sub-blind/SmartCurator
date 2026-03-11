# SmartCurator

SmartCurator is an AI-powered personal knowledge curation project.
You can save articles or notes, process them asynchronously, search them semantically, and ask RAG-based questions with sources and confidence.

## Core Features

- Content ingestion from URL or raw text
- Async background processing with Celery
- Article summarization and tag generation
- Chunk-based vector indexing in Qdrant
- Semantic search over saved knowledge
- RAG question answering with sources and confidence

## What Works Today

- Auth flow: register, login, profile lookup, logout
- Dashboard UI for saved contents with status badges, summaries, tags, refresh, delete, and reprocess
- Quick add flow for article URLs or raw text notes
- Semantic search that returns grouped content results with top snippets
- AI assistant that returns answer text, source chunks, and confidence
- Qdrant-backed reindex and recovery flow for vector rebuilds

## Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- Worker: Celery, Redis
- Retrieval: Sentence Transformers, Qdrant
- LLM: OpenAI
- Frontend: Next.js 14, React 18, Tailwind CSS

## Architecture Summary

1. `POST /contents/` creates a content row with `pending` status.
2. Celery picks up the job and processes the content.
3. The worker extracts text, generates a summary, builds tags, and stores vectors in Qdrant.
4. `GET /search/semantic` searches chunk vectors and groups results by content.
5. `POST /chat/ask` retrieves relevant chunks and generates a RAG answer with sources.

## Main APIs

```http
POST   /auth/register
POST   /auth/login
GET    /auth/me
PUT    /auth/profile
POST   /auth/logout

GET    /health
POST   /contents/
GET    /contents/my
GET    /contents/{id}
PUT    /contents/{id}
DELETE /contents/{id}
POST   /contents/{id}/reprocess

GET    /search/semantic
GET    /search/public
GET    /search/health
POST   /chat/ask
GET    /chat/health
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- Docker
- OpenAI API key

## Local Setup

### 1. Start dependencies

```bash
docker run -d -p 6379:6379 redis:latest
docker run -d -p 6333:6333 qdrant/qdrant:latest
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

Create the application database once the PostgreSQL container is running:

```bash
docker exec -it <postgres-container-id> psql -U postgres -c "CREATE DATABASE smartcurator;"
```

### 2. Backend environment

Create `.env` from `.env.example`.

Required values:

```env
ENV=development
DEBUG=True
ALLOWED_ORIGINS=["http://localhost:3000"]

DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/smartcurator
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/smartcurator

SECRET_KEY=replace-me

OPENAI_API_KEY=replace-me
OPENAI_MODEL=gpt-3.5-turbo

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

QDRANT_HOST=localhost
QDRANT_PORT=6333
```

Notes:

- `DATABASE_URL` is used by Celery and Alembic.
- `ASYNC_DATABASE_URL` is used by FastAPI.
- Do not rely on automatic sync/async conversion in deploy environments. Set both explicitly.

### 3. Run backend

```bash
pip install -r requirements.txt
alembic upgrade head
python init_vector_db.py
uvicorn app.main:app --reload
```

### 4. Run Celery

```bash
celery -A app.core.celery_app worker --loglevel=info
```

On Windows, prefer the solo pool:

```bash
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 5. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend env:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 6. Health checks

Use these endpoints after all services are up:

- `GET /`
- `GET /health`
- `GET /search/health`
- `GET /chat/health`

### 7. Recommended first-run flow

1. Register a user in the frontend.
2. Add one URL and one raw text note from the dashboard.
3. Wait until content status changes from `pending` or `processing` to `completed`.
4. Run a semantic search query and confirm snippets appear.
5. Ask a question in AI assist and confirm `sources` and `confidence` are returned.

## Search and RAG Notes

Recent changes made for quality and demo stability:

- Lower-score semantic search results are hidden from UI output.
- Lower-score RAG sources are hidden from the answer source list.
- Duplicate sources from the same article are collapsed to one source entry.
- Search result snippets are shortened for readability.
- Reindexing is supported with `python scripts/reindex_vectors.py`.

## Validation Checklist

Recommended manual validation flow:

1. Register and log in.
2. Add 3 to 5 pieces of content.
3. Wait for Celery processing to complete.
4. Run semantic search with:
   - short query
   - sentence query
   - ambiguous query
5. Run AI assist with:
   - question that has clear evidence
   - question that should have weak or missing evidence
6. Reprocess one content item and confirm search or RAG behavior updates.

Check these points:

- Search should not repeatedly return zero results for normal queries.
- Very weak search matches should not dominate the result list.
- `sources` and `confidence` should look reasonable.
- Reprocess should update vectors without manual DB edits.

## Recovery and Operations

### If Qdrant is empty

```bash
python scripts/reindex_vectors.py
```

### If content stays in `pending`

- Check Celery worker logs.
- Check Redis connection values.
- Verify `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND`.

### If search fails after restart

- Confirm Qdrant is reachable.
- Confirm the collection exists.
- Reindex if needed.

### If frontend requests fail in browser

- Check `NEXT_PUBLIC_API_BASE_URL`
- Check `ALLOWED_ORIGINS`
- Confirm the deployed frontend URL is in the CORS allow list

## Deployment Decision

Current recommended deployment structure:

- Frontend: Vercel
- Backend API: Render Web Service
- Celery Worker: Render Background Worker
- PostgreSQL: Render PostgreSQL or Railway PostgreSQL
- Redis: Render Key Value or Railway Redis
- Qdrant: Qdrant Cloud

Backend start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Celery worker start command:

```bash
celery -A app.core.celery_app worker --loglevel=info
```

Deployment-specific requirements:

- Set both `DATABASE_URL` and `ASYNC_DATABASE_URL`
- Set `ALLOWED_ORIGINS` as a JSON array string
- If using Qdrant Cloud, set `QDRANT_URL` and `QDRANT_API_KEY`
- API and worker must share the same DB, Redis, OpenAI, and Qdrant environment values

See [docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md) for the current deploy plan.

## Security Note

If a real `OPENAI_API_KEY` has been stored in local `.env`, rotate it before deployment.
At minimum:

1. Create a new API key in the OpenAI dashboard.
2. Replace the local `.env` value.
3. Update deploy platform environment variables.
4. Delete the old key.

## Repository Layout

```text
SmartCurator/
├── app/         # API, services, worker logic
├── alembic/     # migrations
├── frontend/    # Next.js frontend
├── scripts/     # operational scripts such as reindex
├── test/        # executable tests
└── docs/        # scenarios and deployment notes
```
