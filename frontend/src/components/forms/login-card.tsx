"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Pill } from "../ui/pill";

export function LoginCard({
  onTokenReady
}: {
  onTokenReady: (token: string) => void;
}) {
  const [email, setEmail] = useState("demo@smartcurator.ai");
  const [password, setPassword] = useState("demo1234!");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const token = await api.login(email, password);
      onTokenReady(token.access_token);
      setMessage("토큰 발급 완료! 아래 폼에서 바로 사용해보세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">JWT 토큰 받기</p>
          <p className="text-xs text-slate-400">FastAPI /auth/login 연동</p>
        </div>
        <Pill label="Step 1" />
      </div>
      <label className="text-xs text-slate-300">
        이메일
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
      </label>
      <label className="text-xs text-slate-300">
        비밀번호
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "요청 중..." : "토큰 발급"}
      </button>
      {message && <p className="text-xs text-emerald-300">{message}</p>}
    </form>
  );
}




