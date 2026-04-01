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

      <IntegrationMap />
      <RoadmapSection />
    </div>
  );
}
