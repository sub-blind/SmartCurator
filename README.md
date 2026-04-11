# SmartCurator

SmartCurator는 URL, 메모/본문, PDF, 유튜브 링크를 저장하면 요약, 태그, 벡터 검색까지 이어지는 개인 지식 큐레이션 서비스입니다. 저장된 자료를 다시 찾기 쉽게 만들고, 근거 기반 질문 응답까지 연결하는 흐름을 목표로 했습니다.

## 화면

| 랜딩 페이지 — 저장 & 미리보기 | 대시보드 — 검색 & AI 질의응답 |
| --- | --- |
|![1](https://github.com/user-attachments/assets/50d4cf27-ddd4-4069-b6df-3633edf687a1) | ![4](https://github.com/user-attachments/assets/07fc7c58-0e59-4248-8796-c83e5f8004bf)

|
| URL·유튜브·PDF·메모 탭 전환, 가져오기 즉시 오른쪽에 요약 카드 노출 | 의미 기반 검색(정확·균형·넓게), 내 자료 근거 RAG 질의응답 |

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
- Celery 기반 비동기 처리 파이프라인 (`pending → processing → completed/failed`)
- OpenAI 기반 요약 및 태그 자동 생성
- 한국어 임베딩(`jhgan/ko-sroberta-multitask`) + Qdrant 기반 시맨틱 검색
  - 벡터 유사도(0.7)와 토큰 오버랩(0.3)을 결합한 하이브리드 리랭킹
  - `precise / balanced / broad` 3단계 검색 모드
- RAG 기반 AI 질의응답 — 내 자료만 근거로 답변 + 출처 chunk 노출
- 랜딩 페이지에서 바로 가져오기 + 결과 카드 미리보기
- Access/Refresh 토큰 기반 자동 세션 갱신
- 처리 완료/실패 토스트와 재처리 흐름

## 최근 반영 내용

### 2026-04-04 기준

- RAG 검색 품질 개선
  - 질문 핵심 엔티티(anchor term) 기반 필터링
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
  - 로그인 전에는 로그인/회원가입 CTA 박스 노출

## 성능 및 품질 지표

내부 측정 기준:

- 전체 콘텐츠 처리 성공률: `93.5%`
- 공개 검색 테스트 질의 기준:
  - Top-1 적중률: `90.0%`
  - Top-3 적중률: `90.0%`
- 평균 검색 응답 시간: `약 2,217ms`

개선 전/후 주요 수치:

| 항목 | 개선 전 | 개선 후 |
| --- | --- | --- |
| 비관련 근거 혼입률 (대표 질의 기준) | 83.3% | 0% |
| 짧은 콘텐츠 처리 시간 (동일 샘플) | 4.32초 | 2.40초 (-44.5%) |
| 요약 관련 LLM 호출 수 (완료 콘텐츠 기준) | 392회 | 331회 (-15.6%) |
| 썸네일 확보율 (완료 콘텐츠 기준) | 37.0% | 47.8% |
| 썸네일 확보율 (URL 콘텐츠 기준) | 42.5% | 55.0% |

상세 전/후 기록은 `docs/private/performance_before_after.md`에 정리했습니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Alembic |
| Async | Celery, Redis |
| Database | PostgreSQL 15 |
| Vector DB | Qdrant |
| Embedding | Sentence Transformers — `jhgan/ko-sroberta-multitask` (768차원) |
| AI | OpenAI API (GPT-3.5/4) |
| Infra | Vercel, Cloudflare Tunnel |

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

GET    /search/semantic?q=검색어&mode=balanced&limit=10
         mode: precise(정확, 0.45) / balanced(균형, 0.25) / broad(넓게, 0.12)
GET    /search/public?q=검색어&mode=balanced
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

## 테스트

외부 서비스(DB, OpenAI, Qdrant) 연결 없이 실행됩니다.

```bash
pip install -r requirements-test.txt
pytest
```

핵심 로직(RAG 리랭킹, 시맨틱 검색 랭킹, 콘텐츠 파이프라인 분기)에 대해 116개 단위 테스트를 작성했습니다.

## 점검 체크리스트

1. 회원가입 / 로그인
2. URL, 메모/본문, PDF, 유튜브 각각 저장
3. `pending → processing → completed/failed` 흐름 확인
4. 처리 완료/실패 토스트 확인
5. 랜딩 페이지에서 바로 가져오기 동작 확인
6. 랜딩 결과 카드 썸네일 / fallback 커버 확인
7. 검색 모드(정확/균형/넓게) 전환과 결과 품질 확인
8. RAG 답변과 근거 출처 확인
9. 라이트/다크 모드 전환과 가독성 확인
10. 토큰 자동 갱신 및 만료 시 로그아웃 흐름 확인

전체 점검 시나리오는 [docs/SCENARIO_A_TO_Z.md](docs/SCENARIO_A_TO_Z.md)를 참고하세요.
