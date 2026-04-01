import { Section } from "./ui/section";
import { buildSteps } from "@/lib/constants";

export function RoadmapSection() {
  return (
    <Section
      id="project-summary"
      title="프로젝트 요약"
      description="문제 정의, 구현 범위, 운영 기준, 확장 계획을 간단하게 정리했습니다."
    >
      <ol className="space-y-4">
        {buildSteps.map((step, index) => (
          <li key={step.title} className="surface-muted flex items-start gap-4 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-semibold text-[var(--accent-strong)]">
              {index + 1}
            </div>
            <div>
              <p className="text-base font-medium text-[var(--text-primary)]">{step.title}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{step.detail}</p>
              <p className="mt-2 text-xs text-[var(--accent-strong)]">근거: {step.evidence}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
