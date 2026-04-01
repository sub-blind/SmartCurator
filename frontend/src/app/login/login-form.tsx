"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReauthMode = searchParams.get("reauth") === "1";
  const nextPath = searchParams.get("next") || "/dashboard";
  const { token, initialized, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized && token && !isReauthMode) {
      router.replace("/dashboard");
    }
  }, [initialized, token, router, isReauthMode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      login(res.access_token, email, res.refresh_token);
      if (!isReauthMode && nextPath === "/dashboard") {
        router.replace("/dashboard?onboard=1");
      } else {
        router.replace(nextPath as Route);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card mx-auto max-w-md space-y-6 rounded-3xl p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {isReauthMode ? "세션 연장 로그인" : "로그인"}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {isReauthMode
            ? "세션 만료 전에 다시 인증해서 작업을 이어갑니다."
            : "SmartCurator 계정으로 로그인해서 저장한 콘텐츠와 검색, AI 질문 기능을 사용해 보세요."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {error && <p className="text-xs text-red-300">{error}</p>}
      </form>

      <p className="text-xs text-[var(--text-muted)]">
        아직 계정이 없다면{" "}
        <Link href="/register" className="text-[var(--accent-strong)] underline-offset-2 hover:underline">
          회원가입
        </Link>
        으로 이동해 주세요.
      </p>
    </div>
  );
}
