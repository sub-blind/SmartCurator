# SmartCurator

AI 기반 개인 지식 관리 프로젝트입니다.  
저장한 콘텐츠를 요약하고, 의미 검색과 RAG 질의응답으로 다시 활용할 수 있게 만드는 것이 목표입니다.

## 핵심 기능

- 콘텐츠 저장: URL 또는 텍스트 입력
- 백그라운드 처리: 본문 추출, 요약, 태그 생성, 벡터 저장
- 의미 검색: 키워드 일치가 아니라 내용 유사도 기반 검색
- RAG 질의응답: 검색된 근거를 바탕으로 답변 + 출처 + confidence 제공

## 기술 스택

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- AI/Retrieval: OpenAI, Sentence Transformers, Qdrant
- Async Job: Celery, Redis
- Frontend: Next.js 14, React 18, Tailwind CSS

## 아키텍처 요약

1. `/contents`로 콘텐츠 저장 (상태: `pending`)
2. Celery 작업에서 크롤링/요약/태깅/벡터화 수행
3. Qdrant에 chunk 단위 벡터 저장
4. `/search/semantic` 또는 `/chat/ask`로 검색/질의응답

## 주요 API

```http
POST   /auth/register
POST   /auth/login
GET    /auth/me
PUT    /auth/profile
POST   /auth/logout

POST   /contents/
GET    /contents/my
GET    /contents/{id}
PUT    /contents/{id}
DELETE /contents/{id}
POST   /contents/{id}/reprocess

GET    /search/semantic
GET    /search/public
POST   /chat/ask
```

## 빠른 실행

### 1) 의존 서비스 실행

```bash
docker run -d -p 6379:6379 redis:latest
docker run -d -p 6333:6333 qdrant/qdrant:latest
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

### 2) 환경 변수(.env)

```env
ENV=development
DEBUG=True

# sync DB (Celery/Alembic)
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/postgres
# async DB (FastAPI)
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/postgres

SECRET_KEY=change-this-secret-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

QDRANT_HOST=localhost
QDRANT_PORT=6333
```

### 3) 백엔드 실행

```bash
pip install -r requirements.txt
alembic upgrade head
python init_vector_db.py
uvicorn app.main:app --reload
```

### 4) Celery 실행

```bash
celery -A app.core.celery_app worker --loglevel=info
```

### 5) 프론트 실행

```bash
cd frontend
npm install
npm run dev
```

## 검증 포인트

- 콘텐츠는 즉시 처리 완료되지 않고 Celery에서 비동기 처리됩니다.
- 검색은 chunk 기반으로 수행한 뒤 content 단위로 묶어 반환합니다.
- RAG 응답에는 sources와 confidence가 포함됩니다.

## 트러블슈팅 (핵심)

- asyncpg 세션을 Celery에서 재사용하던 문제를 분리:
  - FastAPI: async 세션
  - Celery/Alembic: sync 세션
- 짧은 검색 질의의 0건 문제를 완화:
  - 짧은 질의 쿼리 확장
  - 0건 시 threshold fallback 재검색

## 디렉터리 구조

```text
SmartCurator/
├── app/                 # API, core, services, tasks
├── alembic/             # DB migration
├── frontend/            # Next.js app
├── scripts/             # reindex 등 운영 스크립트
├── test/                # 테스트 코드
└── requirements.txt
```
