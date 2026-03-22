# SmartCurator

AI 기반 개인 지식 큐레이션 프로젝트입니다.
기사나 노트를 저장하면 비동기로 요약·태깅·벡터화하고, 의미 검색과 RAG 질의응답으로 다시 활용할 수 있습니다.

## 핵심 기능

- URL 또는 텍스트로 콘텐츠 저장
- PDF/TXT 파일 업로드로 콘텐츠 저장
- Celery 비동기 백그라운드 처리
- 본문 요약 및 태그 자동 생성
- Qdrant 기반 chunk 단위 벡터 인덱싱
- 저장된 지식에 대한 의미론적 검색
- 출처와 신뢰도를 포함한 RAG 질의응답

## 현재 구현 상태

- 인증 흐름: 회원가입, 로그인, 프로필 조회, 로그아웃
- 대시보드 UI: 콘텐츠 목록(상태 뱃지, 요약/태그), 새로고침, 삭제, 재처리, 전체 요약 보기
- 빠른 추가: 기사 URL, 텍스트 노트, PDF/TXT 파일 입력
- 의미론적 검색: 정확도 모드(정확/균형/넓게) + 콘텐츠 단위 그룹핑 + 핵심 snippet 표시
- AI 어시스트: 답변 텍스트, 근거 chunk, confidence 반환 + 출처 snippet 더보기/접기
- Qdrant 벡터 리인덱스 및 복구 흐름

## 기술 스택

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- Worker: Celery, Redis
- Retrieval: Sentence Transformers (`jhgan/ko-sroberta-multitask`), Qdrant
- LLM: OpenAI
- Frontend: Next.js 14, React 18, Tailwind CSS

## 아키텍처 요약

1. `POST /contents/`로 콘텐츠 저장 (상태: `pending`)
2. Celery가 작업을 가져와 처리 시작
3. 워커가 본문 추출 → 요약 생성 → 태그 생성 → Qdrant에 벡터 저장
4. `GET /search/semantic`으로 chunk 벡터를 검색하고 콘텐츠 단위로 그룹핑
5. `POST /chat/ask`로 관련 chunk를 검색한 뒤 RAG 답변 + 출처를 생성

## 주요 API

```http
POST   /auth/register
POST   /auth/login
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

## 사전 요구사항

- Python 3.10+
- Node.js 18+
- Docker
- OpenAI API 키

## 로컬 실행

### 1. 의존 서비스 실행

```bash
docker run -d -p 6379:6379 redis:latest
docker run -d -p 6333:6333 qdrant/qdrant:latest
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

PostgreSQL 컨테이너가 올라온 뒤 애플리케이션 DB를 생성합니다:

```bash
docker exec -it <postgres-container-id> psql -U postgres -c "CREATE DATABASE smartcurator;"
```

### 2. 백엔드 환경 변수

`.env.example`을 복사해 `.env`를 만들고 아래 값을 설정합니다.

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

참고:

- `DATABASE_URL`은 Celery와 Alembic이 사용합니다.
- `ASYNC_DATABASE_URL`은 FastAPI가 사용합니다.
- 배포 환경에서는 자동 sync/async 변환에 의존하지 말고 두 값을 모두 명시적으로 설정하세요.

### 3. 백엔드 실행

```bash
pip install -r requirements.txt
alembic upgrade head
python init_vector_db.py
uvicorn app.main:app --reload
```

### 4. Celery 실행

```bash
celery -A app.core.celery_app worker --loglevel=info
```

Windows에서는 solo pool을 사용하세요:

```bash
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 5. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드 환경 변수:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 6. 헬스 체크

모든 서비스가 올라온 뒤 아래 엔드포인트로 상태를 확인합니다:

- `GET /`
- `GET /health`
- `GET /search/health`
- `GET /chat/health`

### 7. 첫 실행 검증 흐름

1. 프론트엔드에서 회원가입
2. 대시보드에서 URL 하나, 텍스트 노트 하나를 추가
3. 콘텐츠 상태가 `pending` → `processing` → `completed`로 바뀔 때까지 대기
4. 의미론적 검색을 실행해 snippet이 표시되는지 확인
5. AI 어시스트에서 질문 후 `sources`와 `confidence`가 반환되는지 확인

## 검색 및 RAG 참고사항

품질과 데모 안정성을 위해 적용된 사항:

- 기본 임계치 + 상위 결과 대비 상대 필터로 저품질 검색 결과를 제외
- 낮은 점수의 RAG 출처는 답변 출처 목록에서 제외
- 같은 기사의 중복 출처는 하나로 축약
- 검색/출처 snippet에서 공유 버튼·지면·복사 문구 등 노이즈 제거
- 검색/출처 snippet은 더보기/접기 UI로 가독성 개선
- `python scripts/reindex_vectors.py`로 벡터 재인덱싱 지원

## 검증 체크리스트

권장 수동 검증 흐름:

1. 회원가입 후 로그인
2. 3~5개의 콘텐츠 추가
3. Celery 처리 완료 대기
4. 의미 검색 테스트:
   - 짧은 키워드 질의
   - 문장형 질의
   - 모호한 질의
5. AI 어시스트 테스트:
   - 근거가 명확한 질문
   - 근거가 약하거나 없는 질문
6. 콘텐츠 하나를 재처리하고 검색/RAG 결과가 갱신되는지 확인

확인 포인트:

- 일반적인 질의에서 검색 결과가 반복적으로 0건이 되지 않아야 합니다.
- 매우 약한 매칭이 결과 목록을 지배하지 않아야 합니다.
- `sources`와 `confidence`가 합리적으로 보여야 합니다.
- 재처리 후 수동 DB 수정 없이 벡터가 갱신되어야 합니다.

## 복구 및 운영

### Qdrant가 비어 있을 때

```bash
python scripts/reindex_vectors.py
```

### 콘텐츠가 `pending` 상태로 멈춰 있을 때

- Celery 워커 로그를 확인합니다.
- Redis 연결 값을 확인합니다.
- `CELERY_BROKER_URL`과 `CELERY_RESULT_BACKEND`를 점검합니다.

### 재시작 후 검색이 실패할 때

- Qdrant 접근 가능 여부를 확인합니다.
- 컬렉션 존재 여부를 확인합니다.
- 필요 시 리인덱싱합니다.

### 프론트엔드 API 요청이 브라우저에서 실패할 때

- `NEXT_PUBLIC_API_BASE_URL` 확인
- `ALLOWED_ORIGINS` 확인
- 배포된 프론트엔드 URL이 CORS 허용 목록에 포함되어 있는지 확인

## 배포 구성

현재 배포 구성: **Local Backend + Cloudflare Tunnel + Vercel Frontend**

| Component | Where | Cost |
| --------- | ----- | ---- |
| Frontend | Vercel (Free) | Free |
| Backend API | Local (`uvicorn`) | Free |
| Celery Worker | Local | Free |
| PostgreSQL | Local Docker | Free |
| Redis | Local Docker | Free |
| Qdrant | Local Docker (or Qdrant Cloud Free) | Free |
| Public Access | Cloudflare Tunnel | Free |

한국어 특화 임베딩 모델(`jhgan/ko-sroberta-multitask`)의 높은 검색 품질을 유지하면서
인프라 비용을 최소화하기 위해, 로컬 환경의 충분한 메모리와 연산 자원을 활용하는 구조를 채택했습니다.

자세한 내용은 [docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md)를 참고하세요.

## 외부 공개 (Cloudflare Tunnel)

로컬 백엔드를 외부에서 접근할 수 있도록 터널을 사용합니다.

```bash
# Cloudflare Tunnel 설치 후
cloudflared tunnel --url http://localhost:8000
```

터널이 부여한 공개 URL을 다음 위치에 반영합니다:

- Vercel 환경 변수: `NEXT_PUBLIC_API_BASE_URL=<터널 URL>`
- 백엔드 `.env`: `ALLOWED_ORIGINS`에 Vercel 도메인 추가

## 보안 참고

- API 키와 DB 비밀번호가 유출되지 않도록 `.env`는 반드시 `.gitignore`에 포함합니다.
- 키 교체 절차:
  1. 새 키를 발급합니다 (OpenAI, Qdrant 등).
  2. `.env` 값을 교체합니다.
  3. 서비스를 재시작합니다.
  4. 이전 키를 삭제합니다.

## 디렉터리 구조

```text
SmartCurator/
├── app/         # API, 서비스, 워커 로직
├── alembic/     # DB 마이그레이션
├── frontend/    # Next.js 프론트엔드
├── scripts/     # reindex 등 운영 스크립트
├── test/        # 테스트 코드
└── docs/        # 시나리오 및 배포 문서
```
