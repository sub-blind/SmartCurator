import { Section } from "./ui/section";
import { buildSteps } from "@/lib/constants";

export function RoadmapSection() {
  return (
    <Section
      id="interview-summary"
      title="면접관용 프로젝트 요약"
      description="기술 선택보다 '왜 만들었고, 어떻게 검증했고, 어디까지 운영 가능한지'를 중심으로 핵심 포인트를 정리했습니다."
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




