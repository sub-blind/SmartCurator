"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";
import type { ChatAnswer, ChatSource, ContentItem, ContentType } from "@/types/content";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
};

type SourceKind = "youtube" | "website" | "pdf" | "note";

type SourceOption = {
  id: SourceKind;
  label: string;
  hint: string;
  placeholder: string;
  contentType: ContentType;
};

const SOURCE_OPTIONS: SourceOption[] = [
  {
    id: "youtube",
    label: "유튜브",
    hint: "영상 링크를 넣으면 자막을 바탕으로 요약합니다.",
    placeholder: "https://youtube.com/watch?v=abc",
    contentType: "url",
  },
  {
    id: "website",
    label: "웹사이트",
    hint: "기사나 블로그 링크를 넣으면 본문 요약을 만듭니다.",
    placeholder: "https://news.example.com/article/123",
    contentType: "url",
  },
  {
    id: "pdf",
    label: "PDF",
    hint: "PDF 파일을 바로 업로드해서 요약과 태그를 생성합니다.",
    placeholder: "",
    contentType: "pdf",
  },
  {
    id: "note",
    label: "메모/본문",
    hint: "직접 쓴 메모나 본문도 바로 저장할 수 있습니다.",
    placeholder: "회의 메모, 기사 초안, 읽고 싶은 문장을 붙여넣어 보세요.",
    contentType: "text",
  },
];

/** 가져오기 전 오른쪽 패널: 탭별 안내·예시 입력 */
const SOURCE_EMPTY_PANEL: Record<
  SourceKind,
  {
    headline: string;
    tip: string;
    examples: { label: string; value: string }[];
  }
> = {
  youtube: {
    headline: "자막이 있으면 그걸로 요약해요",
    tip: "자동 생성·한국어 자막이 붙은 영상이 가장 안정적이에요. 너무 짧은 클립은 본문이 부족할 수 있어요.",
    examples: [
      { label: "예시 링크 넣기", value: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
      { label: "짧은 주소(youtu.be)", value: "https://youtu.be/jNQXAC9IVRw" },
    ],
  },
  website: {
    headline: "기사·글 본문을 긁어 옵니다",
    tip: "랭킹·목록 페이지보다는 글 한 편 URL이 좋아요. 막혀 있으면 본문을 복사해서 메모 탭에 붙여 넣을 수도 있어요.",
    examples: [
      {
        label: "위키 본문 예시",
        value: "https://ko.wikipedia.org/wiki/%EC%9C%84%ED%82%A4%EB%B0%B1%EA%B3%BC",
      },
    ],
  },
  pdf: {
    headline: "이 화면에서 PDF를 바로 올릴 수 있어요",
    tip: "왼쪽에서 파일을 고른 뒤 가져오기를 누르면 요약·태그 파이프라인이 돌아가요. 여러 파일은 대시보드가 편해요.",
    examples: [],
  },
  note: {
    headline: "메모는 제목 없이도 괜찮아요",
    tip: "첫 줄이 짧으면 제목으로 쓰이고, 나머지는 본문으로 저장돼요. 회의·강의 메모를 통째로 붙여도 됩니다.",
    examples: [
      {
        label: "짧은 메모 예시 넣기",
        value:
          "오늘 정리: RAG는 검색된 근거만 모델에 넣는 방식이다. 환각을 줄이려면 출처 스니펫을 같이 보여 주는 게 좋다.",
      },
    ],
  },
};

const LANDING_POLL_MAX_ATTEMPTS = 90;
const LANDING_POLL_INTERVAL_MS = 2500;

function makeAutoTitle(sourceKind: SourceKind, draftValue: string, fileName?: string | null) {
  if (sourceKind === "pdf" && fileName) {
    return fileName.replace(/\.[^.]+$/, "").trim() || "PDF 문서";
  }

  if (sourceKind === "youtube" || sourceKind === "website") {
    return "자동 생성 제목";
  }

  if (sourceKind === "note") {
    const firstLine = draftValue.replace(/\s+/g, " ").trim().slice(0, 36).trim();
    return firstLine || "메모";
  }

  return "새 콘텐츠";
}

function buildYouTubeThumbnail(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let videoId = "";

    if (host.includes("youtu.be")) {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v") ?? "";
      if (!videoId) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) {
          videoId = parts[1];
        }
      }
    }

    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
  } catch {
    return undefined;
  }
}

function getPreviewTone(item: ContentItem) {
  if ((item.url || "").includes("youtu")) return "from-rose-200 via-orange-100 to-white";
  if (item.content_type === "text") return "from-violet-200 via-fuchsia-100 to-white";
  if (item.content_type === "pdf") return "from-sky-200 via-cyan-100 to-white";
  return "from-emerald-200 via-teal-100 to-white";
}

function getTypeLabel(item: ContentItem) {
  if ((item.url || "").includes("youtu")) return "유튜브";
  if (item.content_type === "text") return "메모/본문";
  if (item.content_type === "pdf") return "PDF";
  return "웹사이트";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function LandingIntakeSection() {
  const router = useRouter();
  const { token, initialized } = useAuth();
  const [activeSource, setActiveSource] = useState<SourceKind>("youtube");
  const [draftValue, setDraftValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<ContentItem | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeOption = useMemo(
    () => SOURCE_OPTIONS.find((item) => item.id === activeSource) ?? SOURCE_OPTIONS[0],
    [activeSource],
  );

  const clearPoll = () => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearPoll();
  }, []);

  useEffect(() => {
    if (!loginModalOpen || typeof window === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLoginModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loginModalOpen]);

  useEffect(() => {
    setMessage(null);
    if (activeSource !== "pdf") {
      setSelectedFile(null);
    }
  }, [activeSource]);

  const pollContent = async (contentId: number, authToken: string, attempt = 0) => {
    try {
      const latest = await api.getContent(contentId, authToken);
      setPreviewContent(latest);

      const stillWorking = latest.status === "pending" || latest.status === "processing";
      const shouldContinue = attempt < LANDING_POLL_MAX_ATTEMPTS && stillWorking;

      if (shouldContinue) {
        pollTimeoutRef.current = window.setTimeout(() => {
          void pollContent(contentId, authToken, attempt + 1);
        }, LANDING_POLL_INTERVAL_MS);
      } else if (stillWorking && attempt >= LANDING_POLL_MAX_ATTEMPTS) {
        setMessage(
          "여기서는 더 갱신하지 않아요. 잠시 후 대시보드에서 같은 항목을 확인해 보세요. 오래 걸리면 백그라운드 워커가 돌고 있는지도 확인해 주세요.",
        );
      }
    } catch {
      // Keep initial preview even if polling fails.
    }
  };

  const handleAskChat = async () => {
    const trimmed = chatQuestion.trim();
    if (!trimmed || !token || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", text: trimmed };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatQuestion("");
    setChatLoading(true);
    try {
      const answer = await api.askAssistant(trimmed, token);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: answer.answer, sources: answer.sources },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatLoading]);

  const handleImport = async () => {
    clearPoll();

    if (!token) {
      if (initialized) setLoginModalOpen(true);
      return;
    }

    if (activeSource === "pdf" && !selectedFile) {
      setMessage("PDF 파일을 먼저 선택해 주세요.");
      return;
    }

    const trimmed = draftValue.trim();
    if (activeSource !== "pdf" && !trimmed) {
      setMessage(activeSource === "note" ? "메모나 본문을 입력해 주세요." : "링크를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let created: ContentItem;

      if (activeSource === "pdf" && selectedFile) {
        created = await api.uploadContentFile({
          file: selectedFile,
          title: makeAutoTitle("pdf", "", selectedFile.name),
          is_public: true,
          token,
        });
      } else {
        const thumbnailUrl = activeSource === "youtube" ? buildYouTubeThumbnail(trimmed) : undefined;
        created = await api.quickAddContent({
          title: makeAutoTitle(activeSource, trimmed),
          url: activeOption.contentType === "url" ? trimmed : undefined,
          raw_content: activeOption.contentType === "text" ? trimmed : undefined,
          thumbnail_url: thumbnailUrl,
          content_type: activeOption.contentType,
          is_public: true,
          token,
        });
        created = {
          ...created,
          thumbnail_url: created.thumbnail_url ?? thumbnailUrl ?? null,
        };
      }

      setPreviewContent(created);
      setChatMessages([]);
      setChatQuestion("");
      setMessage("가져오는 중입니다. 처리되면 카드가 업데이트됩니다.");
      setDraftValue("");
      setSelectedFile(null);
      void pollContent(created.id, token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "가져오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <section className="surface-card overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.82fr)] lg:items-start">
        <div className="flex flex-col justify-between gap-6">
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-6 -top-6 h-36 w-44 rounded-full bg-[var(--accent)]/12 blur-3xl sm:h-40 sm:w-52"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-4 top-24 h-28 w-36 rounded-full bg-[var(--tone-violet)] blur-3xl opacity-80 sm:top-28 sm:h-32 sm:w-44"
              aria-hidden
            />
            <div className="relative flex gap-0 sm:gap-6 lg:gap-8">
              <div
                className="hidden w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--accent)] via-sky-500/70 via-55% to-violet-500/50 sm:block sm:min-h-[7.5rem]"
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-4 pt-0.5 sm:space-y-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                    넣는 즉시 요약 파이프라인 시작
                  </span>
                </div>
                <h1 className="max-w-xl text-[1.7rem] font-semibold leading-[1.22] tracking-tight text-[var(--text-primary)] break-keep sm:text-4xl sm:leading-[1.18] lg:text-[2.35rem]">
                  <span className="block font-medium text-[var(--text-muted)] sm:text-[var(--text-secondary)]">
                    붙여 넣기 한 번이면
                  </span>
                  <span className="mt-1.5 block text-[var(--text-primary)] sm:mt-2">
                    <span className="text-[var(--accent-strong)]">요약, 태그, 검색</span>
                    <span className="text-[var(--text-primary)]">까지 </span>
                    <span className="whitespace-nowrap">이어집니다.</span>
                  </span>
                </h1>
                <p className="max-w-lg text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base sm:leading-8">
                  유튜브는 자막을, 링크는 본문을 읽어 옵니다. 메모는 그대로 저장해 두고,
                  <span className="text-[var(--text-primary)]"> 오른쪽 카드</span>에서 완료 여부와 요약을 바로 확인하면 됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "📥", step: "1", title: "붙여넣기", desc: "링크·파일·메모를 넣으면", top: "border-t-[var(--tone-sky)]" },
              { icon: "⚡", step: "2", title: "자동 요약", desc: "요약·태그·벡터가 생성되고", top: "border-t-[var(--tone-amber)]" },
              { icon: "🤖", step: "3", title: "AI 질문", desc: "자료 기반으로 답변까지", top: "border-t-[var(--tone-violet)]" },
            ].map((item) => (
              <div
                key={item.step}
                className={`rounded-2xl border border-[var(--border)] border-t-2 ${item.top} bg-gradient-to-b from-[var(--surface-muted)] to-[var(--accent-soft)]/35 p-3 text-center shadow-sm shadow-slate-900/5 dark:shadow-black/20`}
              >
                <span className="text-xl">{item.icon}</span>
                <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {SOURCE_OPTIONS.map((option) => {
              const active = option.id === activeSource;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveSource(option.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/25"
                      : "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border-strong)] bg-gradient-to-br from-[var(--surface-muted)] via-[var(--surface-muted)] to-[var(--accent-soft)]/55 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{activeOption.label}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeOption.hint}</p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              {activeSource === "pdf" ? (
                <div className="flex min-h-[58px] flex-1 items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4">
                  <label className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]">
                    <input
                      type="file"
                      accept=".pdf,text/plain,application/pdf"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    파일 첨부
                  </label>
                  <span className={`min-w-0 truncate text-sm ${selectedFile ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    {selectedFile ? selectedFile.name : "선택된 파일 없음"}
                  </span>
                </div>
              ) : (
                <input
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  placeholder={activeOption.placeholder}
                  className="min-h-[58px] flex-1 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="min-h-[58px] rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-white shadow-md shadow-[var(--accent)]/30 transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? "가져오는 중..." : "가져오기"}
              </button>
            </div>

            {activeSource === "pdf" && (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                PDF는 선택한 파일명을 기준으로 제목을 만들고 내용을 읽어 요약을 생성합니다.
              </p>
            )}

            {message && <p className="mt-4 text-sm text-[var(--text-secondary)]">{message}</p>}
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-col max-h-[min(36rem,calc(100vh-10rem))] lg:sticky lg:top-28 lg:max-h-[min(42rem,calc(100vh-8rem))] lg:h-[min(42rem,calc(100vh-8rem))]">
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">방금 가져온 자료</p>
              <p className="text-xs text-[var(--text-muted)]">입력한 링크나 메모가 이 자리에서 바로 카드로 보입니다.</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent-strong)]">Result</span>
          </div>

          {previewContent ? (
            <article className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)]">

              {/* ── 헤더: 제목 + 상태 (고정) ── */}
              <div className="shrink-0 border-b border-[var(--border)] px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                    {previewContent.title}
                  </h3>
                  <div className="flex shrink-0 items-center gap-2">
                    {previewContent.status === "completed" ? (
                      <span className="rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[11px] text-[var(--status-success-fg)]">
                        완료
                      </span>
                    ) : previewContent.status === "failed" ? (
                      <span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-0.5 text-[11px] text-[var(--status-danger-fg)]">
                        실패
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200">처리 중</span>
                    )}
                    {previewContent.url && (
                      <a href={previewContent.url} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--accent-strong)] hover:underline">원문</a>
                    )}
                    <button type="button" onClick={() => router.push("/dashboard")} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">대시보드</button>
                  </div>
                </div>
              </div>

              {/* ── 스크롤 영역: 요약 + 대화 ── */}
              <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

                {/* 요약·태그 */}
                <div className="space-y-2 px-5 py-4">
                  {previewContent.summary ? (
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      {previewContent.summary}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">
                      요약을 만드는 중입니다…
                    </p>
                  )}

                  {previewContent.tags && previewContent.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {previewContent.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 대화 메시지 */}
                {chatMessages.length > 0 && (
                  <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
                    {chatMessages.map((msg, i) =>
                      msg.role === "user" ? (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-sm text-white">{msg.text}</div>
                        </div>
                      ) : (
                        <div key={i} className="flex justify-start">
                          <div className="max-w-[90%] space-y-1.5">
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{msg.text}</p>
                            {msg.sources && msg.sources.length > 0 && (
                              <details>
                                <summary className="cursor-pointer text-[11px] font-medium text-[var(--accent-strong)] hover:underline">출처 {msg.sources.length}개</summary>
                                <div className="mt-1.5 space-y-1">
                                  {msg.sources.map((source, j) => (
                                    <div key={`${source.content_id}-${source.chunk_index}-${j}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                                      <p className="text-[11px] font-medium text-[var(--text-primary)]">{source.title}</p>
                                      <p className="mt-0.5 text-[11px] leading-5 text-[var(--text-muted)]">{source.snippet.length > 140 ? `${source.snippet.slice(0, 140)}…` : source.snippet}</p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-1.5 px-1 py-2">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── 입력창 (하단 고정) ── */}
              {previewContent.status === "completed" && token && (
                <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      ref={chatInputRef}
                      value={chatQuestion}
                      onChange={(event) => setChatQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) void handleAskChat();
                      }}
                      placeholder="이 자료에 대해 질문해 보세요..."
                      disabled={chatLoading}
                      className="min-h-[40px] flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAskChat()}
                      disabled={chatLoading || !chatQuestion.trim()}
                      className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:opacity-90 disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </article>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)]">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className={`h-32 bg-gradient-to-br ${
                  activeSource === "youtube" ? "from-rose-500/20 via-orange-400/10 to-transparent"
                    : activeSource === "pdf" ? "from-sky-500/20 via-cyan-400/10 to-transparent"
                    : activeSource === "note" ? "from-violet-500/20 via-fuchsia-400/10 to-transparent"
                    : "from-emerald-500/20 via-teal-400/10 to-transparent"
                }`}>
                  <div className="flex h-full items-center justify-center">
                    <span className="text-4xl">
                      {activeSource === "youtube" ? "▶" : activeSource === "pdf" ? "📄" : activeSource === "note" ? "✏️" : "🌐"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[11px] text-[var(--status-success-fg)]">
                      완료
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">예시 결과</span>
                  </div>

                  <h3 className="text-base font-semibold leading-6 text-[var(--text-primary)]">
                    {activeSource === "youtube" && "유튜브 최초의 영상, 'Me at the zoo' 분석"}
                    {activeSource === "website" && "파리기후협정 10년, 탄소중립 어디까지 왔나"}
                    {activeSource === "pdf" && "2024 AI 트렌드 리포트 — 핵심 요약"}
                    {activeSource === "note" && "RAG 아키텍처 정리 메모"}
                  </h3>

                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    {activeSource === "youtube" && "2005년 4월 23일에 업로드된 유튜브 최초의 영상으로, 공동 창업자 자베드 카림이 샌디에이고 동물원에서 코끼리를 배경으로 19초간 촬영한 영상이다. 이 영상은 소셜 미디어 콘텐츠의 시초로 평가받는다."}
                    {activeSource === "website" && "파리협정 이후 10년, 전 세계 196개국의 탄소 감축 이행 현황을 점검한다. 재생에너지 비중은 30%를 넘었지만, 산업·수송 부문의 전환은 여전히 느리다."}
                    {activeSource === "pdf" && "생성형 AI가 산업 전반에 미친 영향을 정리한 보고서의 핵심 내용을 요약했다. 멀티모달 모델의 등장과 온디바이스 AI 확산이 주요 트렌드로 꼽힌다."}
                    {activeSource === "note" && "검색 보강 생성(RAG)은 외부 문서를 검색해 LLM 컨텍스트에 주입하는 방식이다. 환각을 줄이고 출처를 명시할 수 있어 기업 지식 관리에 적합하다."}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {activeSource === "youtube" && ["유튜브", "역사", "소셜미디어"].map((t) => (
                      <span key={t} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">#{t}</span>
                    ))}
                    {activeSource === "website" && ["기후변화", "탄소중립", "재생에너지"].map((t) => (
                      <span key={t} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">#{t}</span>
                    ))}
                    {activeSource === "pdf" && ["AI트렌드", "멀티모달", "온디바이스"].map((t) => (
                      <span key={t} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">#{t}</span>
                    ))}
                    {activeSource === "note" && ["RAG", "LLM", "벡터검색"].map((t) => (
                      <span key={t} className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">#{t}</span>
                    ))}
                  </div>

                  <div className="border-t border-[var(--border)] pt-3">
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)]/60 px-3.5 py-2 text-sm text-white/80">
                        {activeSource === "youtube" && "이 영상이 유튜브 역사에서 갖는 의미는?"}
                        {activeSource === "website" && "한국의 탄소중립 이행 현황은?"}
                        {activeSource === "pdf" && "올해 가장 주목할 AI 트렌드는?"}
                        {activeSource === "note" && "RAG의 장점이 뭐야?"}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm leading-6 text-[var(--text-secondary)]/60">
                        {activeSource === "youtube" && "유튜브 최초의 영상으로서 사용자 제작 콘텐츠(UGC) 시대의 시작을 상징합니다. (출처 1)"}
                        {activeSource === "website" && "한국은 2050 탄소중립을 선언했으나 석탄 비중이 높아 전환 속도가 과제입니다. (출처 1)"}
                        {activeSource === "pdf" && "멀티모달 AI와 소형 언어모델의 온디바이스 탑재가 가장 큰 변화로 꼽힙니다. (출처 2)"}
                        {activeSource === "note" && "외부 근거를 명시하므로 환각이 줄고, 출처를 함께 보여줄 수 있습니다. (출처 1)"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
                {SOURCE_EMPTY_PANEL[activeSource].examples.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftValue(SOURCE_EMPTY_PANEL[activeSource].examples[0].value);
                      setMessage(null);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    이 예시로 직접 해보기 →
                  </button>
                ) : (
                  <p className="text-center text-xs text-[var(--text-muted)]">
                    왼쪽에서 {activeOption.label}을(를) 입력하고 가져오기를 눌러 보세요
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>

      {loginModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-login-required-title"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => setLoginModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="min-w-0 pt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                알림
              </p>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setLoginModalOpen(false)}
                className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <h2 id="landing-login-required-title" className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
              로그인이 필요합니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              이 서비스를 이용하려면 로그인해 주세요. 저장과 요약은 로그인 후 바로 사용할 수 있습니다.
            </p>
            <div className="mt-8 grid w-full grid-cols-2 gap-3">
              <Link
                href="/register"
                className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center rounded-full border border-[var(--border-strong)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)]"
              >
                회원가입
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center rounded-full bg-[var(--accent)] px-3 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-[var(--accent)]/25 transition hover:brightness-110"
              >
                로그인
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
