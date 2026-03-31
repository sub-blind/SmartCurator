"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { QuickAddForm } from "@/components/forms/quick-add-form";
import { api } from "@/lib/api";
import type { ChatAnswer, ContentItem, SearchResultItem } from "@/types/content";

const UI_NOISE_PATTERNS: RegExp[] = [
  /공유(하기)?/gi,
  /페이스북|카카오톡|밴드|트위터/gi,
  /url복사|프린트|글자크기/gi,
  /지면\s*아이콘/gi,
  /입력\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}/gi,
];
const CONTENTS_PAGE_SIZE = 4;
const TOAST_TTL_MS = 3500;
const SUMMARY_PREVIEW_MAX_LENGTH = 420;

type DashboardToast = {
  id: number;
  kind: "success" | "error";
  text: string;
};

type TagStat = {
  tag: string;
  count: number;
};

function truncateText(text: string, maxLength: number) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function cleanSnippet(text: string) {
  let cleaned = (text || "").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
  cleaned = cleaned.replace(/https?:\/\/\S+/g, " ");
  cleaned = cleaned.replace(/\([^)]*instagram[^)]*\)/gi, " ");
  cleaned = cleaned.replace(/[*_`>#-]+/g, " ");
  for (const pattern of UI_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

function formatKoreanDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayTitle(title: string, contentId: number) {
  const normalized = (title || "").trim();
  if (!normalized) return `콘텐츠 #${contentId}`;
  if (/^뉴스\s*\d+$/i.test(normalized)) return `임시 콘텐츠 #${contentId}`;
  return normalized;
}

function isYouTubeUrl(url?: string | null) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("youtube.com") || host.includes("youtu.be");
  } catch {
    return false;
  }
}

function getMatchReason(query: string, result: SearchResultItem) {
  const terms = (query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return "의미 유사도 기반 매칭";

  const haystack = `${result.title} ${result.summary} ${result.top_snippet} ${(result.tags || []).join(" ")}`.toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term));
  if (matched.length === 0) return "의미 유사도 기반 매칭";
  return `매칭 근거: ${matched.slice(0, 3).join(", ")}`;
}

function StatusBadge({ status }: { status: ContentItem["status"] }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium";
  if (status === "completed") {
    return <span className={`${base} bg-emerald-500/20 text-emerald-200`}>완료</span>;
  }
  if (status === "processing") {
    return <span className={`${base} bg-blue-500/20 text-blue-200`}>처리 중</span>;
  }
  if (status === "failed") {
    return <span className={`${base} bg-red-500/20 text-red-200`}>실패</span>;
  }
  return <span className={`${base} bg-slate-500/20 text-slate-200`}>대기</span>;
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, initialized } = useAuth();
  const onboardParam = searchParams.get("onboard");
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"strict" | "balanced" | "broad">("balanced");
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [chatAnswer, setChatAnswer] = useState<ChatAnswer | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [expandedSearchResults, setExpandedSearchResults] = useState<Set<number>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [currentContentsPage, setCurrentContentsPage] = useState(1);
  const [toasts, setToasts] = useState<DashboardToast[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const ONBOARDING_DISMISS_KEY = "smartcurator_dashboard_quick_guide_dismissed_v1";
  const hasLoadedOnceRef = useRef(false);
  const prevStatusByIdRef = useRef<Map<number, ContentItem["status"]>>(new Map());
  const requestInFlightRef = useRef(false);

  const sortedContents = useMemo(() => {
    return [...contents].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      return bTime - aTime;
    });
  }, [contents]);

  const tagStats = useMemo<TagStat[]>(() => {
    const counter = new Map<string, number>();
    for (const item of sortedContents) {
      const tags = item.tags || [];
      const uniqueTags = new Set(tags.map((tag) => (tag || "").trim()).filter(Boolean));
      for (const tag of uniqueTags) {
        counter.set(tag, (counter.get(tag) || 0) + 1);
      }
    }
    return [...counter.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag, "ko-KR")))
      .slice(0, 15);
  }, [sortedContents]);

  const filteredContents = useMemo(() => {
    if (!activeTagFilter) return sortedContents;
    return sortedContents.filter((item) => (item.tags || []).includes(activeTagFilter));
  }, [sortedContents, activeTagFilter]);

  const pendingCount = useMemo(
    () => sortedContents.filter((item) => item.status === "pending").length,
    [sortedContents],
  );
  const processingCount = useMemo(
    () => sortedContents.filter((item) => item.status === "processing").length,
    [sortedContents],
  );
  const activeQueueCount = pendingCount + processingCount;

  const totalContentsPages = Math.max(1, Math.ceil(filteredContents.length / CONTENTS_PAGE_SIZE));

  const paginatedContents = useMemo(() => {
    const startIndex = (currentContentsPage - 1) * CONTENTS_PAGE_SIZE;
    return filteredContents.slice(startIndex, startIndex + CONTENTS_PAGE_SIZE);
  }, [filteredContents, currentContentsPage]);

  const toggleSearchResult = (contentId: number) => {
    setExpandedSearchResults((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const toggleSource = (sourceKey: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceKey)) {
        next.delete(sourceKey);
      } else {
        next.add(sourceKey);
      }
      return next;
    });
  };

  const pushToast = useCallback((kind: DashboardToast["kind"], text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    setToasts((prev) => [...prev, { id, kind, text }].slice(-4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  const loadContents = useCallback(async (options?: { silent?: boolean; resetPage?: boolean }) => {
    if (!token) return;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const data = await api.getMyContents(token);
      const nextStatusMap = new Map<number, ContentItem["status"]>();
      for (const item of data) {
        nextStatusMap.set(item.id, item.status);
      }

      if (hasLoadedOnceRef.current) {
        for (const item of data) {
          const prevStatus = prevStatusByIdRef.current.get(item.id);
          const becameCompleted = (prevStatus === "pending" || prevStatus === "processing") && item.status === "completed";
          const becameFailed = (prevStatus === "pending" || prevStatus === "processing") && item.status === "failed";
          if (becameCompleted) {
            pushToast("success", `${displayTitle(item.title, item.id)} 처리가 완료되었습니다.`);
          }
          if (becameFailed) {
            pushToast("error", `${displayTitle(item.title, item.id)} 처리에 실패했습니다.`);
          }
        }
      }

      prevStatusByIdRef.current = nextStatusMap;
      hasLoadedOnceRef.current = true;
      setContents(data);
      if (options?.resetPage) {
        setCurrentContentsPage(1);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "콘텐츠를 불러오지 못했습니다.");
    } finally {
      requestInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [token, pushToast]);

  useEffect(() => {
    if (initialized && token) {
      void loadContents({ resetPage: true });
    }
  }, [initialized, token, loadContents]);

  useEffect(() => {
    if (!initialized || !token) return;
    const timer = window.setInterval(() => {
      void loadContents({ silent: true });
    }, 12000);
    return () => window.clearInterval(timer);
  }, [initialized, token, loadContents]);

  useEffect(() => {
    if (!initialized || !token) return;
    const dismissed = window.localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1";
    if (onboardParam === "1" || !dismissed) {
      setShowQuickGuide(true);
    }
    if (onboardParam === "1") {
      router.replace("/dashboard");
    }
  }, [initialized, token, onboardParam, router]);

  useEffect(() => {
    if (currentContentsPage > totalContentsPages) {
      setCurrentContentsPage(totalContentsPages);
    }
  }, [currentContentsPage, totalContentsPages]);

  useEffect(() => {
    setEditingTitle(selectedContent?.title ?? "");
  }, [selectedContent]);

  const handleSemanticSearch = async () => {
    if (!token || !searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchMessage(null);
    try {
      const scoreThresholdByMode: Record<"strict" | "balanced" | "broad", number> = {
        strict: 0.2,
        balanced: 0.12,
        broad: 0.07,
      };
      const response = await api.semanticSearch(searchQuery.trim(), token, {
        limit: 6,
        score_threshold: scoreThresholdByMode[searchMode],
      });
      setSearchResults(response.results);
      if (response.results.length === 0) {
        setSearchMessage("검색 결과가 없습니다. 더 구체적인 키워드로 다시 검색해 보세요.");
      }
    } catch (err) {
      setSearchMessage(err instanceof Error ? err.message : "검색에 실패했습니다.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAskAssistant = async () => {
    if (!token || !question.trim()) return;
    setChatLoading(true);
    setChatMessage(null);
    try {
      const response = await api.askAssistant(question.trim(), token);
      setChatAnswer(response);
    } catch (err) {
      setChatMessage(err instanceof Error ? err.message : "답변 생성에 실패했습니다.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!token || !selectedContent) return;
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      setMessage("제목은 비워둘 수 없습니다.");
      return;
    }
    if (nextTitle === selectedContent.title) return;

    setSavingTitle(true);
    try {
      const updated = await api.updateContent(selectedContent.id, { title: nextTitle }, token);
      setContents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedContent(updated);
      pushToast("success", "제목이 수정되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "제목 수정에 실패했습니다.");
    } finally {
      setSavingTitle(false);
    }
  };

  if (!initialized) {
    return <p className="text-sm text-slate-300">초기화 중입니다...</p>;
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-card">
        <h1 className="text-2xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-300">
          대시보드에서는 저장한 콘텐츠, 검색, AI 어시스턴트 기능을 사용할 수 있습니다.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 hover:border-brand"
          >
            회원가입
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showQuickGuide && (
        <section className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-5 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-200">빠른 가이드</p>
              <h2 className="mt-1 text-lg font-semibold text-white">지금 바로 쓰는 3단계</h2>
              <p className="mt-1 text-sm text-slate-200">
                1) 콘텐츠 추가 2) 의미 검색 3) AI 질의 순서로 시작하면 가장 빨리 결과를 볼 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowQuickGuide(false);
                window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
              }}
              className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs text-slate-100 hover:border-white/40"
            >
              가이드 닫기
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="self-start space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card lg:sticky lg:top-28">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">내 콘텐츠</h1>
              <p className="text-sm text-slate-200">
                저장한 기사와 노트의 처리 상태, 요약, 태그를 확인합니다.
              </p>
              {activeTagFilter && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full border border-blue-300/40 bg-blue-500/20 px-2 py-0.5 text-[11px] text-blue-100">
                    #{activeTagFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTagFilter(null);
                      setCurrentContentsPage(1);
                    }}
                    className="text-[11px] text-slate-300 underline-offset-2 hover:underline"
                  >
                    필터 해제
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => loadContents({ resetPage: true })}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:border-brand"
            >
              새로고침
            </button>
          </div>
          {activeQueueCount > 0 && (
            <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <p className="text-sky-100">처리 큐 진행 중</p>
                <p className="text-sky-200">
                  대기 {pendingCount}건 · 처리중 {processingCount}건
                </p>
              </div>
              <div className="indeterminate-track">
                <div className="indeterminate-bar" />
              </div>
            </div>
          )}
          {loading && <p className="text-xs text-slate-400">불러오는 중...</p>}
          {message && <p className="text-xs text-red-300">{message}</p>}
          <div className="mt-2 space-y-3">
            {filteredContents.length === 0 && !loading && (
              <p className="text-sm text-slate-400">
                {activeTagFilter
                  ? `#${activeTagFilter} 태그에 해당하는 콘텐츠가 없습니다.`
                  : "아직 저장한 콘텐츠가 없습니다. 오른쪽 입력 폼에서 먼저 추가해 보세요."}
              </p>
            )}
            {paginatedContents.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 hover:border-brand/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedContent(item)}
                      className="text-left text-sm font-semibold text-white hover:text-blue-200"
                    >
                      {item.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      {item.is_public && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-100">
                          공개
                        </span>
                      )}
                      {item.content_type && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                          {item.content_type}
                        </span>
                      )}
                      {isYouTubeUrl(item.url) && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] text-red-100">
                          youtube
                        </span>
                      )}
                    </div>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-300 underline-offset-2 hover:underline"
                    >
                      원문 보기
                    </a>
                  )}
                </div>
                {item.summary && (
                  <button
                    type="button"
                    onClick={() => setSelectedContent(item)}
                    className="mt-2 block w-full text-left text-xs text-slate-200"
                  >
                    {truncateText(item.summary, SUMMARY_PREVIEW_MAX_LENGTH)}
                    <span className="ml-1 text-[11px] text-blue-300">전체 보기</span>
                  </button>
                )}
                {item.status === "failed" && item.processing_error && (
                  <p className="mt-2 rounded-lg border border-red-300/20 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
                    실패 원인: {truncateText(item.processing_error, 180)}
                  </p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.reprocessContent(item.id, token);
                          setMessage("재처리 요청을 보냈습니다.");
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : "재처리 요청에 실패했습니다.");
                        }
                      }}
                      className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-slate-100 hover:border-blue-400"
                    >
                      {item.status === "failed" ? "다시 시도" : "재처리"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = window.confirm("이 콘텐츠를 삭제하시겠습니까?");
                        if (!ok) return;
                        try {
                          await api.deleteContent(item.id, token);
                          setContents((prev) => prev.filter((content) => content.id !== item.id));
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
                        }
                      }}
                      className="whitespace-nowrap rounded-full border border-red-500/40 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-500/10"
                    >
                      삭제
                    </button>
                  </div>
                  <p className="shrink-0 text-[11px] text-slate-400 sm:text-right">
                    {item.status === "completed" ? "처리 완료" : "최근 업데이트"}{" "}
                    {formatKoreanDateTime(item.updated_at || item.created_at)}
                  </p>
                </div>
              </article>
            ))}
          </div>
          {filteredContents.length > CONTENTS_PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                {currentContentsPage} / {totalContentsPages} 페이지
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentContentsPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentContentsPage === 1}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-slate-200 disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentContentsPage((prev) => Math.min(totalContentsPages, prev + 1))
                  }
                  disabled={currentContentsPage >= totalContentsPages}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-slate-200 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">콘텐츠 추가</h2>
            <p className="text-xs text-slate-300">
              기사 URL이나 텍스트를 넣으면 백엔드가 요약, 태그, 벡터를 생성합니다.
            </p>
          </div>
          <QuickAddForm token={token} onCreated={() => void loadContents({ resetPage: true })} />
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">자주 쓰는 태그</h3>
              <span className="text-[11px] text-slate-400">Top 15</span>
            </div>
            {tagStats.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">태그가 있는 콘텐츠를 추가하면 여기 표시됩니다.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {tagStats.map((item) => {
                  const active = activeTagFilter === item.tag;
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => {
                        setActiveTagFilter((prev) => (prev === item.tag ? null : item.tag));
                        setCurrentContentsPage(1);
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                        active
                          ? "border border-blue-300/50 bg-blue-500/25 text-blue-100"
                          : "border border-white/15 bg-slate-900/60 text-slate-200 hover:border-white/35"
                      }`}
                      title={`#${item.tag} 콘텐츠 ${item.count}개`}
                    >
                      #{item.tag} ({item.count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">의미론적 검색</h2>
            <p className="text-xs text-slate-300">
              저장한 콘텐츠를 키워드가 아니라 의미 기준으로 검색합니다. 결과는 핵심 snippet 중심으로 보여줍니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "strict", label: "딱 맞는 결과", hint: "정확도 우선" },
              { id: "balanced", label: "적당히 넓게", hint: "기본 추천" },
              { id: "broad", label: "관련 내용까지", hint: "탐색 범위 확장" },
            ].map((mode) => {
              const selected = searchMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSearchMode(mode.id as "strict" | "balanced" | "broad")}
                  title={mode.hint}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition ${
                    selected
                      ? "border border-blue-400 bg-blue-500/20 text-blue-100"
                      : "border border-white/15 text-slate-300 hover:border-white/30"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="예: 쌈짓돈 논란 핵심 쟁점"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSemanticSearch}
              disabled={searchLoading}
              className="whitespace-nowrap rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {searchLoading ? "검색 중.." : "검색"}
            </button>
          </div>
          {searchMessage && <p className="text-xs text-slate-300">{searchMessage}</p>}
          <div className="space-y-3">
            {searchResults.map((result) => {
              const text = cleanSnippet(result.top_snippet || result.summary || "매칭된 발췌문이 없습니다.");
              const expanded = expandedSearchResults.has(result.content_id);
              const isLong = text.length > 220;
              return (
                <article
                  key={result.content_id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">{displayTitle(result.title, result.content_id)}</h3>
                    <span className="text-[11px] text-blue-200">
                      유사도 {result.similarity_score.toFixed(3)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{getMatchReason(searchQuery, result)}</p>
                  <div className="mt-2">
                    <p className="whitespace-pre-wrap text-xs text-slate-300">
                      {expanded || !isLong ? text : truncateText(text, 220)}
                    </p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleSearchResult(result.content_id)}
                        className="mt-1 text-[11px] text-blue-300 hover:underline"
                      >
                        {expanded ? "접기" : "더보기"}
                      </button>
                    )}
                  </div>
                  {result.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">AI 어시스턴트</h2>
            <p className="text-xs text-slate-300">
              저장한 기사와 노트의 근거 문단을 바탕으로 질문에 답변합니다.
            </p>
          </div>
          <div className="space-y-3">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="예: LG CNS가 어디에 투자했는지, 관련 기사 근거만 정리해줘"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAskAssistant}
              disabled={chatLoading}
              className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {chatLoading ? "답변 생성 중..." : "질문하기"}
            </button>
          </div>
          {chatMessage && <p className="text-xs text-red-300">{chatMessage}</p>}
          {chatAnswer && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">답변</p>
                <span className="text-[11px] text-blue-200">
                  신뢰도 {chatAnswer.confidence.toFixed(3)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{chatAnswer.answer}</p>
              {chatAnswer.sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">근거 출처</p>
                  {chatAnswer.sources.map((source, index) => {
                    const sourceKey = `${source.content_id}-${source.chunk_index}-${index}`;
                    const expanded = expandedSources.has(sourceKey);
                    const cleanedSnippet = cleanSnippet(source.snippet);
                    const isLong = cleanedSnippet.length > 220;
                    return (
                      <div
                        key={sourceKey}
                        className="rounded-xl border border-white/10 bg-slate-900/70 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-white">{displayTitle(source.title, source.content_id)}</p>
                          <span className="text-[11px] text-slate-400">
                            청크 {source.chunk_index} · {source.similarity_score.toFixed(3)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">
                          {expanded || !isLong ? cleanedSnippet : truncateText(cleanedSnippet, 220)}
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => toggleSource(sourceKey)}
                            className="mt-1 text-[11px] text-blue-300 hover:underline"
                          >
                            {expanded ? "접기" : "더보기"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {selectedContent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setSelectedContent(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full">
                <label className="block text-xs text-slate-300">제목</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveTitle()}
                    disabled={savingTitle}
                    className="whitespace-nowrap rounded-lg border border-blue-300/35 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 disabled:opacity-50"
                  >
                    {savingTitle ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedContent(null)}
                    className="whitespace-nowrap rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:border-brand"
                  >
                    닫기
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  생성 {new Date(selectedContent.created_at).toLocaleString()}
                </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedContent.status} />
              {selectedContent.is_public && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-100">공개</span>
              )}
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                {selectedContent.content_type}
              </span>
              {isYouTubeUrl(selectedContent.url) && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] text-red-100">
                  youtube
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-300">요약 전체</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                {selectedContent.summary || "요약이 아직 생성되지 않았습니다."}
              </p>
            </div>

            {selectedContent.status === "failed" && selectedContent.processing_error && (
              <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3">
                <p className="text-xs font-semibold text-red-200">실패 원인</p>
                <p className="mt-1 text-xs text-red-100">{selectedContent.processing_error}</p>
              </div>
            )}

            {selectedContent.tags && selectedContent.tags.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-300">태그</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedContent.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedContent.url && (
              <a
                href={selectedContent.url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block text-xs text-blue-300 underline-offset-2 hover:underline"
              >
                원문 보기
              </a>
            )}
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] mx-auto flex w-full max-w-6xl justify-end px-6 sm:px-10">
          <div className="space-y-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`rounded-xl border px-4 py-2 text-sm shadow-card ${
                  toast.kind === "success"
                    ? "border-emerald-300/35 bg-emerald-500/20 text-emerald-100"
                    : "border-red-300/35 bg-red-500/20 text-red-100"
                }`}
              >
                {toast.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-300">대시보드를 준비 중입니다...</p>}>
      <DashboardPageContent />
    </Suspense>
  );
}


