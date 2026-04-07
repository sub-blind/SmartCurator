import { LandingIntakeSection } from "@/components/landing-intake-section";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <LandingIntakeSection />

      <section className="surface-card rounded-3xl p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-5">
            <h2 className="text-xl font-semibold leading-snug text-[var(--text-primary)]">
              북마크만 쌓이고 나중에 다시 안 보게 되는 경험, 있으신가요?
            </h2>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              링크를 넣는 순간 요약과 태그가 자동으로 만들어지고, 나중에 제목이 기억 안 나도{" "}
              <span className="font-medium text-[var(--text-primary)]">비슷한 뜻으로</span> 다시 찾을 수 있어요.
              저장해 둔 자료에 바로 질문도 됩니다.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 rounded-2xl bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">넣으면 바로 정리</p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">
                  기사, 유튜브, PDF, 메모 — 뭘 넣어도 요약·태그가 생기고 카드로 남습니다.
                </p>
              </div>
              <div className="flex-1 rounded-2xl bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">뜻으로 검색</p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">
                  정확한 키워드가 기억 안 나도 의미가 비슷하면 찾아줘요.
                </p>
              </div>
            </div>
          </div>
          <aside className="rounded-2xl border border-[var(--border)] p-5">
            <p className="text-sm font-semibold text-[var(--text-primary)]">이런 분께 맞아요</p>
            <ul className="mt-3 space-y-2.5">
              {[
                "읽고 싶은 글이 쌓이는데 나중에 못 찾을 때",
                "유튜브 영상 내용을 텍스트로 정리하고 싶을 때",
                "저장한 자료에 바로 질문하고 싶을 때",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
