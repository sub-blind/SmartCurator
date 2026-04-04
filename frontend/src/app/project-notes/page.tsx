import Link from "next/link";

import { IntegrationMap } from "@/components/integration-map";
import { RoadmapSection } from "@/components/roadmap-section";

export default function ProjectNotesPage() {
  return (
    <div className="space-y-8">
      <section className="surface-card rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Project Notes</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">구현 결정 기록 / 핵심 정리</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          홈 화면에서는 기능 중심 소개에 집중하고, 상세한 구현 맥락은 이 페이지로 분리했습니다.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--accent)]"
        >
          홈으로 돌아가기
        </Link>
      </section>

      <section className="surface-card rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">전체 구조 (2026-04 기준)</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
          SmartCurator는 링크·메모·PDF를 저장하고, 백그라운드에서 요약·태깅·벡터 인덱싱한 뒤 의미 검색과 RAG 질의를
          제공하는 풀스택 앱입니다. 프론트는 Next.js 14(App Router), 백엔드는 FastAPI, 비동기 작업은 Celery+Redis,
          메타·본문은 PostgreSQL, 임베딩 검색은 Qdrant, 요약·태그·답변은 OpenAI API를 사용합니다. 한국어 임베딩은{" "}
          <span className="whitespace-nowrap">ko-sRoBERTa</span> 계열 모델 기반입니다.
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-[var(--text-secondary)]">
          <li>
            <strong className="font-medium text-[var(--text-primary)]">frontend/</strong> — 홈(히어로·랜딩 인테이크·체험
            블록), <span className="whitespace-nowrap">/dashboard</span>(내 콘텐츠·검색·RAG), 인증 페이지,{" "}
            <span className="whitespace-nowrap">/project-notes</span>(본 문서)
          </li>
          <li>
            <strong className="font-medium text-[var(--text-primary)]">백엔드 API</strong> —{" "}
            <span className="whitespace-nowrap">/auth/*</span>, <span className="whitespace-nowrap">/contents/*</span>,{" "}
            <span className="whitespace-nowrap">/search/*</span>, <span className="whitespace-nowrap">/chat/ask</span> 등
          </li>
          <li>
            <strong className="font-medium text-[var(--text-primary)]">배포</strong> — UI는 Vercel, API는 로컬+Cloudflare
            Tunnel로 붙이는 구성(비용·품질 트레이드오프). 상세는 README·
            <code className="rounded bg-[var(--surface-muted)] px-1 text-[13px] text-[var(--text-primary)]">
              docs/DEPLOYMENT_DECISION.md
            </code>
            , 시퀀스/아키텍처 다이어그램은 <code className="rounded bg-[var(--surface-muted)] px-1 text-[13px]">docs/diagrams.md</code>
          </li>
        </ul>

        <h3 className="mt-6 text-base font-semibold text-[var(--text-primary)]">랜딩 페이지 UX</h3>
        <ul className="mt-2 list-inside list-disc space-y-2 text-sm text-[var(--text-secondary)]">
          <li>비로그인 가져오기 시 하단 토스트 대신 중앙 모달(회원가입·로그인·닫기 X)</li>
          <li>프리뷰 카드 안에 AI 채팅: 고정 높이·내부 스크롤, 새 자료 가져오면 대화 초기화</li>
          <li>그리드는 <span className="whitespace-nowrap">lg:items-start</span> + 오른쪽 열{" "}
            <span className="whitespace-nowrap">max-height</span>로 좌우 열 독립 분리</li>
          <li>라이트 모드 CTA·탭은 액센트+흰 글자로 대비 고정</li>
          <li>히어로·랜딩 제목: <span className="whitespace-nowrap">break-keep</span> + <span className="whitespace-nowrap">nowrap</span>으로 한글 줄바꿈 깨짐 방지</li>
        </ul>

        <h3 className="mt-6 text-base font-semibold text-[var(--text-primary)]">내 자료 화면 UX</h3>
        <ul className="mt-2 list-inside list-disc space-y-2 text-sm text-[var(--text-secondary)]">
          <li>「내 자료」/「검색·AI」 탭으로 역할 분리, URL 쿼리 <code className="rounded bg-[var(--surface-muted)] px-1 text-[13px]">?view=explore</code> 딥링크</li>
          <li>콘텐츠 목록: 페이지당 3개, 태그 클릭 필터</li>
          <li>검색 스니펫 잡문구·URL 자동 제거, 잡음 심하면 요약으로 대체</li>
          <li>상태 배지·칩·CTA에 테마별 CSS 변수 — 라이트/다크 모두 대비 보장</li>
          <li>검색·AI 섹션 독립 스크롤 + 배지 색상으로 시각 구분</li>
        </ul>
      </section>

      <IntegrationMap />
      <RoadmapSection />
    </div>
  );
}
