# SmartCurator

기사 링크·메모·PDF를 저장해 두고, 자동 요약·태그 뒤에 **비슷한 뜻으로 검색**하거나 **내 자료만 보고 AI에게 질문**할 수 있게 만든 개인용 서비스입니다.  
저장이 끝나면 Celery가 백그라운드에서 요약·태깅·벡터 인덱싱을 돌리고, 프론트에서는 처리 상태와 검색·RAG 결과를 보여 줍니다.

## 데모와 배포 구조

| | |
|---|-----|
| **데모** | https://www.smartcurator.site/ |
| **구조 한 줄** | 화면(Next.js)은 **Vercel**, API·Celery·PostgreSQL·Redis·Qdrant는 **로컬**에서 돌리고, 밖에서 API에 붙을 때는 **Cloudflare Tunnel**로 연결합니다. |
| **트레이드오프** | 클라우드 서버 비용을 거의 안 쓰고, 한국어 임베딩·검색 환경을 로컬 그대로 유지하려고 이렇게 잡았습니다. 대신 **PC·넷·터널 상태에 따라 API가 잠시 끊길 수** 있어요. 상시 운영이면 Named Tunnel이나, 필요할 때 API만 클라우드로 옮기는 식으로 나눠 가면 됩니다. |

배포를 조금 더 파고들 내용은 [docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md)에 적어 두었습니다.

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

## 최근에 손 본 것 (2026-03)

- 로그인할 때부터 `refresh_token`까지 받고, `/auth/refresh`로 액세스 토큰 갱신
- 프론트에서 만료 2분 전쯤 자동으로 refresh 시도
- 처리 중이던 콘텐츠가 완료/실패되면 대시보드에서 토스트로 알림
- 내 콘텐츠 목록: 최근 순, 한 페이지 4개
- 홈·대시보드 문구 인코딩(한글 깨짐) 정리

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

## 직접 돌려볼 때 체크

1. 회원가입 후 로그인
2. 콘텐츠 몇 개 넣어 보기
3. `pending → processing → completed`(또는 failed) 흐름이 UI에서 보이는지
4. 완료/실패 토스트가 뜨는지
5. 의미 검색 — 정확 / 균형 / 넓게 바꿔 보며 결과 차이
6. AI 질문 후 답변·근거 스니펫이 나오는지
7. 액세스 토큰 만료 직전에 자동 refresh가 도는지 (대시 오래 켜 두고 확인)

## 배포 구성 (요약)

위 표 **「데모와 배포 구조」**와 같습니다. 단계별로 올릴 때는 [docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md)를 보면 됩니다.
