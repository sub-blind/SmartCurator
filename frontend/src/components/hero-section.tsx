import { Pill } from "./ui/pill";

export function HeroSection() {
  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/30 to-blue-900/20 p-8 shadow-2xl shadow-blue-900/30 sm:p-12">
      <div className="space-y-3">
        <Pill label="백엔드 완성 · 프론트 착수" variant="accent" />
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          SmartCurator 프론트엔드 킥오프
        </h1>
        <p className="max-w-2xl text-lg text-slate-300">
          FastAPI + RAG 백엔드 위에 Next.js/Tailwind 프론트 계층을 얹어 “링크 수집 → AI 요약 →
          의미 검색 → 챗봇” 흐름을 한 화면에서 체험할 수 있게 만듭니다.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Backend", value: "FastAPI · Celery · Qdrant" },
          { label: "Frontend", value: "Next.js 14 · Tailwind · React Server" },
          { label: "Deploy", value: "Vercel + Railway (예시)" }
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20"
          >
            <dt className="text-xs uppercase tracking-wide text-slate-400">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}




