# 배포 구조 결정

## 권장 아키텍처

- 프론트엔드: Vercel
- 백엔드 API: Render Web Service
- Celery Worker: Render Background Worker
- PostgreSQL: Render PostgreSQL 또는 Railway PostgreSQL
- Redis: Render Key Value 또는 Railway Redis
- Qdrant: Qdrant Cloud

## 이 구조를 선택한 이유

- 프론트엔드는 표준 Next.js 14 앱이라 Vercel에 가장 적합하다.
- 백엔드는 장시간 실행되는 FastAPI 서비스이므로 안정적인 Python 프로세스 호스팅이 필요하다.
- Celery는 API와 별도의 백그라운드 프로세스로 실행되어야 한다.
- PostgreSQL과 Redis는 표준 매니지드 서비스로 충분하며, 별도 운영 작업이 필요 없다.
- Qdrant는 소규모 포트폴리오 배포에서 직접 호스팅하기 가장 번거로우므로 매니지드가 안전하다.

## 배포 구성

### 프론트엔드

- 플랫폼: Vercel
- 빌드 명령어: `npm run build`
- 환경 변수:
  - `NEXT_PUBLIC_API_BASE_URL`

### 백엔드 API

- 플랫폼: Render Web Service
- 실행 명령어:
  - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- 최초 배포 시 / 사전 설정:
  - `pip install -r requirements.txt`
  - `alembic upgrade head`
  - `python init_vector_db.py`

### Celery Worker

- 플랫폼: Render Background Worker
- 실행 명령어:
  - `celery -A app.core.celery_app worker --loglevel=info`

### 데이터 서비스

- PostgreSQL: 매니지드
- Redis: 매니지드
- Qdrant: 매니지드

## 백엔드 필수 환경 변수

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
- `QDRANT_URL` 또는 `QDRANT_HOST` + `QDRANT_PORT`
- `QDRANT_API_KEY` (Qdrant Cloud 사용 시)

참고:

- `DATABASE_URL`은 Celery와 Alembic용 동기 드라이버여야 한다.
- `ASYNC_DATABASE_URL`은 FastAPI용으로 반드시 `postgresql+asyncpg://...` 형식이어야 한다.
- 운영 환경에서는 비동기 DB URL을 암묵적 변환에 맡기지 말고 명시적으로 지정할 것.

## 프론트엔드 필수 환경 변수

- `NEXT_PUBLIC_API_BASE_URL`

## CORS 규칙

- `ALLOWED_ORIGINS`에 배포된 프론트엔드 URL이 반드시 포함되어야 한다.
- 예시:
  - `["http://localhost:3000","https://your-frontend.vercel.app"]`

## 최소 배포 순서

1. PostgreSQL, Redis, Qdrant 프로비저닝
2. 백엔드 환경 변수 설정
3. 백엔드 API 배포
4. DB 마이그레이션 실행 및 Qdrant 컬렉션 초기화
5. Celery Worker 배포
6. 프론트엔드 배포 (배포된 API base URL 설정)
7. `/health`, 로그인, 콘텐츠 생성, 검색, AI 어시스트 검증

## 운영 참고사항

- 배포 후 Qdrant가 비어 있으면 `python scripts/reindex_vectors.py` 실행
- 콘텐츠가 `pending` 상태에서 멈추면 Celery Worker 로그와 Redis 연결 확인
- 프론트에서 로그인은 되는데 API 호출이 실패하면 `NEXT_PUBLIC_API_BASE_URL`과 `ALLOWED_ORIGINS` 확인
- 로컬 `.env` 파일을 git-ignored로 유지하고 있다면, 배포 전에 유출된 API 키가 없는지 확인 후 교체

## 결정 상태

- 이 프로젝트의 기본 배포 구성: `Vercel + Render + 매니지드 Postgres/Redis + Qdrant Cloud`
- 이유: API와 Worker 프로세스를 분리하면서도 운영 복잡도가 가장 낮은 조합
