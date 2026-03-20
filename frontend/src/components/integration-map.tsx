import { Section } from "./ui/section";
import { architectureMap } from "@/lib/constants";

export function IntegrationMap() {
  return (
    <Section
      id="architecture"
      title="구현 결정 기록"
      description="구현 과정에서의 핵심 선택과 트레이드오프를 한 화면에 정리했습니다."
      className="glass-card"
    >
      <div className="space-y-4">
        {architectureMap.map((block) => (
          <div key={block.title} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">{block.title}</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-blue-200">decision</span>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase text-slate-400">선택</p>
                <p className="mt-1 text-sm text-slate-200">{block.decision}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400">이유</p>
                <p className="mt-1 text-sm text-slate-200">{block.reason}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400">트레이드오프</p>
                <p className="mt-1 text-sm text-slate-300">{block.tradeoff}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400">대응</p>
                <p className="mt-1 text-sm text-slate-300">{block.mitigation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}




