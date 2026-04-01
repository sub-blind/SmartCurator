"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import type { ContentType } from "@/types/content";

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
  isPublic: true,
};

export function QuickAddForm({
  token,
  onCreated,
}: {
  token: string | null;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState<FormState>(defaultState);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setMessage("먼저 로그인해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const manualTitle = form.title.trim();
      const effectiveTitle =
        manualTitle ||
        (file ? file.name : form.type === "url" ? "비우면 자동 제목" : "제목 없음");

      if (file) {
        await api.uploadContentFile({
          file,
          title: effectiveTitle,
          is_public: form.isPublic,
          token,
        });
      } else {
        await api.quickAddContent({
          title: effectiveTitle,
          url: form.url || undefined,
          raw_content: form.content || undefined,
          content_type: form.type,
          is_public: form.isPublic,
          token,
        });
      }

      setMessage("콘텐츠를 등록했습니다. 처리 완료 후 요약과 태그가 채워집니다.");
      setForm(defaultState);
      setFile(null);
      onCreated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="surface-muted space-y-4 rounded-2xl p-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">콘텐츠 추가</p>
        <p className="text-xs text-[var(--text-muted)]">URL, 텍스트, PDF 파일 업로드 지원</p>
      </div>

      <label className="block text-xs text-[var(--text-secondary)]">
        제목 (선택)
        <input
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="비우면 자동 제목"
          className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <label className="block text-xs text-[var(--text-secondary)]">
        URL (선택)
        <input
          type="url"
          value={form.url}
          onChange={(e) => handleChange("url", e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <label className="block text-xs text-[var(--text-secondary)]">
        메모 / 본문 (선택)
        <textarea
          value={form.content}
          onChange={(e) => handleChange("content", e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
      </label>

      <label className="block text-xs text-[var(--text-secondary)]">
        파일 첨부 (선택: PDF/TXT/MD)
        <input
          type="file"
          accept=".pdf,.txt,.md,text/plain,application/pdf,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border file:border-[var(--border-strong)] file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--text-primary)] hover:file:border-[var(--accent)]"
        />
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          파일을 선택하면 URL/본문 대신 파일 내용으로 등록됩니다.
        </p>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--text-secondary)]">
          타입
          <select
            value={form.type}
            onChange={(e) => handleChange("type", e.target.value as ContentType)}
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="url">URL</option>
            <option value="pdf">PDF</option>
            <option value="text">텍스트</option>
          </select>
        </label>

        <label className="flex items-center gap-2 pt-6 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => handleChange("isPublic", e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--surface-elevated)] accent-blue-500"
          />
          공개 콘텐츠로 저장
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "등록 중..." : "추가하기"}
      </button>

      {message && <p className="text-xs text-emerald-300">{message}</p>}
    </form>
  );
}
