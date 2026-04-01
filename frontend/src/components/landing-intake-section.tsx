"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";
import type { ContentItem, ContentType } from "@/types/content";

type SourceKind = "youtube" | "website" | "pdf" | "note";

type SourceOption = {
  id: SourceKind;
  label: string;
  hint: string;
  placeholder: string;
  contentType: ContentType;
};

/** 가져오기 전 오른쪽 패널: 탭별 안내·예시 (실제 동작하는 링크 위주) */
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
      { label: "위키 본문 예시", value: "https://ko.wikipedia.org/wiki/위키백과" },
    ],
  },
  pdf: {
    headline: "PDF는 대시보드에서 파일로 올려요",
    tip: "여기서는 링크·메모만 바로 넣을 수 있어요. PDF/TXT/MD는 대시보드 오른쪽 업로드 칸을 쓰면 같은 파이프라인으로 요약돼요.",
    examples: [],
  },
  note: {
    headline: "메모는 제목 없이도 괜찮아요",
    tip: "첫 줄이 짧으면 제목으로 쓰이고, 나머지는 본문으로 저장돼요. 회의나 강의 메모를 통째로 붙여도 됩니다.",
    examples: [
      {
        label: "짧은 메모 예시 넣기",
        value:
          "오늘 정리: RAG는 검색된 근거만 모델에 넣는 방식이다. 환각을 줄이려면 출처 스니펫을 같이 보여 주는 게 좋다.",
      },
    ],
  },
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
    hint: "PDF는 대시보드에서 파일 업로드로 추가할 수 있습니다.",
    placeholder: "PDF는 대시보드에서 업로드해 주세요.",
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

function makeAutoTitle(sourceKind: SourceKind, draftValue: string) {
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

/** 유튜브·다중 chunk 요약은 OpenAI·Celery 때문에 1분 이상 걸릴 수 있음 */
const LANDING_POLL_MAX_ATTEMPTS = 90;
const LANDING_POLL_INTERVAL_MS = 2500;

export function LandingIntakeSection() {
  const router = useRouter();
  const { token } = useAuth();
  const [activeSource, setActiveSource] = useState<SourceKind>("youtube");
  const [draftValue, setDraftValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<ContentItem | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

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
    return () => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, []);

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
          "여기 새로고침으로는 더 안 바뀔 수 있어요. 잠시 후 대시보드에서 같은 글을 열어 보시거나, 백그라운드 작업(워커)이 돌고 있는지 확인해 주세요.",
        );
      }
    } catch {
      // Keep the initial preview card even if polling fails.
    }
  };

  const handleImport = async () => {
    clearPoll();

    if (!token) {
      setMessage("로그인 후 이용해 주세요.");
      return;
    }

    const trimmed = draftValue.trim();
    if (!trimmed) {
      setMessage(activeSource === "note" ? "메모나 본문을 입력해 주세요." : "링크를 입력해 주세요.");
      return;
    }

    if (activeSource === "pdf") {
      setMessage("PDF는 대시보드에서 업로드해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const title = makeAutoTitle(activeSource, trimmed);
      const thumbnailUrl = activeSource === "youtube" ? buildYouTubeThumbnail(trimmed) : undefined;

      const created = await api.quickAddContent({
        title,
        url: activeOption.contentType === "url" ? trimmed : undefined,
        raw_content: activeOption.contentType === "text" ? trimmed : undefined,
        thumbnail_url: thumbnailUrl,
        content_type: activeOption.contentType,
        is_public: true,
        token,
      });

      setPreviewContent({
        ...created,
        thumbnail_url: created.thumbnail_url ?? thumbnailUrl ?? null,
      });
      setMessage("가져오는 중입니다. 처리되면 카드가 업데이트됩니다.");
      void pollContent(created.id, token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "가져오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-card overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.82fr)] lg:items-start">
        <div className="space-y-6">
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-6 -top-6 h-36 w-44 rounded-full bg-[var(--accent)]/12 blur-3xl sm:h-40 sm:w-52"
              aria-hidden
            />
            <div className="relative flex gap-0 sm:gap-6 lg:gap-8">
              <div
                className="hidden w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--accent)] via-sky-500/70 to-transparent sm:block sm:min-h-[7.5rem]"
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-4 pt-0.5 sm:space-y-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                    저장되면 바로 요약 파이프라인 시작
                  </span>
                </div>
                <h1 className="max-w-xl text-[1.7rem] font-semibold leading-[1.22] tracking-tight text-[var(--text-primary)] sm:text-4xl sm:leading-[1.18] lg:text-[2.35rem]">
                  <span className="block font-medium text-[var(--text-muted)] sm:text-[var(--text-secondary)]">
                    붙여 넣기 한 번이면,
                  </span>
                  <span className="mt-1.5 block text-[var(--text-primary)] sm:mt-2">
                    <span className="text-[var(--accent-strong)]">요약·태그·검색</span>
                    <span className="text-[var(--text-primary)]">까지 이어집니다</span>
                  </span>
                </h1>
                <p className="max-w-lg text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base sm:leading-8">
                  유튜브는 자막을, 웹 링크는 본문을 읽어 옵니다. 메모는 그대로 저장해요. 처리는 뒤에서 조용히 돌고,
                  <span className="text-[var(--text-primary)]"> 오른쪽 카드</span>에서 완료 여부·요약을 확인하면 됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {SOURCE_OPTIONS.map((option) => {
              const active = option.id === activeSource;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setActiveSource(option.id);
                    setMessage(null);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--text-primary)] text-slate-950"
                      : "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="surface-muted rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{activeOption.label}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeOption.hint}</p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
                바로 가져오기
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {activeSource === "note" ? (
                <textarea
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  placeholder={activeOption.placeholder}
                  rows={4}
                  className="min-h-[132px] flex-1 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-5 py-4 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
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
                className="min-h-[58px] rounded-2xl bg-[var(--text-primary)] px-6 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "가져오는 중..." : "가져오기"}
              </button>
            </div>

            {message && <p className="mt-4 text-sm text-[var(--text-secondary)]">{message}</p>}

            {!token && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span>저장과 요약은 로그인 후 바로 사용할 수 있어요.</span>
                <Link href="/login" className="font-medium text-[var(--accent-strong)] hover:underline">
                  로그인
                </Link>
                <Link href="/register" className="font-medium text-[var(--accent-strong)] hover:underline">
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">방금 가져온 자료</p>
              <p className="text-xs text-[var(--text-muted)]">입력한 링크나 메모가 이 자리에서 바로 카드로 보입니다.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Result</span>
          </div>

          {previewContent ? (
            <article className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)]">
              {previewContent.thumbnail_url ? (
                <img
                  src={previewContent.thumbnail_url}
                  alt={previewContent.title}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`flex h-48 items-center justify-center bg-gradient-to-br ${getPreviewTone(previewContent)}`}>
                  <div className="rounded-full bg-white/75 px-8 py-5 shadow-sm backdrop-blur">
                    <span className="block text-center text-[2rem] font-semibold tracking-tight text-slate-950/85">
                      SmartCurator
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--text-secondary)]">
                    {getTypeLabel(previewContent)}
                  </span>
                  {previewContent.status === "completed" ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200">완료</span>
                  ) : (
                    <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-blue-200">
                      {previewContent.status === "failed" ? "실패" : "처리 중"}
                    </span>
                  )}
                  <span>{formatDate(previewContent.created_at)}</span>
                </div>

                <h3 className="text-2xl font-semibold leading-9 text-[var(--text-primary)]">
                  {previewContent.title}
                </h3>

                <p className="text-sm leading-7 text-[var(--text-secondary)]">
                  {previewContent.summary
                    ? previewContent.summary
                    : "요약을 만드는 중입니다. 완료되면 여기에서 바로 결과를 확인할 수 있습니다."}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--accent)]"
                  >
                    대시보드에서 보기
                  </button>
                  {previewContent.url && (
                    <a
                      href={previewContent.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--accent-strong)] hover:underline"
                    >
                      원문 보기
                    </a>
                  )}
                </div>
              </div>
            </article>
          ) : (
            <div className="flex min-h-[420px] flex-col rounded-[1.75rem] border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] p-6 sm:min-h-[460px] sm:p-8">
              <div className="flex flex-1 flex-col gap-5">
                <div className="text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    지금 · {activeOption.label}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold leading-snug text-[var(--text-primary)] sm:text-xl">
                    {SOURCE_EMPTY_PANEL[activeSource].headline}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                    {SOURCE_EMPTY_PANEL[activeSource].tip}
                  </p>
                </div>

                {SOURCE_EMPTY_PANEL[activeSource].examples.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {SOURCE_EMPTY_PANEL[activeSource].examples.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        onClick={() => {
                          setDraftValue(ex.value);
                          setMessage(null);
                        }}
                        className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Link
                    href="/dashboard"
                    className="inline-flex w-fit items-center rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent)]"
                  >
                    대시보드에서 PDF 올리기 →
                  </Link>
                )}

                <p className="text-xs text-[var(--text-muted)]">
                  왼쪽에 값을 넣고 <span className="text-[var(--text-secondary)]">가져오기</span>를 누르면 이 영역이 실제 카드로 바뀝니다.
                </p>

                <div className="mt-auto border-t border-[var(--border)] pt-5">
                  <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">처리가 끝나면 이런 카드가 됩니다</p>
                  <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]">
                    <div className="h-[5.5rem] bg-gradient-to-br from-slate-500/25 via-slate-400/15 to-transparent" />
                    <div className="space-y-2.5 p-4">
                      <div className="h-2.5 max-w-[55%] rounded bg-[var(--border-strong)]" />
                      <div className="h-2 w-full rounded bg-[var(--border)]" />
                      <div className="h-2 w-[88%] rounded bg-[var(--border)]" />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="h-6 w-14 rounded-full bg-[var(--border-strong)]/70" />
                        <span className="h-6 w-11 rounded-full bg-[var(--border)]" />
                        <span className="h-6 w-20 rounded-full bg-[var(--border)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
