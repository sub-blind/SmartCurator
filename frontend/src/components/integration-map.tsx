import { Section } from "./ui/section";
import { architectureMap } from "@/lib/constants";

export function IntegrationMap() {
  return (
    <Section
      id="architecture"
      title="백엔드 모듈 ↔ 프론트 컴포넌트 맵"
      description="기존 FastAPI 서비스 구조를 그대로 활용하면서 React 컴포넌트를 어디에 매핑할지 시각화했습니다."
      className="glass-card"
    >
      <div className="space-y-4">
        {architectureMap.map((block) => (
          <div key={block.title} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">{block.title}</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-blue-200">sync plan</span>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase text-slate-400">Backend</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-200">
                  {block.backend.map((file) => (
                    <li key={file} className="font-mono text-[11px] text-slate-300">
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-400">Frontend</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-200">
                  {block.frontend.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-slate-400 sm:text-right">{block.note}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}




