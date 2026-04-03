# 처음부터 끝까지 점검할 때 (로컬 기준)

Vercel에 올린 프론트를 쓸 때는 `NEXT_PUBLIC_API_BASE_URL`이 실제 API 주소(Tunnel 도메인 등)를 가리키는지 먼저 확인하세요.

## 1. 서비스 띄우기

1. Redis, Qdrant, PostgreSQL 실행
2. 백엔드: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Celery: `celery -A app.core.celery_app worker --loglevel=info`
   - Windows면 `--pool=solo --concurrency=1` 추가
4. 프론트: `cd frontend && npm run dev`

## 2. 로그인 흐름

1. `POST /auth/register` — 계정 만들기
2. `POST /auth/login` → access_token + refresh_token 확인
3. `GET /auth/me`
4. 대시보드를 오래 켜 두고 만료 2분 전에 `/auth/refresh`가 자동으로 도는지 확인

## 3. 콘텐츠

1. `POST /contents/` 또는 `POST /contents/upload` (URL, 메모, PDF)
2. DB·UI에서 pending → processing → completed (또는 failed) 흐름
3. 처리 완료 시 토스트 확인
4. 랜딩 페이지에서 프리뷰 카드 + AI 채팅도 동작하는지 확인

## 4. 검색·RAG

1. 「검색·AI」 탭에서 의미 검색 (`GET /search/semantic`)
2. 정확 / 균형 / 넓게 모드 전환
3. `POST /chat/ask` — 답변, 근거 snippet, confidence

## 5. 화면

1. 홈 랜딩: 프리뷰 카드 + AI 채팅, 비로그인 시 모달
2. 대시보드 「내 자료」 탭: 목록(페이지당 3개), 태그 필터
3. 대시보드 「검색·AI」 탭: 의미 검색 + AI 어시스턴트
4. 라이트 모드 전환 후 배지·칩·CTA 가시성

## 6. 문제 상황

- 액세스 토큰 문제 → 401, 세션 정리
- 리프레시도 실패 → `/auth/refresh`가 401
- OpenAI·Qdrant·DB 문제 → 콘텐츠가 failed 또는 API 에러
- 터널·백엔드 꺼짐 → 프론트에서 연결 실패 (502 등)
