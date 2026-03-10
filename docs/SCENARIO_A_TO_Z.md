# SmartCurator 기능 점검 시나리오 (A to Z)

서버 기동부터 전체 기능 검증까지 순서대로 진행하는 시나리오입니다.

---

## 복붙용 명령어 전체 (순서대로)

### 1) Docker 서비스 실행

```bash
docker run -d --name smartcurator-redis -p 6379:6379 redis:latest
docker run -d --name smartcurator-qdrant -p 6333:6333 qdrant/qdrant:latest
docker run -d --name smartcurator-postgres -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=postgres postgres:15
```

이미 있으면:

```bash
docker start smartcurator-redis smartcurator-qdrant smartcurator-postgres
```

### 2) .env 파일 생성 후 아래 내용 채우기

```
ENV=development
DEBUG=True
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/postgres
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/postgres
SECRET_KEY=change-this-secret-key-to-random-string
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

### 3) 백엔드 (터미널 1)

```bash
.\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python init_vector_db.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4) Celery (터미널 2)

```bash
.\venv\Scripts\activate
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 5) 프론트 (터미널 3)

```bash
cd frontend
npm install
cp env.example .env.local
# Windows CMD: copy env.example .env.local
npm run dev
```

### 6) 헬스 체크

```bash
curl http://localhost:8000/health
curl http://localhost:8000/search/health
curl http://localhost:8000/chat/health
```

### 7) 회원가입

```bash
curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"test1234\",\"full_name\":\"테스트 유저\"}"
```

### 8) 로그인 (토큰 저장)

```bash
curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"test1234\"}"
```

### 9) 내 정보 조회 (TOKEN을 발급받은 access_token으로 교체)

```bash
curl http://localhost:8000/auth/me -H "Authorization: Bearer TOKEN"
```

### 10) 콘텐츠 추가 (TOKEN 교체)

```bash
curl -X POST http://localhost:8000/contents/ -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"async DB와 sync DB 분리 이유\",\"raw_content\":\"FastAPI는 비동기로 동작하고 Celery는 동기로 동작합니다. asyncpg 세션을 Celery에서 재사용하면 event loop 충돌이 발생합니다. 따라서 FastAPI용 async 세션과 Celery용 sync 세션을 분리했습니다.\",\"content_type\":\"text\",\"is_public\":false}"
```

### 11) 콘텐츠 조회 (TOKEN, ID 교체)

```bash
curl http://localhost:8000/contents/ID -H "Authorization: Bearer TOKEN"
```

### 12) 콘텐츠 재처리 (TOKEN, ID 교체)

```bash
curl -X POST http://localhost:8000/contents/ID/reprocess -H "Authorization: Bearer TOKEN"
```

### 13) 내 콘텐츠 목록 (TOKEN 교체)

```bash
curl "http://localhost:8000/contents/my?skip=0&limit=20" -H "Authorization: Bearer TOKEN"
```

### 14) 의미검색 (TOKEN 교체)

```bash
curl "http://localhost:8000/search/semantic?q=RAG&limit=5" -H "Authorization: Bearer TOKEN"
```

### 15) RAG 질문 (TOKEN 교체)

```bash
curl -X POST http://localhost:8000/chat/ask -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{\"question\":\"이 프로젝트에서 왜 async DB와 sync DB를 분리했나요?\"}"
```

### 16) 콘텐츠 수정 (TOKEN, ID 교체)

```bash
curl -X PUT http://localhost:8000/contents/ID -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"수정된 제목\",\"is_public\":true}"
```

### 17) 콘텐츠 삭제 (TOKEN, ID 교체)

```bash
curl -X DELETE http://localhost:8000/contents/ID -H "Authorization: Bearer TOKEN"
```

---

## Phase 0: 사전 준비

- Python 3.10+ (venv 권장)
- Node.js 18+
- Docker (Redis, Qdrant, PostgreSQL)
- OpenAI API Key

---

## Phase 1: 서버 기동 (순서 중요)

### 1-1. 의존 서비스 실행 (Docker)

```bash
# Redis
docker run -d --name smartcurator-redis -p 6379:6379 redis:latest

# Qdrant
docker run -d --name smartcurator-qdrant -p 6333:6333 qdrant/qdrant:latest

# PostgreSQL
docker run -d --name smartcurator-postgres -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=postgres postgres:15
```

이미 컨테이너가 있으면:

```bash
docker start smartcurator-redis smartcurator-qdrant smartcurator-postgres
```

### 1-2. 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
ENV=development
DEBUG=True

DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/postgres
ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/postgres

SECRET_KEY=change-this-secret-key-to-random-string
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

QDRANT_HOST=localhost
QDRANT_PORT=6333
```

### 1-3. 백엔드 초기화 및 실행

```bash
# venv 활성화 (예: Windows)
.\venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# DB 마이그레이션
alembic upgrade head

# Qdrant 컬렉션 초기화
python init_vector_db.py

# FastAPI 서버 실행 (터미널 1)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 1-4. Celery 워커 실행

```bash
# 새 터미널 (터미널 2)
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 1-5. 프론트엔드 실행

```bash
# 새 터미널 (터미널 3)
cd frontend
npm install
cp env.example .env.local
# .env.local에 NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 확인
npm run dev
```

---

## Phase 2: 기본 기동 확인

### 2-1. 헬스 체크

| 엔드포인트 | 기대 응답 |
|------------|-----------|
| `GET http://localhost:8000/` | `status: healthy` |
| `GET http://localhost:8000/health` | `status: healthy` |
| `GET http://localhost:8000/search/health` | `status: healthy` |
| `GET http://localhost:8000/chat/health` | `status: healthy` |

```bash
curl http://localhost:8000/health
curl http://localhost:8000/search/health
curl http://localhost:8000/chat/health
```

### 2-2. 프론트 접속

- 브라우저에서 `http://localhost:3000` 접속
- 로그인/회원가입 버튼이 보이면 OK

---

## Phase 3: 회원가입 / 로그인 시나리오

### 3-1. 회원가입

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","full_name":"테스트 유저"}'
```

**기대 결과**: `id`, `email`, `full_name` 등 사용자 정보 반환

### 3-2. 로그인

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'
```

**기대 결과**: `access_token`, `token_type: bearer` 반환  
→ 이후 요청에 `Authorization: Bearer {access_token}` 사용

### 3-3. 내 정보 조회

```bash
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer {발급받은_토큰}"
```

**기대 결과**: 방금 만든 사용자 정보 조회 가능

### 3-4. 실패 체크

- **중복 이메일 회원가입**: 400
- **잘못된 비밀번호 로그인**: 401

---

## Phase 4: 콘텐츠 추가 및 비동기 처리 시나리오

### 4-1. 텍스트 콘텐츠 추가

```bash
curl -X POST http://localhost:8000/contents/ \
  -H "Authorization: Bearer {토큰}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "async DB와 sync DB 분리 이유",
    "raw_content": "FastAPI는 비동기(async)로 동작하고, Celery 워커는 동기(sync)로 동작합니다. asyncpg 세션을 Celery에서 재사용하면 event loop 충돌이 발생합니다. 따라서 FastAPI용 async 세션과 Celery/Alembic용 sync 세션을 분리했습니다.",
    "content_type": "text",
    "is_public": false
  }'
```

**기대 결과**: `id`, `status: pending` 등 반환

### 4-2. 등록 직후 조회

```bash
curl http://localhost:8000/contents/{id} \
  -H "Authorization: Bearer {토큰}"
```

**기대 결과**: `status: pending` 또는 `processing`

### 4-3. 10~30초 후 재조회

**기대 결과**:
- `status: completed`
- `summary` 채워짐
- `tags` 배열 존재

### 4-4. Celery 로그 확인

터미널 2에서 `processing` → `completed` 흐름 확인

### 4-5. 추가 콘텐츠 (검색/RAG 테스트용)

동일 방식으로 2~3개 더 추가 (예: 짧은 검색 품질 개선, 콘텐츠 처리 파이프라인 등)

---

## Phase 5: 콘텐츠 재처리 시나리오

```bash
curl -X POST http://localhost:8000/contents/{id}/reprocess \
  -H "Authorization: Bearer {토큰}"
```

**기대 결과**: `message: 컨텐츠 재처리가 시작되었습니다`  
→ 상태가 다시 `pending` → `processing` → `completed` 흐름

---

## Phase 6: 내 콘텐츠 목록 / 권한 시나리오

### 6-1. 목록 조회

```bash
curl "http://localhost:8000/contents/my?skip=0&limit=20" \
  -H "Authorization: Bearer {토큰}"
```

**기대 결과**: 본인 콘텐츠만 목록에 나타남

### 6-2. 권한 체크 (선택)

- 다른 사용자 계정 생성 후 로그인
- 첫 번째 사용자의 비공개 콘텐츠 `GET /contents/{id}` 호출
- **기대**: 403 Forbidden

---

## Phase 7: 의미검색 시나리오

### 7-1. 짧은 질의

```bash
curl "http://localhost:8000/search/semantic?q=RAG&limit=5" \
  -H "Authorization: Bearer {토큰}"
```

### 7-2. 주제 질의

```bash
curl "http://localhost:8000/search/semantic?q=짧은%20질의%20검색%20품질&limit=5" \
  -H "Authorization: Bearer {토큰}"
```

### 7-3. 설명형 질의

```bash
curl "http://localhost:8000/search/semantic?q=이%20프로젝트의%20검색%20방식&limit=5" \
  -H "Authorization: Bearer {토큰}"
```

**기대 결과**:
- `total > 0`
- `results`에 `title`, `summary`, `similarity_score`, `matched_chunks`, `top_snippet` 존재
- 짧은 질의도 0건만 반복되지 않음

---

## Phase 8: RAG 질문응답 시나리오

### 8-1. 근거 확인 가능한 질문

```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Authorization: Bearer {토큰}" \
  -H "Content-Type: application/json" \
  -d '{"question":"이 프로젝트에서 왜 async DB와 sync DB를 분리했나요?"}'
```

### 8-2. 추가 질문

```bash
# 질문 2
curl -X POST http://localhost:8000/chat/ask \
  -H "Authorization: Bearer {토큰}" \
  -H "Content-Type: application/json" \
  -d '{"question":"짧은 검색 질의 품질을 어떻게 개선했어?"}'

# 질문 3
curl -X POST http://localhost:8000/chat/ask \
  -H "Authorization: Bearer {토큰}" \
  -H "Content-Type: application/json" \
  -d '{"question":"콘텐츠를 추가하면 어떤 처리 단계를 거쳐?"}'
```

**기대 결과**:
- `answer` 비어있지 않음
- `sources` 배열 포함
- `confidence` 0~1 범위

---

## Phase 9: 수정 / 삭제 시나리오

### 9-1. 수정

```bash
curl -X PUT http://localhost:8000/contents/{id} \
  -H "Authorization: Bearer {토큰}" \
  -H "Content-Type: application/json" \
  -d '{"title":"수정된 제목","is_public":true}'
```

**기대 결과**: 상세 조회 시 수정 반영

### 9-2. 삭제

```bash
curl -X DELETE http://localhost:8000/contents/{id} \
  -H "Authorization: Bearer {토큰}"
```

**기대 결과**: 목록에서 사라짐, 벡터도 삭제됨

---

## Phase 10: 실패 시나리오 (선택)

| 시나리오 | 기대 |
|----------|------|
| 잘못된 토큰으로 보호 API 접근 | 401 |
| OpenAI 키 오류 시 콘텐츠 처리 | status: failed |
| Qdrant 미가동 시 검색 | 500 또는 명확한 오류 메시지 |

---

## 데모용 최소 시나리오 (3분)

1. 회원가입 → 로그인 → `/auth/me`
2. 텍스트 콘텐츠 1개 추가
3. 20초 대기 후 `status: completed` 확인
4. 의미검색 1회 (`q=RAG`)
5. RAG 질문 1회 (`이 프로젝트에서 왜 async DB와 sync DB를 분리했나요?`)

---

## 데모용 샘플 질문

- 이 프로젝트에서 왜 async DB와 sync DB를 분리했나요?
- 짧은 검색 질의 품질을 어떤 방식으로 개선했나요?
- 콘텐츠 등록 후 어떤 비동기 처리 단계가 실행되나요?
- 이 프로젝트의 핵심 기능을 요약해줘
