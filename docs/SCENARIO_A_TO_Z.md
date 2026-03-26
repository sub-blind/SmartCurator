# SmartCurator 점검 시나리오 (A to Z)

로컬 개발 기준입니다. Vercel 배포본을 검증할 때는 `NEXT_PUBLIC_API_BASE_URL`이 프로덕션 API(Cloudflare Tunnel 도메인 등)를 가리키는지 확인합니다.

## 1. 서비스 기동

1. Redis, Qdrant, PostgreSQL 실행
2. 백엔드: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Celery: `celery -A app.core.celery_app worker --loglevel=info` (Windows는 `--pool=solo --concurrency=1` 등)
4. 프론트: `cd frontend && npm run dev`

## 2. 인증

1. `POST /auth/register`로 계정 생성
2. `POST /auth/login` → 응답에 `access_token`, `refresh_token` 포함 확인
3. `GET /auth/me`로 사용자 정보 확인
4. 브라우저에서 액세스 만료 직전(설정상 약 2분 전) 자동 `/auth/refresh` 동작 확인

## 3. 콘텐츠 처리

1. `POST /contents/` 또는 `POST /contents/upload`
2. DB·UI에서 상태 전이: `pending` → `processing` → `completed` 또는 `failed`
3. 대시보드 우측 상단 토스트로 완료/실패 알림 확인

## 4. 검색·RAG

1. `GET /search/semantic` (대시보드에서 의미 검색)
2. 검색 모드: 정확 / 균형 / 넓게
3. `POST /chat/ask` — 답변, 근거 출처, 신뢰도(confidence) 확인

## 5. UI

1. 홈: 비회원 샘플 검색 등
2. 로그인 후 대시보드 사용
3. 내 콘텐츠: 최근순, 페이지당 4개 페이지네이션

## 6. 실패·에러

- 잘못된 액세스 토큰: `401`, 세션 정리
- 잘못된 refresh 토큰: `POST /auth/refresh` `401`
- OpenAI·Qdrant·DB 오류: 콘텐츠 `failed` 또는 API 에러 메시지 확인
- 터널·백엔드 다운: 프론트에서 연결 실패 메시지(502 등) 확인
