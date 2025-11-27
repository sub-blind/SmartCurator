import { HeroSection } from "@/components/hero-section";
import { QuickActionsSection } from "@/components/quick-actions-section";
import { IntegrationMap } from "@/components/integration-map";
import { RoadmapSection } from "@/components/roadmap-section";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <HeroSection />
      <QuickActionsSection />
      <IntegrationMap />
      <RoadmapSection />
    </div>
  );
}




