import { Pill } from "./ui/pill";

export function HeroSection() {
  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/30 to-blue-900/20 p-8 shadow-2xl shadow-blue-900/30 sm:p-12">
      <div className="space-y-3">
        <Pill label="가입 없이 먼저 체험" variant="accent" />
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">SmartCurator</h1>
        <p className="max-w-2xl text-lg text-slate-300">
          흩어진 기사와 메모를 빠르게 모으고, 핵심만 다시 찾게 해주는 개인 지식 워크스페이스입니다.
          로그인 전에는 공개 콘텐츠 검색을 바로 체험하고, 로그인 후에는 내 자료 기반 요약·검색·AI 질의를 시작할 수 있어요.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Why", value: "정보는 늘어나는데, 다시 찾는 시간은 줄여야 하니까" },
          { label: "Try now", value: "회원가입 없이 공개 데이터 검색을 먼저 경험" },
          { label: "After login", value: "내 콘텐츠 추가 -> 의미 검색 -> 근거 기반 AI 답변" },
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
