# SmartCurator 점검 시나리오 (A to Z)

## 1. 서비스 기동

1. Redis/Qdrant/PostgreSQL 실행
2. 백엔드 실행 (`uvicorn app.main:app --reload`)
3. Celery 실행 (`celery -A app.core.celery_app worker ...`)
4. 프론트 실행 (`cd frontend && npm run dev`)

## 2. 인증 시나리오

1. `POST /auth/register`
2. `POST /auth/login` -> `access_token`, `refresh_token` 확인
3. `GET /auth/me` 정상 확인
4. 30분 경과 직전 자동 refresh 동작 확인

## 3. 콘텐츠 처리 시나리오

1. `POST /contents/` 또는 `/contents/upload`
2. 상태 전이 확인: `pending -> processing -> completed/failed`
3. 완료/실패 시 대시보드 우측 상단 토스트 확인

## 4. 검색/RAG 시나리오

1. 의미 검색 (`GET /search/semantic`)
2. 모드 전환(정확/균형/넓게)
3. AI 질문 (`POST /chat/ask`)
4. 답변 + 근거 출처 + 신뢰도 확인

## 5. UI 시나리오

1. 홈 비회원 체험(샘플 검색)
2. 로그인 후 빠른 사용 가이드
3. 대시보드 목록 최근순 페이지네이션(4개)

## 6. 실패 시나리오

- 잘못된 토큰: 401
- 잘못된 refresh token: `/auth/refresh` 401
- OpenAI 또는 벡터DB 장애: 명확한 실패 상태/메시지 확인
