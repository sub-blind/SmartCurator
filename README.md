# SmartCurator

SmartCurator는 저장한 기사/노트/파일을 다시 활용할 수 있게 만드는 개인 지식 큐레이션 서비스입니다.
콘텐츠를 저장하면 Celery 워커가 비동기로 요약·태깅·벡터화를 수행하고,
사용자는 의미 검색과 RAG 질의응답으로 지식을 재사용할 수 있습니다.

## 핵심 기능

- URL/텍스트/PDF(TXT, MD) 콘텐츠 저장
- Celery 비동기 처리 (`pending -> processing -> completed/failed`)
- 본문 요약 및 태그 자동 생성
- Qdrant 기반 chunk 단위 벡터 인덱싱
- 의미 검색 + 하이브리드 재정렬(유사도 + 토큰 오버랩)
- RAG 답변 + 근거 출처(snippet) 제공
- 대시보드 우측 상단 처리 완료/실패 토스트 알림
- 내 콘텐츠 최근순 페이지네이션(페이지당 4개)
- 인증: Access/Refresh 토큰 기반 자동 세션 갱신

## 스크린샷

| 로그인 | 대시보드 · 처리 큐 |
|:--:|:--:|
| ![로그인 화면](docs/screenshots/01-login.png) | ![대시보드 - 대기/처리 큐](docs/screenshots/02-dashboard-queue.png) |

| 대시보드 · 요약·태그·완료 토스트 | 의미 검색 + RAG 어시스턴트 |
|:--:|:--:|
| ![대시보드 - 요약 및 완료 알림](docs/screenshots/03-dashboard-summary-toast.png) | ![의미 검색과 AI 질의·근거](docs/screenshots/04-semantic-search-rag.png) |

## 오늘 기준 변경 사항 (2026-03)

- `/auth/refresh` 엔드포인트 추가
- 로그인 응답이 `access_token + refresh_token` 반환
- 프론트에서 만료 2분 전 자동 refresh
- 상태 전이(`processing -> completed/failed`) 감지 토스트 추가
- 대시보드 목록 최근순/4개 페이지네이션 추가
- 홈/대시보드 텍스트 모지바케(한글 깨짐) 정리

## 기술 스택

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- Worker: Celery, Redis
- Retrieval: Sentence Transformers (`jhgan/ko-sroberta-multitask`), Qdrant
- LLM: OpenAI
- Frontend: Next.js 14, React 18, Tailwind CSS

## 인증 구조 (현재)

- Access Token: 기본 30분 (`ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh Token: 기본 14일 (`REFRESH_TOKEN_EXPIRE_DAYS`)
- 프론트 저장 키:
  - `smartcurator_token`
  - `smartcurator_refresh_token`
  - `smartcurator_email`
- 자동 갱신 흐름:
  1. 로그인 시 access/refresh 저장
  2. 만료 임박(2분 전) 시 `/auth/refresh` 호출
  3. 새 access/refresh로 교체 저장
  4. refresh 실패 시 로그아웃 처리

## 주요 API

```http
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
GET    /auth/me
PUT    /auth/profile
POST   /auth/logout

GET    /health
POST   /contents/
POST   /contents/upload
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

## 로컬 실행

### 1) 의존 서비스 실행

```bash
docker run -d -p 6379:6379 redis:latest
docker run -d -p 6333:6333 qdrant/qdrant:latest
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

PostgreSQL DB 생성:

```bash
docker exec -it <postgres-container-id> psql -U postgres -c "CREATE DATABASE smartcurator;"
```

### 2) 백엔드 환경변수 설정

`.env.example` 복사 후 `.env` 생성:

```env
ENV=development
DEBUG=True
ALLOWED_ORIGINS=["http://localhost:3000"]

DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/smartcurator
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/smartcurator

SECRET_KEY=replace-me
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14

OPENAI_API_KEY=replace-me
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

Windows:

```bash
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 5) 프론트 실행

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 운영 체크리스트

1. 회원가입 -> 로그인
2. 콘텐츠 2~3개 추가
3. 상태 전이 확인 (`pending -> processing -> completed`)
4. 완료/실패 토스트 노출 확인
5. 의미 검색(정확/균형/넓게) 확인
6. AI 어시스턴트 질문 + 출처 확인
7. 토큰 만료 임박 시 자동 refresh 동작 확인

## 배포 구성

현재 기준: **Local Backend + Cloudflare Tunnel + Vercel Frontend**

- Frontend: Vercel
- Backend API/Celery/PostgreSQL/Redis/Qdrant: 로컬
- 외부 공개: Cloudflare Tunnel

자세한 배포/운영 기준은 [docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md)를 참고하세요.
