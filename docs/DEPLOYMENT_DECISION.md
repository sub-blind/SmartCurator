# 배포 구조 결정

## 현재 운영 방식: 로컬 백엔드 + Cloudflare Tunnel + Vercel

한국어 특화 임베딩 모델(`jhgan/ko-sroberta-multitask`)의 높은 검색 품질을 유지하면서
인프라 비용을 최소화하기 위해, 로컬 환경의 충분한 메모리와 연산 자원을 활용하는 구조를 채택했습니다.
Cloudflare Tunnel을 통해 외부 공개가 가능하므로 별도 클라우드 서버 없이도 데모 접근이 가능합니다.

## 아키텍처

| Component | Where | Cost |
|-----------|-------|------|
| Frontend | Vercel (Free) | Free |
| Backend API | Local (`uvicorn`) | Free |
| Celery Worker | Local | Free |
| PostgreSQL | Local Docker | Free |
| Redis | Local Docker | Free |
| Qdrant | Local Docker (or Qdrant Cloud Free) | Free |
| Public Access | Cloudflare Tunnel (or ngrok) | Free |

## 배포 순서 (처음부터 끝까지)

### 1단계: Cloudflare Tunnel 설치

```bash
# Windows (winget)
winget install cloudflare.cloudflared

# 또는 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 에서 직접 다운로드
```

### 2단계: 로컬 서비스 기동

```bash
# Docker 컨테이너 시작
docker start smartcurator-redis smartcurator-qdrant smartcurator-postgres

# 또는 처음이라면
docker run -d --name smartcurator-redis -p 6379:6379 redis:latest
docker run -d --name smartcurator-qdrant -p 6333:6333 qdrant/qdrant:latest
docker run -d --name smartcurator-postgres -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=smartcurator postgres:15
```

```bash
# 터미널 1: 백엔드
.\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python init_vector_db.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
# 터미널 2: Celery Worker
.\venv\Scripts\activate
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 3단계: 터널 실행

```bash
# 터미널 3: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:8000
```

출력에서 `https://xxxx-xxxx-xxxx.trycloudflare.com` 형태의 URL을 복사합니다.

### 4단계: 프론트엔드 배포 (Vercel)

1. https://vercel.com 에서 GitHub 레포 Import
2. Root Directory: `frontend`
3. 환경 변수 설정:
   - `NEXT_PUBLIC_API_BASE_URL` = 3단계에서 받은 터널 URL
4. Deploy

### 5단계: 백엔드 CORS 설정

`.env`의 `ALLOWED_ORIGINS`에 Vercel 도메인을 추가합니다:

```env
ALLOWED_ORIGINS=["http://localhost:3000","https://your-app.vercel.app"]
```

백엔드를 재시작하면 CORS가 적용됩니다.

### 6단계: 검증

- `https://<터널URL>/health` → 200 확인
- Vercel 프론트에서 회원가입/로그인
- 콘텐츠 추가(텍스트/URL/파일 업로드) → Celery 처리 완료 확인
- 의미론적 검색 테스트(정확/균형/넓게 모드)
- AI 어시스트 테스트(근거 출처와 더보기/접기 UI 확인)

PowerShell에서는 `curl`이 `Invoke-WebRequest` 별칭일 수 있으므로, 필요 시 `curl.exe`를 사용합니다.

## 백엔드 환경 변수

| Variable | Description |
|----------|-------------|
| `ENV` | `development` or `production` |
| `DEBUG` | `True` or `False` |
| `DATABASE_URL` | Sync driver (`postgresql+psycopg2://...`) |
| `ASYNC_DATABASE_URL` | Async driver (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | Random long string |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | `gpt-3.5-turbo` |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/1` |
| `QDRANT_HOST` | `localhost` (Local Docker) |
| `QDRANT_PORT` | `6333` |
| `ALLOWED_ORIGINS` | JSON array string |

Qdrant Cloud 사용 시 `QDRANT_URL` + `QDRANT_API_KEY`로 대체합니다.

## 프론트엔드 환경 변수

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Tunnel URL or custom domain |

## 운영 참고사항

- 노트북이 꺼지거나 네트워크가 끊기면 서비스가 중단됩니다.
- Cloudflare Tunnel 무료 모드(`trycloudflare.com`)는 재시작 시 URL이 바뀝니다.
  - 고정 URL이 필요하면 Cloudflare Zero Trust에서 Named Tunnel을 설정하거나 커스텀 도메인을 연결합니다.
- Qdrant가 비어 있으면 `python scripts/reindex_vectors.py`를 실행합니다.
- 콘텐츠가 `pending`에서 멈추면 Celery 로그와 Redis 연결을 확인합니다.
- 노트북 절전/자동 꺼짐을 반드시 해제해야 합니다.

## 클라우드 전환 경로

트래픽 증가 또는 상시 가용성이 필요해질 경우:

- Frontend: Vercel
- Backend API: Render Web Service or AWS ECS
- Celery Worker: Render Background Worker or AWS ECS
- PostgreSQL: Render PostgreSQL / AWS RDS
- Redis: Render Key Value / AWS ElastiCache
- Qdrant: Qdrant Cloud
