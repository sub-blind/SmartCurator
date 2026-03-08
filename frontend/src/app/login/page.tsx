"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { token, initialized, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized && token) {
      router.replace("/dashboard");
    }
  }, [initialized, token, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      login(res.access_token, email);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-card">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">로그인</h1>
        <p className="text-sm text-slate-300">
          SmartCurator 계정으로 로그인하여 저장한 컨텐츠를 확인하고, 요약/검색/챗봇 기능을 사용해 보세요.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="text-xs text-slate-300">
          이메일
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
        </label>
        <label className="text-xs text-slate-300">
          비밀번호
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </form>
      <p className="text-xs text-slate-400">
        아직 계정이 없다면{" "}
        <Link href="/register" className="text-blue-300 underline-offset-2 hover:underline">
          회원가입
        </Link>
        을 먼저 진행해 주세요.
      </p>
    </div>
  );
}

