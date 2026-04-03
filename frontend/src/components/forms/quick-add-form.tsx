"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { ContentType } from "@/types/content";

type SourceKind = "youtube" | "website" | "pdf" | "note";

type FormState = {
  url: string;
  content: string;
  type: ContentType;
  isPublic: boolean;
};

const defaultState: FormState = {
  url: "",
  content: "",
  type: "url",
  isPublic: true,
};

const SOURCE_OPTIONS: Array<{
  id: SourceKind;
  label: string;
  description: string;
  contentType: ContentType;
  placeholder?: string;
}> = [
  {
    id: "youtube",
    label: "유튜브",
    description: "영상 링크를 넣고 요약과 핵심 포인트를 정리합니다.",
    contentType: "url",
    placeholder: "https://youtube.com/watch?v=abc",
  },
  {
    id: "website",
    label: "웹사이트",
    description: "기사나 블로그 링크를 저장하고 본문 요약을 생성합니다.",
    contentType: "url",
    placeholder: "https://news.example.com/article/123",
  },
  {
    id: "pdf",
    label: "PDF",
    description: "파일 업로드로 문서를 바로 추가합니다.",
    contentType: "pdf",
  },
  {
    id: "note",
    label: "메모/본문",
    description: "직접 쓴 메모나 본문을 저장하고 요약을 생성합니다.",
    contentType: "text",
    placeholder: "회의 메모, 기사 초안, 읽고 싶은 문장을 붙여넣어 보세요.",
  },
];

function makeAutoTitle(sourceKind: SourceKind, value: { url?: string; content?: string; fileName?: string | null }) {
  if (sourceKind === "pdf" && value.fileName) {
    return value.fileName.replace(/\.[^.]+$/, "").trim() || "PDF 문서";
  }

  if ((sourceKind === "youtube" || sourceKind === "website") && value.url) {
    return "자동 생성 제목";
  }

  if (sourceKind === "note" && value.content) {
    const firstLine = value.content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 36)
      .trim();
    return firstLine || "메모";
  }

  return "새 콘텐츠";
}

export function QuickAddForm({
  token,
  onCreated,
  initialSource = "website",
  initialPrefill = "",
}: {
  token: string | null;
  onCreated?: () => void;
  initialSource?: SourceKind;
  initialPrefill?: string;
}) {
  const [form, setForm] = useState<FormState>(defaultState);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<SourceKind>(initialSource);

  const activeSource = useMemo(
    () => SOURCE_OPTIONS.find((item) => item.id === sourceKind) ?? SOURCE_OPTIONS[1],
    [sourceKind],
  );

  useEffect(() => {
    setSourceKind(initialSource);
  }, [initialSource]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      type: activeSource.contentType,
      url: activeSource.id === "pdf" || activeSource.id === "note" ? "" : prev.url,
      content: activeSource.id === "youtube" || activeSource.id === "website" ? "" : prev.content,
    }));

    if (activeSource.id !== "pdf") {
      setFile(null);
    }
  }, [activeSource]);

  useEffect(() => {
    if (!initialPrefill.trim()) return;

    if (sourceKind === "note") {
      setForm((prev) => ({ ...prev, content: initialPrefill }));
      return;
    }

    if (sourceKind !== "pdf") {
      setForm((prev) => ({ ...prev, url: initialPrefill }));
    }
  }, [initialPrefill, sourceKind]);

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
      if (activeSource.id === "pdf" && !file) {
        throw new Error("PDF 파일을 먼저 선택해 주세요.");
      }

      if ((activeSource.id === "youtube" || activeSource.id === "website") && !form.url.trim()) {
        throw new Error("링크를 입력해 주세요.");
      }

      if (activeSource.id === "note" && !form.content.trim()) {
        throw new Error("메모나 본문을 입력해 주세요.");
      }

      const effectiveTitle = makeAutoTitle(sourceKind, {
        url: form.url.trim(),
        content: form.content.trim(),
        fileName: file?.name ?? null,
      });

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
      setSourceKind(initialSource);
      onCreated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="surface-muted space-y-5 rounded-[1.75rem] p-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">자료 가져오기</p>
        <p className="text-xs text-[var(--text-muted)]">
          유튜브, 웹사이트, PDF, 메모/본문을 저장해서 요약과 태그를 생성합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SOURCE_OPTIONS.map((option) => {
          const active = option.id === sourceKind;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSourceKind(option.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/20"
                  : "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">{activeSource.label}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{activeSource.description}</p>
      </div>

      {(sourceKind === "youtube" || sourceKind === "website") && (
        <label className="block text-xs text-[var(--text-secondary)]">
          링크
          <input
            type="url"
            value={form.url}
            onChange={(e) => handleChange("url", e.target.value)}
            placeholder={activeSource.placeholder}
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
      )}

      {sourceKind === "note" && (
        <label className="block text-xs text-[var(--text-secondary)]">
          메모 / 본문
          <textarea
            value={form.content}
            onChange={(e) => handleChange("content", e.target.value)}
            rows={7}
            placeholder={activeSource.placeholder}
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
      )}

      {sourceKind === "pdf" && (
        <label className="block text-xs text-[var(--text-secondary)]">
          PDF 파일
          <input
            type="file"
            accept=".pdf,text/plain,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border file:border-[var(--border-strong)] file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--text-primary)] hover:file:border-[var(--accent)]"
          />
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            파일명을 바탕으로 제목을 자동으로 만들고 내용을 기준으로 요약과 태그를 생성합니다.
          </p>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 pt-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => handleChange("isPublic", e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--surface-elevated)] accent-blue-500"
          />
          공개 콘텐츠로 저장
        </label>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-xs text-[var(--text-secondary)]">
          제목은 자동으로 생성되고, 저장 후에도 상세 모달에서 수정할 수 있습니다.
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[var(--accent)] px-3 py-3 text-sm font-semibold text-white shadow-md shadow-[var(--accent)]/25 transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "등록 중..." : `${activeSource.label} 가져오기`}
      </button>

      {message && <p className="text-xs text-emerald-300">{message}</p>}
    </form>
  );
}
