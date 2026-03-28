# 배포는 왜 이렇게 했는지

## 한 줄 요약

지금은 **로컬에서 API·워커·DB·검색을 다 돌리고**, 화면만 Vercel에 올렸습니다. 밖에서 API를 부를 때는 **Cloudflare Tunnel**로 집 PC의 `localhost:8000`에 붙게 했어요.

## 왜 로컬에 두었나

- 한국어 임베딩·Qdrant까지 **그대로 두고** 싶었고
- 월별 클라우드 컴퓨트 비용을 **거의 안 쓰고** 싶었습니다.

그래서 “API를 AWS에 올린다”보다 Tunnel로 노출하는 쪽을 택한 겁니다.

## 각각 어디 있나

| 것 | 위치 |
|----|------|
| 프론트(Next.js) | Vercel |
| FastAPI | 로컬 (`uvicorn`, 보통 `0.0.0.0:8000`) |
| Celery | 로컬 |
| PostgreSQL / Redis / Qdrant | 로컬(보통 Docker) |
| 인터넷에서 보이는 API 주소 | Tunnel → 위 FastAPI |

## Tunnel 두 가지

| 방식 | 언제 쓰나 | 특징 |
|------|-----------|------|
| **Quick Tunnel** | 잠깐 테스트 | `cloudflared tunnel --url http://localhost:8000` — 세션마다 URL이 바뀔 수 있음 |
| **Named Tunnel** | 꾸준히 쓸 때 | Zero Trust에서 터널 만들고, `api.도메인` → `http://localhost:8000` 고정. PC에 `cloudflared` 서비스로 올려 두면 전원만 켜지면 됨 |

상시 데모라면 Named Tunnel 쪽이 덜 번거롭습니다.

## 솔직한 단점

- PC를 끄거나 인터넷이 불안하면 API가 같이 갑니다.
- Quick Tunnel만 쓰면 주소가 바뀔 수 있어서, 프론트 환경 변수도 같이 갱신해야 할 때가 있습니다.

반대로 **장점**은 비용·실험·디버깅이 편하다는 것, 그리고 지금 쓰는 임베딩·검색 스택을 클라우드로 옮겨 다시 맞출 부담이 적다는 쪽이에요. 나중에 필요하면 API·워커·DB만 단계적으로 클라우드로 빼도 됩니다.

## 2026-03에 맞춰 둔 것

- Access / Refresh JWT, `POST /auth/refresh`, 프론트에서 만료 임박 시 갱신
- 처리 끝나면/망가지면 대시보드에서 토스트
- 내 콘텐츠 최근순 + 페이지당 4개

## 올릴 때 순서 (대략)

1. 로컬에서 DB·Redis·Qdrant·백엔드·Celery 띄우기  
2. Cloudflare에서 Tunnel 만들고, 공개 호스트를 로컬 API에 연결  
3. Vercel에 `NEXT_PUBLIC_API_BASE_URL`을 그 공개 API 베이스 URL로 설정  
4. 백엔드 `ALLOWED_ORIGINS`에 Vercel 도메인 넣기  
5. 로그인 → 콘텐츠 → 검색 → RAG → 토큰 갱신까지 한번씩 눌러 보기  

더 세부 시나리오는 [SCENARIO_A_TO_Z.md](./SCENARIO_A_TO_Z.md)를 보면 됩니다.
