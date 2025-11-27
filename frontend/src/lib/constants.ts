export const architectureMap = [
  {
    title: "인증 · 사용자",
    backend: ["app/api/v1/auth.py", "app/services/auth_service.py"],
    frontend: ["LoginCard (JWT)", "보관 예정: 사용자 대시보드"],
    note: "JWT 기반 로그인 후 use client 컴포넌트에서 토큰 보관"
  },
  {
    title: "컨텐츠 파이프라인",
    backend: ["app/api/v1/content.py", "app/services/content_service.py", "app/tasks/content_tasks.py"],
    frontend: ["QuickAddForm", "향후: 컨텐츠 리스트 View"],
    note: "등록 즉시 Celery 작업에 위임, 상태는 /contents/my로 조회"
  },
  {
    title: "검색 & RAG",
    backend: ["app/api/v1/search.py", "app/services/rag_service.py"],
    frontend: ["TopNav > Search CTA", "향후: semantic search form"],
    note: "Qdrant + OpenAI 파이프라인을 호출하는 검색 UI 예정"
  },
  {
    title: "챗봇",
    backend: ["app/api/v1/chat.py", "app/services/ai_service.py"],
    frontend: ["대화형 Chat 컴포넌트 (To-do)"],
    note: "RAG 답변과 사용자 히스토리를 같이 노출"
  }
];

export const buildSteps = [
  {
    title: "Auth & 사용자 온보딩",
    detail: "로그인/회원가입 컴포넌트 + 토큰 보관 방식 정립",
    status: "진행 중"
  },
  {
    title: "컨텐츠 CRUD 화면",
    detail: "목록/필터/요약 태그 UI 구성, 실시간 상태 갱신",
    status: "다음"
  },
  {
    title: "Semantic Search · Chat",
    detail: "RAG API 대화형 UI, 스트리밍 응답 연결",
    status: "예정"
  },
  {
    title: "배포 & 모니터링",
    detail: "Vercel 빌드 파이프라인, Sentry/LogRocket 연동",
    status: "예정"
  }
];




