import { Section } from "./ui/section";
import { buildSteps } from "@/lib/constants";

export function RoadmapSection() {
  return (
    <Section
      id="project-summary"
      title="프로젝트 핵심 정리"
      description="문제 정의, 구현 범위, 운영 기준, 확장 계획을 간단히 정리했습니다."
    >
      <ol className="space-y-4">
        {buildSteps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
              {index + 1}
            </div>
            <div>
              <p className="text-base font-medium text-white">{step.title}</p>
              <p className="mt-1 text-sm text-slate-300">{step.detail}</p>
              <p className="mt-2 text-xs text-blue-200">근거: {step.evidence}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}




