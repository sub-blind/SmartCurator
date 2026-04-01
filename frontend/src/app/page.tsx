import { HeroSection } from "@/components/hero-section";
import { HomeExperienceSection } from "@/components/home-experience-section";
import { Section } from "@/components/ui/section";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <HeroSection />

      <Section
        id="why-now"
        title="뭘 도와주나요?"
        description="많이 쌓는 것보다, 나중에 꺼내 쓰는 쪽을 먼저 생각했어요."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "한곳에만 모아두기",
              detail: "링크, 메모, 파일을 여기저기 두지 말고 한 저장고에 넣고 요약과 태그를 자동으로 붙입니다.",
            },
            {
              title: "표현이 달라도 찾기",
              detail: "검색할 때 딱 맞는 단어가 안 떠올라도, 비슷한 뜻으로 연결된 결과를 찾습니다.",
            },
            {
              title: "답만 보지 않기",
              detail: "AI가 말한 근거 문장을 같이 보여줘서 어디 기준인지 확인하기 쉽게 했어요.",
            },
          ].map((item) => (
            <article key={item.title} className="surface-muted rounded-2xl p-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.detail}</p>
            </article>
          ))}
        </div>
      </Section>

      <HomeExperienceSection />
    </div>
  );
}
