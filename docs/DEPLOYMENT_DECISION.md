# 배포 구조 결정 (현재)

## 요약

현재 운영은 **Local Backend + Cloudflare Tunnel + Vercel Frontend**입니다.
한국어 임베딩 품질과 비용 균형을 위해 백엔드/워커/벡터DB를 로컬에서 운영하고,
Vercel은 UI 배포에만 사용합니다.

## 컴포넌트 배치

| Component | Where |
|-----------|-------|
| Frontend | Vercel |
| Backend API | Local (`uvicorn`) |
| Celery Worker | Local |
| PostgreSQL | Local Docker |
| Redis | Local Docker |
| Qdrant | Local Docker or Qdrant Cloud |
| Public Access | Cloudflare Tunnel |

## 운영 기준

- 장점: 비용 최소, 품질 유지, 빠른 실험
- 한계: 로컬 장비 가용성 의존, 터널 URL 변경 가능
- 보완:
  - Named Tunnel/고정 도메인 도입
  - 장기적으로 API/Worker/DB 클라우드 이전

## 2026-03 기준 반영 사항

- Access/Refresh 토큰 구조 도입
- `/auth/refresh` 추가 및 자동 토큰 갱신
- 대시보드 처리 상태 토스트(완료/실패)
- 내 콘텐츠 최근순 페이지네이션(4개)

## 배포 절차 (요약)

1. 로컬 백엔드 + Celery + Docker 서비스 기동
2. `cloudflared tunnel --url http://localhost:8000`
3. Vercel `NEXT_PUBLIC_API_BASE_URL`에 터널 URL 반영
4. 백엔드 `ALLOWED_ORIGINS`에 Vercel 도메인 반영
5. 기능 점검(로그인/콘텐츠 처리/검색/RAG/자동 refresh)
