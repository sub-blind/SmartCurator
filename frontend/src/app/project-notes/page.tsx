import Link from "next/link";

import { IntegrationMap } from "@/components/integration-map";
import { RoadmapSection } from "@/components/roadmap-section";

export default function ProjectNotesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Project Notes</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">구현 결정 기록 / 핵심 정리</h1>
        <p className="mt-2 text-sm text-slate-300">
          홈 화면에서는 기능 중심 소개에 집중하고, 상세한 구현 맥락은 이 페이지로 분리했습니다.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-sm text-slate-100 hover:border-brand"
        >
          홈으로 돌아가기
        </Link>
      </section>

      <IntegrationMap />
      <RoadmapSection />
    </div>
  );
}
