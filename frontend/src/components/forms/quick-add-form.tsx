"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ContentType } from "@/types/content";
import { Pill } from "../ui/pill";

type FormState = {
  title: string;
  url: string;
  content: string;
  type: ContentType;
  isPublic: boolean;
};

const defaultState: FormState = {
  title: "",
  url: "",
  content: "",
  type: "url",
  isPublic: true
};

export function QuickAddForm({ token }: { token: string | null }) {
  const [form, setForm] = useState<FormState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setMessage("먼저 위에서 JWT 토큰을 발급받아 주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        title: form.title,
        url: form.url || undefined,
        raw_content: form.content || undefined,
        content_type: form.type,
        is_public: form.isPublic,
        token
      };
      await api.quickAddContent(payload);
      setMessage("컨텐츠가 백엔드 큐에 등록되었습니다!");
      setForm(defaultState);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "등록 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">컨텐츠 빠르게 추가</p>
          <p className="text-xs text-slate-400">/contents 엔드포인트 연결</p>
        </div>
        <Pill label="Step 2" />
      </div>
      <label className="text-xs text-slate-300">
        제목
        <input
          required
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
      </label>
      <label className="text-xs text-slate-300">
        URL (선택)
        <input
          type="url"
          value={form.url}
          onChange={(e) => handleChange("url", e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
      </label>
      <label className="text-xs text-slate-300">
        메모 / 본문 (선택)
        <textarea
          value={form.content}
          onChange={(e) => handleChange("content", e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300">
          타입
          <select
            value={form.type}
            onChange={(e) => handleChange("type", e.target.value as ContentType)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          >
            <option value="url">URL</option>
            <option value="pdf">PDF</option>
            <option value="text">텍스트</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => handleChange("isPublic", e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-slate-900/70 accent-blue-500"
          />
          공개 컨텐츠로 저장
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "등록 중..." : "컨텐츠 큐에 보내기"}
      </button>
      {message && <p className="text-xs text-emerald-300">{message}</p>}
    </form>
  );
}



