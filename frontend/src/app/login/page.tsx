import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-card">
      <p className="text-center text-sm text-slate-300">로딩 중...</p>
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
