"use client";

import { useState } from "react";
import { Section } from "./ui/section";
import { LoginCard } from "./forms/login-card";
import { QuickAddForm } from "./forms/quick-add-form";

export function QuickActionsSection() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <Section
      id="quick-start"
      title="바로 테스트 가능한 흐름"
      description="JWT 토큰을 발급받고, 동일 화면에서 컨텐츠를 큐에 넣어 FastAPI + Celery 파이프라인을 타게 합니다."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <LoginCard onTokenReady={setToken} />
        <QuickAddForm token={token} />
      </div>
    </Section>
  );
}




