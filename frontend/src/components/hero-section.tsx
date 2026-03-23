import { Pill } from "./ui/pill";

export function HeroSection() {
  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/30 to-blue-900/20 p-8 shadow-2xl shadow-blue-900/30 sm:p-12">
      <div className="space-y-3">
        <Pill label="End-to-End 동작 검증 완료" variant="accent" />
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          SmartCurator
        </h1>
        <p className="max-w-2xl text-lg text-slate-300">
          개인이 수집한 링크/노트/파일(PDF)을 AI가 구조화해, 요약/검색/RAG 질의까지 연결하는
          개인 지식 큐레이션 서비스입니다.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Core Stack", value: "FastAPI · Celery · Qdrant · Next.js" },
          { label: "User Flow", value: "수집 → 요약 → 의미검색 → AI 질의" },
          { label: "Deployment", value: "로컬 API · Cloudflare Tunnel · Vercel" }
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




