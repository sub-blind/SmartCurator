"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.register({ email, password, full_name: fullName || undefined });
      const res = await api.login(email, password);
      login(res.access_token, email, res.refresh_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card mx-auto max-w-md space-y-6 rounded-3xl p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">회원가입</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          이메일과 비밀번호로 간단하게 계정을 만들고 개인 지식 저장소를 바로 시작해 보세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-xs text-[var(--text-secondary)]">
          이름 (선택)
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <label className="block text-xs text-[var(--text-secondary)]">
          이메일
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <label className="block text-xs text-[var(--text-secondary)]">
          비밀번호
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "가입 중..." : "회원가입"}
        </button>

        {error && <p className="text-xs text-red-300">{error}</p>}
      </form>

      <p className="text-xs text-[var(--text-muted)]">
        이미 계정이 있다면{" "}
        <Link href="/login" className="text-[var(--accent-strong)] underline-offset-2 hover:underline">
          로그인
        </Link>
        으로 이동해 주세요.
      </p>
    </div>
  );
}
