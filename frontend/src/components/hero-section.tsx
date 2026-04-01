import { Pill } from "./ui/pill";

export function HeroSection() {
  return (
    <div className="surface-card space-y-6 rounded-3xl p-8 sm:p-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <Pill label="가입 없이 먼저 써보기" variant="accent" />
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            SmartCurator
          </h1>
          <p className="max-w-2xl break-keep text-lg leading-9 text-[var(--text-secondary)]">
            읽다가 북마크만 해두고 잊어버리는 일, 줄이고 싶어서 만든 서비스예요. 링크, 메모,
            파일을 한곳에 두고 나중에 단어가 정확히 기억 안 나도 비슷한 뜻으로 찾을 수 있어요.
            로그인 전에는 공개 샘플만 검색해 보고, 로그인하면 내 자료 요약과 질문까지 이어집니다.
          </p>
        </div>

        <aside className="surface-muted rounded-2xl p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">여기서 할 수 있는 것</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
            <li>가입 없이 샘플 검색 한 번</li>
            <li>내 링크, 메모, PDF 넣고 요약 받기</li>
            <li>질문하면 답과 짧은 근거 같이 보기</li>
          </ul>
        </aside>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "이럴 때", value: "답만 읽어두고 다시 안 보는 링크가 많을 때" },
          { label: "로그인 전", value: "공개 샘플로 검색만 해봄" },
          { label: "로그인 후", value: "내 자료 요약·검색·질문" },
        ].map((item) => (
          <div key={item.label} className="surface-muted rounded-2xl p-4">
            <dt className="text-xs tracking-wide text-[var(--text-muted)]">{item.label}</dt>
            <dd className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
