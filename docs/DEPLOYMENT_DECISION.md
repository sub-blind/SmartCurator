# 배포는 왜 이렇게 했는지

## 한 줄 요약

로컬에서 API·워커·DB·검색을 다 돌리고, 화면만 Vercel에 올렸습니다.
밖에서 API를 부를 때는 **Cloudflare Tunnel**로 `localhost:8000`에 붙게 했어요.

## 왜 로컬에 두었나

- 한국어 임베딩(ko-sRoBERTa)·Qdrant 검색 환경을 **그대로 유지**하고 싶었고
- 월 클라우드 비용을 **거의 안 쓰고** 싶었습니다.

## 각각 어디 있나

| 것 | 위치 |
|----|------|
| 프론트 (Next.js) | Vercel |
| FastAPI | 로컬 (`uvicorn`, `0.0.0.0:8000`) |
| Celery Worker | 로컬 |
| PostgreSQL / Redis / Qdrant | 로컬 (Docker) |
| 외부에서 보이는 API 주소 | Cloudflare Tunnel → 위 FastAPI |

## Tunnel 방식

| 방식 | 언제 쓰나 | 특징 |
|------|-----------|------|
| **Quick Tunnel** | 잠깐 테스트 | `cloudflared tunnel --url http://localhost:8000` — 세션마다 URL이 바뀔 수 있음 |
| **Named Tunnel** | 꾸준히 쓸 때 | Zero Trust에서 만들고, `api.도메인` 고정. 서비스로 올려 두면 전원만 켜면 됨 |

상시 데모면 Named Tunnel이 덜 번거롭습니다.

## 솔직한 단점

- PC를 끄거나 네트워크가 불안하면 API가 같이 끊깁니다.
- Quick Tunnel만 쓰면 주소가 바뀔 수 있어서, 프론트 환경 변수를 같이 고쳐야 할 때가 있어요.

반대로 **장점**은 비용·실험·디버깅이 편하다는 점, 그리고 지금 쓰는 임베딩·검색 스택을 나중에 클라우드로 옮길 때 코드 변경이 적다는 점입니다.

## 2026-04 기준 맞춰 둔 것

- Access / Refresh JWT, 프론트에서 만료 임박 시 자동 갱신
- 대시보드 「내 자료」 / 「검색·AI」 탭 분리, URL 딥링크 지원
- 랜딩 페이지에서 프리뷰 + AI 채팅, 비로그인 시 모달 안내
- 라이트/다크 테마 CTA·배지 대비 보장
- 콘텐츠 목록 최근순, 페이지당 3개
- 검색 스니펫 잡문구 자동 정리

## 올릴 때 순서

1. 로컬에서 DB·Redis·Qdrant·백엔드·Celery 띄우기
2. Cloudflare에서 Tunnel 만들고, 로컬 API에 연결
3. Vercel에 `NEXT_PUBLIC_API_BASE_URL`을 공개 API 주소로 설정
4. 백엔드 `ALLOWED_ORIGINS`에 Vercel 도메인 넣기
5. 로그인 → 콘텐츠 → 검색 → RAG → 토큰 갱신까지 한 번씩 확인

상세 시나리오는 [SCENARIO_A_TO_Z.md](./SCENARIO_A_TO_Z.md)를 참고하세요.
