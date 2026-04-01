import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="surface-card mx-auto max-w-md space-y-6 rounded-3xl p-8">
      <p className="text-center text-sm text-[var(--text-secondary)]">로딩 중...</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
