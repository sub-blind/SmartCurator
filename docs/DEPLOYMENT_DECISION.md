# 배포 구조 결정 (현재)

## 요약

운영은 **로컬 백엔드 + Cloudflare Tunnel + Vercel 프론트**입니다.

- 한국어 임베딩·비용 균형을 위해 API·Celery·PostgreSQL·Redis·Qdrant는 로컬(또는 로컬 Docker)에서 실행합니다.
- Vercel은 Next.js UI만 배포합니다.
- 외부에서 API에 접근하려면 **Cloudflare Tunnel**로 `localhost:8000`을 공개 도메인에 연결합니다.

## 컴포넌트 배치

| 구성 요소 | 위치 |
|-----------|------|
| Frontend | Vercel |
| Backend API | 로컬 (`uvicorn`, 예: `0.0.0.0:8000`) |
| Celery Worker | 로컬 |
| PostgreSQL | 로컬 Docker 등 |
| Redis | 로컬 Docker 등 |
| Qdrant | 로컬 Docker 등 |
| 공개 API URL | Cloudflare Tunnel → 로컬 API |

## Cloudflare Tunnel 두 가지 방식

| 방식 | 용도 | 특징 |
|------|------|------|
| **Quick Tunnel** | 임시 테스트 | `cloudflared tunnel --url http://localhost:8000` — 세션마다 URL이 바뀔 수 있음 |
| **Named Tunnel (권장)** | 상시 운영 | Zero Trust → Tunnels → **Published application routes**로 `api.example.com` → `http://localhost:8000` 매핑 후, PC에서 `cloudflared service install <token>`(Windows 서비스)로 상시 연결 |

프로덕션·고정 도메인은 **Named Tunnel + 서비스 설치**를 사용하는 것이 맞습니다.

## 트레이드오프

- **장점:** 클라우드 컴퓨트 비용 절감, 로컬에서 실험·디버깅 용이, 임베딩 품질 유지.
- **한계:** PC·네트워크·터널이 꺼지면 API가 끊김. Quick Tunnel은 URL이 바뀔 수 있음.
- **보완:** Named Tunnel·고정 도메인·절전 해제; 필요 시 API/Worker/DB를 클라우드로 이전.

## 2026-03 기준 반영 사항

- Access / Refresh JWT, `POST /auth/refresh`, 프론트 만료 임박 자동 갱신
- 대시보드 처리 완료·실패 토스트, 내 콘텐츠 최근순 페이지네이션(페이지당 4개)

## 배포 절차 (요약)

1. 로컬에서 PostgreSQL·Redis·Qdrant·백엔드·Celery 기동
2. Cloudflare에서 Named Tunnel 생성 → **Published application routes**에 API 호스트네임·`http://localhost:8000` 등록 → PC에 `cloudflared` 설치 후 토큰으로 서비스 등록(또는 Quick Tunnel로만 테스트)
3. Vercel 환경 변수 `NEXT_PUBLIC_API_BASE_URL`에 공개 API 베이스 URL(예: `https://api.example.com`) 설정
4. 백엔드 `ALLOWED_ORIGINS`에 Vercel·프로덕션 도메인 포함(JSON 배열 형식 권장)
5. 점검: 로그인·콘텐츠 처리·검색·RAG·토큰 자동 갱신

자세한 시나리오는 [SCENARIO_A_TO_Z.md](./SCENARIO_A_TO_Z.md)를 참고하세요.
