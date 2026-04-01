import { LandingIntakeSection } from "@/components/landing-intake-section";
import { Section } from "@/components/ui/section";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <LandingIntakeSection />

      <Section
        id="why-now"
        title="왜 이렇게 시작하나요?"
        description="긴 설명부터 읽게 하기보다, 사람들이 가져오고 싶은 자료를 먼저 선택하게 만들고 싶었습니다."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "가져오자마자 정리",
              detail: "기사 링크나 유튜브, PDF를 넣으면 요약과 태그를 만들고 나중에 다시 찾기 쉬운 카드로 남깁니다.",
            },
            {
              title: "찾을 때는 의미로",
              detail: "제목을 정확히 기억하지 못해도 비슷한 뜻과 주제로 저장한 자료를 다시 꺼내볼 수 있습니다.",
            },
            {
              title: "질문하면 근거까지",
              detail: "저장해둔 자료를 바탕으로 답을 만들고, 어떤 문장을 근거로 삼았는지 함께 보여줍니다.",
            },
          ].map((item) => (
            <article key={item.title} className="surface-muted rounded-2xl p-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.detail}</p>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
