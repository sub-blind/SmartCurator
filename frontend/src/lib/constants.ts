export const architectureMap = [
  {
    title: "비용 최소화 배포 구조",
    decision: "로컬 백엔드 + Cloudflare Tunnel + Vercel 프론트",
    reason: "한국어 임베딩/검색 품질을 유지하면서도 클라우드 서버 비용을 0에 가깝게 운영",
    tradeoff: "노트북 전원/네트워크 상태에 가용성이 의존함",
    mitigation: "절전 해제, 터널 헬스체크, 필요 시 Named Tunnel/클라우드 전환 경로 확보"
  },
  {
    title: "비동기 처리 안정성",
    decision: "FastAPI(요청) + Celery(요약/벡터화) 분리",
    reason: "사용자 요청 응답속도와 긴 문서 처리 시간을 분리해 UX 저하를 방지",
    tradeoff: "큐/워커 상태 관리가 추가로 필요함",
    mitigation: "/health + 상태 배지 + 재처리 버튼으로 운영 가시성 확보"
  },
  {
    title: "검색 정확도 우선",
    decision: "Qdrant chunk 검색 + RAG 출처 기반 답변 + 정확도 모드(정확/균형/넓게)",
    reason: "의미 검색 결과의 잡음을 줄이고, 질문 의도에 맞는 근거를 우선 노출할 수 있음",
    tradeoff: "필터를 높이면 일부 경계 사례가 누락될 수 있음",
    mitigation: "기본 임계치 + 상위 결과 대비 상대 필터 + 검색 모드 전환으로 균형 조정"
  }
];

export const buildSteps = [
  {
    title: "핵심 기능",
    detail: "링크/노트가 흩어져 복습이 어렵다는 문제를 수집-요약-검색-질의 흐름으로 통합",
    evidence: "URL, 텍스트, 파일(PDF/TXT) 입력을 하나의 파이프라인으로 처리"
  },
  {
    title: "설계 포인트",
    detail: "비동기 요약 파이프라인, 의미론 검색 정확도 모드, RAG 기반 Q&A, 재처리/삭제 운영 기능 구현",
    evidence: "내 자료 화면에서 상태 변화(pending->processing->completed), 검색 모드, 출처 기반 답변을 즉시 확인 가능"
  },
  {
    title: "운영 기준",
    detail: "내 자료 화면 탭 분리(내 자료/검색·AI), 페이지당 3개, 태그 필터, 스니펫 잡문구 자동 정리, 라이트/다크 대비 보장",
    evidence: "비로그인 모달, 프리뷰 RAG 채팅·독립 스크롤, CTA 액센트 고정, break-keep 한글 줄바꿈, 터널·CORS 검증"
  },
  {
    title: "확장 계획",
    detail: "고정 도메인 Named Tunnel, 클라우드 이전(Render/AWS), 모니터링 도구 연동",
    evidence: "현재 구조를 유지한 채 단계적 전환 가능한 아키텍처 문서화 완료"
  }
];




