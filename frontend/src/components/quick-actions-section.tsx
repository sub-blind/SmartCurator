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
      description="로그인하고 바로 링크나 메모를 넣어 볼 수 있는 화면이에요."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <LoginCard onTokenReady={setToken} />
        <QuickAddForm token={token} />
      </div>
    </Section>
  );
}




