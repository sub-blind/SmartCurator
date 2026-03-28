# 처음부터 끝까지 한번 점검할 때 (로컬 기준)

Vercel에 올린 프론트를 보려면 `NEXT_PUBLIC_API_BASE_URL`이 실제로 쓰는 API 주소(예: Tunnel로 열어 둔 도메인)를 가리키는지 먼저 확인하면 됩니다.

## 1. 다 띄우기

1. Redis, Qdrant, PostgreSQL 실행  
2. 백엔드: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`  
3. Celery: `celery -A app.core.celery_app worker --loglevel=info`  
   - Windows면 `--pool=solo --concurrency=1` 같이 맞춰 주기  
4. 프론트: `cd frontend && npm run dev`  

## 2. 로그인 흐름

1. `POST /auth/register`로 계정 만들기  
2. `POST /auth/login` → `access_token`, `refresh_token` 들어오는지  
3. `GET /auth/me`  
4. 브라우저에서 액세스 만료 직전(설정상 대략 2분 전)에 `/auth/refresh`가 알아서 도는지  

## 3. 콘텐츠

1. `POST /contents/` 또는 `POST /contents/upload`  
2. DB·UI에서 `pending` → `processing` → `completed` 또는 `failed`  
3. 토스트도 같이 오는지  

## 4. 검색·RAG

1. 대시보드에서 의미 검색 (`GET /search/semantic`)  
2. 정확 / 균형 / 넓게 바꿔 보기  
3. `POST /chat/ask` — 답, 근거, confidence  

## 5. 화면

1. 홈: 비회원 샘플 검색  
2. 로그인 후 대시보드  
3. 내 콘텐츠: 최근 순, 페이지당 4개  

## 6. 망가졌을 때

- 액세스 토큰 이상 → `401`, 세션 정리  
- 리프레시도 이상 → `POST /auth/refresh`가 `401`  
- OpenAI·Qdrant·DB 문제 → 콘텐츠가 `failed` 또는 API 에러  
- 터널·백엔드 꺼짐 → 프론트에서 연결 실패(502 등)  
