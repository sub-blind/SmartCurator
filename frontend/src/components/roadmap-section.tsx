import { Section } from "./ui/section";
import { buildSteps } from "@/lib/constants";

export function RoadmapSection() {
  return (
    <Section
      id="roadmap"
      title="다음 단계 로드맵"
      description="컴포넌트 단위 작업 순서와 완료 조건을 명확히 해두면 주말 프로젝트 페이스로도 꾸준히 전진할 수 있습니다."
    >
      <ol className="space-y-4">
        {buildSteps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4 rounded-2xl border border-white/5 bg-slate-900/40 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
              {index + 1}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <p className="text-base font-medium text-white">{step.title}</p>
                <span className="text-xs uppercase tracking-widest text-slate-400">{step.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}




