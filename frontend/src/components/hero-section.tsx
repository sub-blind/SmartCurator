import { Pill } from "./ui/pill";

export function HeroSection() {
  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/30 to-blue-900/20 p-8 shadow-2xl shadow-blue-900/30 sm:p-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <Pill label="가입 없이 먼저 체험" variant="accent" />
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">SmartCurator</h1>
          <p className="max-w-2xl break-keep text-lg leading-9 text-slate-200">
            흩어진 기사와 메모를 빠르게 모으고, 핵심만 다시 찾게 해주는 개인 지식 워크스페이스입니다.
            로그인 전에는 공개 콘텐츠 검색을 바로 체험하고, 로그인 후에는 내 자료 기반 요약·검색·AI 질의를 시작할 수 있어요.
          </p>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-slate-900/55 p-5">
          <h2 className="text-base font-semibold text-white">지금 바로 가능한 것</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
            <li>회원가입 없이 샘플 의미 검색</li>
            <li>로그인 후 콘텐츠 추가와 자동 요약</li>
            <li>근거 포함 AI 질의응답</li>
          </ul>
        </aside>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "왜 필요한가", value: "흩어진 정보를 실행 가능한 지식으로" },
          { label: "비회원 체험", value: "공개 샘플 검색으로 핵심 경험 확인" },
          { label: "로그인 이후", value: "내 콘텐츠 요약·검색·AI 질의" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20"
          >
            <dt className="text-xs tracking-wide text-slate-400">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium leading-6 text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
