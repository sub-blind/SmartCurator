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
      title="빠른 사용 가이드"
      description="로그인과 콘텐츠 등록을 한 화면에서 수행해 전체 흐름을 빠르게 확인할 수 있습니다."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <LoginCard onTokenReady={setToken} />
        <QuickAddForm token={token} />
      </div>
    </Section>
  );
}




