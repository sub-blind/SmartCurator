import { HeroSection } from "@/components/hero-section";
import { HomeExperienceSection } from "@/components/home-experience-section";
import { Section } from "@/components/ui/section";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <HeroSection />

      <Section
        id="why-now"
        title="왜 이 사이트가 필요한가"
        description="정보를 많이 모으는 것보다, 필요할 때 정확히 꺼내 쓰는 경험에 집중했습니다."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "수집 피로 감소",
              detail: "링크, 메모, 파일을 한곳에 모으고 자동으로 정리해 중복 탐색 시간을 줄입니다.",
            },
            {
              title: "맥락 기반 탐색",
              detail: "정확한 키워드를 몰라도 의미가 비슷한 내용을 찾아줍니다.",
            },
            {
              title: "실행 가능한 답변",
              detail: "AI 답변과 근거를 같이 확인해 바로 다음 액션으로 이어집니다.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
            </article>
          ))}
        </div>
      </Section>

      <HomeExperienceSection />
    </div>
  );
}
