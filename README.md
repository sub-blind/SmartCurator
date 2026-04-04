# SmartCurator

SmartCurator는 URL, 메모/본문, PDF, 유튜브 링크를 저장하면 요약, 태그, 벡터 검색까지 이어지는 개인 지식 큐레이션 서비스입니다. 저장된 자료를 다시 찾기 쉽게 만들고, 근거 기반 질문 응답까지 연결하는 흐름을 목표로 했습니다.

## 배포 구조

| 항목 | 내용 |
|------|------|
| 주소 | <https://www.smartcurator.site/> |
| 프론트엔드 | Next.js, Vercel |
| 백엔드 | FastAPI |
| 비동기 처리 | Celery, Redis |
| 메인 DB | PostgreSQL |
| 벡터 검색 | Qdrant |
| 외부 연결 | Cloudflare Tunnel |

배포 의사결정 배경은 [docs/DEPLOYMENT_DECISION.md](docs/DEPLOYMENT_DECISION.md)에 정리했습니다.

## 핵심 기능

- URL / 메모·본문 / PDF / 유튜브 4종 입력 지원
- Celery 기반 비동기 처리 파이프라인
  - `pending -> processing -> completed/failed`
- OpenAI 기반 요약 및 태그 생성
- 한국어 임베딩 + Qdrant 기반 시맨틱 검색
- RAG 기반 AI 질의응답과 근거 출처 노출
- 랜딩 페이지에서 바로 가져오기 + 결과 카드 미리보기
- 로그인 상태에 따른 랜딩 CTA 분기
- Access/Refresh 토큰 기반 자동 세션 갱신
- 처리 완료/실패 토스트와 재처리 흐름

## 최근 반영 내용

### 2026-04-04 기준

- RAG 검색 품질 개선
  - 질문 핵심 엔티티 기반 필터링
  - noisy chunk 제거
  - fallback threshold, rerank 기준 강화
- 짧은 콘텐츠 요약 경로 경량화
  - 짧은 문서는 단일 요약 경로로 처리
  - usable한 스크래핑 제목은 AI 제목 생성 생략
- 썸네일 확보율 개선
  - 웹 문서의 `og:image`, `twitter:image`, `JSON-LD image`, 대표 이미지 후보 탐색
  - 기존 유튜브 콘텐츠 빈 썸네일 자동 백필
- 홈 랜딩 페이지 개선
  - 유튜브 / 웹사이트 / PDF / 메모·본문 탭 제공
  - PDF는 랜딩에서 바로 첨부 후 가져오기 가능
  - 로그인 전에는 가운데 로그인/회원가입 CTA 박스 노출

## 성능 및 품질 지표

내부 측정 기준:

- 전체 콘텐츠 처리 성공률: `93.5%`
- 공개 검색 테스트 질의 기준:
  - Top-1 적중률: `90.0%`
  - Top-3 적중률: `90.0%`
- 평균 검색 응답 시간: `약 2217ms`

개선 전/후 주요 수치:

- 대표 질의 기준 비관련 근거 혼입률: `83.3% -> 0%`
- 짧은 콘텐츠 처리 시간(동일 샘플): `4.32초 -> 2.40초`
- 완료 콘텐츠 기준 썸네일 확보율: `37.0% -> 47.8%`

상세 전/후 기록은 로컬 문서 `docs/private/performance_before_after.md`에 정리했습니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Alembic |
| Async | Celery, Redis |
| Database | PostgreSQL |
| Search | Sentence Transformers (`jhgan/ko-sroberta-multitask`), Qdrant |
| AI | OpenAI |

## 주요 API

```text
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

### 1. 필수 서비스

```bash
docker run -d -p 6379:6379 redis:latest
docker run -d -p 6333:6333 qdrant/qdrant:latest
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

PostgreSQL 데이터베이스 생성:

```bash
docker exec -it <postgres-container-id> psql -U postgres -c "CREATE DATABASE smartcurator;"
```

### 2. 백엔드

`.env.example`을 복사해 `.env`를 만든 뒤 값을 채웁니다.

```bash
pip install -r requirements.txt
alembic upgrade head
python init_vector_db.py
uvicorn app.main:app --reload
```

### 3. Celery

```bash
celery -A app.core.celery_app worker --loglevel=info
```

Windows:

```bash
celery -A app.core.celery_app worker --loglevel=info --pool=solo --concurrency=1
```

### 4. 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 점검 체크리스트

1. 회원가입 / 로그인
2. URL, 메모/본문, PDF, 유튜브 각각 저장
3. `pending -> processing -> completed/failed` 흐름 확인
4. 처리 완료/실패 토스트 확인
5. 랜딩 페이지에서 바로 가져오기 동작 확인
6. 랜딩 결과 카드 썸네일 / fallback 커버 확인
7. 검색 결과와 RAG 근거 출처 품질 확인
8. 라이트/다크 모드 전환과 가독성 확인
9. 토큰 자동 갱신 및 만료 시 로그아웃 흐름 확인
