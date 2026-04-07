"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { QuickAddForm } from "@/components/forms/quick-add-form";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { api } from "@/lib/api";
import type { ChatAnswer, ContentItem, SearchResultItem } from "@/types/content";

const UI_NOISE_PATTERNS: RegExp[] = [
  /공유(하기)?/gi,
  /페이스북|카카오톡|밴드|트위터/gi,
  /url복사|프린트|글자크기/gi,
  /지면\s*아이콘/gi,
  /입력\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}/gi,
  /fn[Ss]urvey|fn영상|신문보기|메뉴\s*바로가기|베스트\s*댓글\s*이벤트/gi,
  /지나친\s*욕설|비방|악의적인\s*게시물|삭제될\s*수\s*있습니다|신고할\s*수\s*있습니다/gi,
  /\[신문고\]|［신문고］/g,
];

/** 뉴스 사이트 상단/푸터에 붙는 잡문구·깨진 링크 (replace 전용) */
const SNIPPET_JUNK_REPLACE =
  /tp:\/\/|tps:\/\/|:\/\/\(|www\.fnnews\.com|뉴스\s*1위|실시간\s*뉴스\s*속보|구독신청|모바일\s*웹/gi;
const CONTENTS_PAGE_SIZE = 3;
const TOAST_TTL_MS = 3500;

const EXPLORE_SEARCH_EXAMPLES = ["쌈짓돈 논란 핵심 쟁점", "원유 수급과 국내 물가", "최근 반도체 투자 동향"];

function confidenceBarsFromScore(confidence: number): { label: string; filled: number } {
  if (confidence >= 0.55) return { label: "신뢰 높음", filled: 3 };
  if (confidence >= 0.35) return { label: "신뢰 보통", filled: 2 };
  return { label: "신뢰 낮음", filled: 1 };
}

/** 벡터 유사도(검색 결과)용 — AI 답변 신뢰도와 문구를 섞지 않음 */
function similarityTierLabel(score: number): string {
  if (score >= 0.45) return "가까움";
  if (score >= 0.28) return "비슷함";
  return "느슨한 연관";
}
const SUMMARY_PREVIEW_MAX_LENGTH = 560;

type DashboardToast = {
  id: number;
  kind: "success" | "error";
  text: string;
};

type TagStat = {
  tag: string;
  count: number;
};

type ContentSortOrder = "desc" | "asc";
type SourceKind = "youtube" | "website" | "pdf" | "note";
type DashboardView = "library" | "explore";

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
  /* 망가진 프로토콜·괄호로 감싼 URL 잔재 */
  cleaned = cleaned.replace(/\b[a-z]{2,6}:\/{0,2}\(/gi, " ");
  cleaned = cleaned.replace(/https?:\/\/\S+/g, " ");
  cleaned = cleaned.replace(/\bwww\.[a-z0-9.-]+\.[a-z]{2,12}[^\s)']*/gi, " ");
  cleaned = cleaned.replace(/\([^)]*instagram[^)]*\)/gi, " ");
  cleaned = cleaned.replace(/[*_`>#-]+/g, " ");
  for (const pattern of UI_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(SNIPPET_JUNK_REPLACE, " ");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

function isLikelyJunkSnippet(raw: string) {
  const s = raw || "";
  if (/tp:\/\/|tps:\/\/|www\.fnnews\.com|fnsurvey|fn영상|신문보기|댓글\s*운영|국민\s*신문고|악의적인\s*게시물/i.test(s)) {
    return true;
  }
  const urlish = (s.match(/https?:\/\/|tp:\/\/|www\.\w+/gi) || []).length;
  if (urlish >= 2) return true;
  if (/욕설|비방|운영원칙/.test(s) && s.length < 360) return true;
  return false;
}

/** 벡터 청크가 본문이 아닌 약관/메뉴를 잡았을 때 요약으로 대체 */
function chooseSearchExcerpt(result: SearchResultItem) {
  const rawSnip = result.top_snippet || "";
  const rawSum = result.summary || "";
  const cleanedSnip = cleanSnippet(rawSnip);
  const cleanedSum = cleanSnippet(rawSum);
  if (isLikelyJunkSnippet(rawSnip) && cleanedSum.length >= 28) return cleanedSum;
  if (cleanedSnip.length < 28 && cleanedSum.length > cleanedSnip.length) return cleanedSum;
  return cleanedSnip || cleanedSum || "매칭된 발췌문이 없습니다.";
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
    return (
      <span className={`${base} bg-[var(--status-success-bg)] text-[var(--status-success-fg)]`}>완료</span>
    );
  }
  if (status === "processing") {
    return <span className={`${base} bg-blue-500/20 text-[var(--accent-strong)]`}>처리 중</span>;
  }
  if (status === "failed") {
    return <span className={`${base} bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]`}>실패</span>;
  }
  return <span className={`${base} bg-black/10 text-[var(--text-secondary)]`}>대기</span>;
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, initialized } = useAuth();
  const onboardParam = searchParams.get("onboard");
  const sourceParam = searchParams.get("source");
  const prefillParam = searchParams.get("prefill") ?? "";
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
  const [showAllAiSources, setShowAllAiSources] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [currentContentsPage, setCurrentContentsPage] = useState(1);
  const [toasts, setToasts] = useState<DashboardToast[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [contentSortOrder, setContentSortOrder] = useState<ContentSortOrder>("desc");
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [detailThumbFailed, setDetailThumbFailed] = useState(false);

  const initialSource = useMemo<SourceKind>(() => {
    if (
      sourceParam === "youtube" ||
      sourceParam === "website" ||
      sourceParam === "pdf" ||
      sourceParam === "note"
    ) {
      return sourceParam;
    }
    return "website";
  }, [sourceParam]);

  const dashboardView = useMemo((): DashboardView => {
    return searchParams.get("view") === "explore" ? "explore" : "library";
  }, [searchParams]);

  const setDashboardView = useCallback(
    (next: DashboardView) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "library") {
        params.delete("view");
      } else {
        params.set("view", "explore");
      }
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
      window.requestAnimationFrame(() => {
        document.getElementById("dashboard-tablist")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [router, searchParams],
  );

  const ONBOARDING_DISMISS_KEY = "smartcurator_dashboard_quick_guide_dismissed_v1";
  const hasLoadedOnceRef = useRef(false);
  const prevStatusByIdRef = useRef<Map<number, ContentItem["status"]>>(new Map());
  const requestInFlightRef = useRef(false);

  const sortedContents = useMemo(() => {
    return [...contents].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      return contentSortOrder === "desc" ? bTime - aTime : aTime - bTime;
    });
  }, [contents, contentSortOrder]);

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
            pushToast("success", "콘텐츠 처리가 완료되었습니다.");
          }
          if (becameFailed) {
            pushToast("error", "콘텐츠 처리에 실패했습니다.");
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
    setDetailThumbFailed(false);
  }, [selectedContent]);

  useEffect(() => {
    setShowAllAiSources(false);
  }, [chatAnswer]);

  const handleSemanticSearch = async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    if (!token || !q) return;
    if (queryOverride !== undefined) setSearchQuery(queryOverride);
    setSearchLoading(true);
    setSearchMessage(null);
    try {
      const scoreThresholdByMode: Record<"strict" | "balanced" | "broad", number> = {
        strict: 0.2,
        balanced: 0.12,
        broad: 0.07,
      };
      const response = await api.semanticSearch(q, token, {
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

  const handleDeleteContent = async () => {
    if (!token || !deleteTarget) return;
    setDeletePending(true);
    try {
      await api.deleteContent(deleteTarget.id, token);
      setContents((prev) => prev.filter((content) => content.id !== deleteTarget.id));
      setSelectedContent((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      pushToast("success", `${displayTitle(deleteTarget.title, deleteTarget.id)} 콘텐츠를 삭제했습니다.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletePending(false);
    }
  };

  if (!initialized) {
    return <p className="text-sm text-[var(--text-secondary)]">초기화 중입니다...</p>;
  }

  if (!token) {
    return (
      <div className="surface-card mx-auto max-w-md space-y-4 rounded-3xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          내 자료에서는 저장한 콘텐츠, 검색, AI 질문까지 한곳에서 쓸 수 있어요.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
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
        <section className="surface-card rounded-3xl p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">빠른 가이드</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">처음 쓰실 때</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                위쪽 <strong className="font-semibold text-[var(--text-primary)]">내 자료</strong>에서 넣고 정리한 뒤,{" "}
                <strong className="font-semibold text-[var(--text-primary)]">검색·AI</strong> 탭에서 찾거나 질문하면
                흐름이 끊기지 않아요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowQuickGuide(false);
                window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
              }}
              className="shrink-0 rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
            >
              가이드 닫기
            </button>
          </div>
        </section>
      )}

      <nav
        id="dashboard-tablist"
        className="surface-card rounded-3xl p-3 sm:p-4"
        aria-label="내 자료·검색·AI"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div role="tablist" aria-label="보기 전환" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              role="tab"
              id="dashboard-tab-library"
              aria-selected={dashboardView === "library"}
              aria-controls="dashboard-panel-library"
              tabIndex={dashboardView === "library" ? 0 : -1}
              onClick={() => setDashboardView("library")}
              className={`min-h-[44px] rounded-2xl border px-4 py-2.5 text-left text-sm font-semibold transition sm:min-w-[9.5rem] ${
                dashboardView === "library"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm shadow-[var(--accent)]/10"
                  : "border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              }`}
            >
              내 자료
            </button>
            <button
              type="button"
              role="tab"
              id="dashboard-tab-explore"
              aria-selected={dashboardView === "explore"}
              aria-controls="dashboard-panel-explore"
              tabIndex={dashboardView === "explore" ? 0 : -1}
              onClick={() => setDashboardView("explore")}
              className={`min-h-[44px] rounded-2xl border px-4 py-2.5 text-left text-sm font-semibold transition sm:min-w-[9.5rem] ${
                dashboardView === "explore"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm shadow-[var(--accent)]/10"
                  : "border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              }`}
            >
              검색·AI
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)] sm:max-w-md sm:text-right">
            {dashboardView === "library"
              ? "저장한 글의 상태·요약·태그를 보고, 새 링크나 파일을 넣습니다."
              : "키워드보다 뜻으로 찾거나, 저장해 둔 근거만 모아 AI에게 질문합니다."}
          </p>
        </div>
      </nav>

      <div
        id="dashboard-panel-library"
        role="tabpanel"
        aria-labelledby="dashboard-tab-library"
        hidden={dashboardView !== "library"}
        className="space-y-6"
      >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="surface-card space-y-3 rounded-3xl p-6 lg:sticky lg:top-28">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">내 콘텐츠</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                저장한 기사와 노트의 처리 상태, 요약, 태그를 확인합니다.
              </p>
              {activeTagFilter && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] text-[var(--accent-strong)]">
                    #{activeTagFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTagFilter(null);
                      setCurrentContentsPage(1);
                    }}
                    className="text-[11px] text-[var(--text-secondary)] underline-offset-2 hover:underline"
                  >
                    필터 해제
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                <span>정렬</span>
                <select
                  value={contentSortOrder}
                  onChange={(event) => {
                    setContentSortOrder(event.target.value as ContentSortOrder);
                    setCurrentContentsPage(1);
                  }}
                  className="bg-transparent text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="desc">최신순</option>
                  <option value="asc">오래된순</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => loadContents({ resetPage: true })}
                className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              >
                새로고침
              </button>
            </div>
          </div>
          {activeQueueCount > 0 && (
            <div className="rounded-2xl border border-[var(--queue-banner-border)] bg-[var(--queue-banner-bg)] p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <p className="font-medium text-[var(--queue-banner-title)]">처리 큐 진행 중</p>
                <p className="text-[13px] text-[var(--queue-banner-sub)]">
                  대기 {pendingCount}건 · 처리중 {processingCount}건
                </p>
              </div>
              <div className="indeterminate-track">
                <div className="indeterminate-bar" />
              </div>
            </div>
          )}
          {loading && <p className="text-xs text-[var(--text-muted)]">불러오는 중...</p>}
          {message && <p className="text-xs font-medium text-[var(--status-danger-fg)]">{message}</p>}
          <div className="mt-2 space-y-3">
            {filteredContents.length === 0 && !loading && (
              <p className="text-sm text-[var(--text-muted)]">
                {activeTagFilter
                  ? `#${activeTagFilter} 태그에 해당하는 콘텐츠가 없습니다.`
                  : "아직 저장한 콘텐츠가 없습니다. 오른쪽 입력 폼에서 먼저 추가해 보세요."}
              </p>
            )}
            {paginatedContents.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 shadow-sm shadow-[var(--accent)]/8 ring-1 ring-[var(--accent)]/5 transition hover:border-[var(--accent)] hover:shadow-md hover:shadow-[var(--accent)]/12"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedContent(item)}
                      className="text-left text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-strong)]"
                    >
                      {item.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      {item.is_public && (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--chip-public-bg)] text-[var(--chip-public-fg)] [border-color:var(--chip-public-border)]">
                          공개
                        </span>
                      )}
                      {item.content_type && (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--chip-type-bg)] text-[var(--chip-type-fg)] [border-color:var(--chip-type-border)]">
                          {item.content_type}
                        </span>
                      )}
                      {isYouTubeUrl(item.url) && (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--chip-youtube-bg)] text-[var(--chip-youtube-fg)] [border-color:var(--chip-youtube-border)]">
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
                      className="text-[11px] text-[var(--accent-strong)] underline-offset-2 hover:underline"
                    >
                      원문 보기
                    </a>
                  )}
                </div>
                {item.summary && (
                  <button
                    type="button"
                    onClick={() => setSelectedContent(item)}
                    className="mt-2 block w-full text-left text-sm leading-6 text-[var(--text-secondary)]"
                  >
                    <span className="block whitespace-pre-line">
                      {truncateText(item.summary, SUMMARY_PREVIEW_MAX_LENGTH)}
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--accent-strong)]">전체 보기</span>
                  </button>
                )}
                {item.status === "failed" && item.processing_error && (
                  <p className="mt-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-2 text-[11px] text-[var(--status-danger-fg)]">
                    실패 원인: {truncateText(item.processing_error, 180)}
                  </p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setActiveTagFilter((prev) => (prev === tag ? null : tag));
                          setCurrentContentsPage(1);
                        }}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition bg-[var(--tag-chip-bg)] text-[var(--tag-chip-fg)] [border-color:var(--tag-chip-border)] hover:brightness-110 ${
                          activeTagFilter === tag ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface-muted)]" : ""
                        }`}
                        title={`#${tag}만 목록에서 보기 (다시 누르면 해제)`}
                      >
                        #{tag}
                      </button>
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
                      className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)] [border-color:var(--btn-secondary-border)] hover:brightness-110"
                    >
                      {item.status === "failed" ? "다시 시도" : "재처리"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-[11px] font-semibold transition bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] [border-color:var(--status-danger-border)] hover:brightness-95"
                    >
                      삭제
                    </button>
                  </div>
                  <p className="shrink-0 text-[11px] text-[var(--text-muted)] sm:text-right">
                    {item.status === "completed" ? "처리 완료" : "최근 업데이트"}{" "}
                    {formatKoreanDateTime(item.updated_at || item.created_at)}
                  </p>
                </div>
              </article>
            ))}
          </div>
          {filteredContents.length > CONTENTS_PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-[var(--text-muted)]">
                {currentContentsPage} / {totalContentsPages} 페이지
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentContentsPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentContentsPage === 1}
                  className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentContentsPage((prev) => Math.min(totalContentsPages, prev + 1))
                  }
                  disabled={currentContentsPage >= totalContentsPages}
                  className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-[11px] text-[var(--text-secondary)] disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="surface-card w-full space-y-3 rounded-3xl p-6 lg:sticky lg:top-28">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">자료 추가</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              링크나 텍스트를 넣으면 요약과 태그가 자동으로 만들어집니다.
            </p>
          </div>
          <QuickAddForm
            token={token}
            initialSource={initialSource}
            initialPrefill={prefillParam}
            onCreated={() => void loadContents({ resetPage: true })}
          />
          <div className="surface-muted mt-4 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">자주 쓰는 태그</h3>
              <span className="text-[11px] text-[var(--text-muted)]">Top 15</span>
            </div>
            {tagStats.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--text-muted)]">태그가 있는 콘텐츠를 추가하면 여기 표시됩니다.</p>
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
                          ? "border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "border border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
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
      </div>

      <div
        id="dashboard-panel-explore"
        role="tabpanel"
        aria-labelledby="dashboard-tab-explore"
        hidden={dashboardView !== "explore"}
        className="space-y-6"
      >
      <div
        className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3"
        role="region"
        aria-label="검색·AI 사용 안내"
      >
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          왼쪽에서 찾고 싶은 내용을 검색한 뒤,{" "}
          <span className="font-medium text-[var(--text-primary)]">오른쪽 AI</span>에게 관련 자료를 바탕으로 질문할 수 있어요.
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="surface-card explore-panel-lift flex max-h-[min(88dvh,52rem)] min-h-0 flex-col gap-4 rounded-3xl p-6 lg:sticky lg:top-28">
          <div className="shrink-0 border-b border-[var(--border)] pb-3">
            <span className="inline-flex rounded-lg bg-[var(--tone-sky)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] shadow-sm shadow-black/15">
              찾기
            </span>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">의미론적 검색</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              키워드보다 뜻으로 찾습니다. 스팸 문구와 링크 잡음은 정리합니다.
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            <div
              className="explore-inset-well p-1"
              role="group"
              aria-label="검색 범위"
            >
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                {(
                  [
                    { id: "strict" as const, label: "딱 맞는 결과", hint: "정확도 우선" },
                    { id: "balanced" as const, label: "적당히 넓게", hint: "기본 추천" },
                    { id: "broad" as const, label: "관련까지", hint: "탐색 범위 확장" },
                  ] as const
                ).map((mode) => {
                  const selected = searchMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSearchMode(mode.id)}
                      title={mode.hint}
                      className={`relative rounded-lg px-3 py-2 text-center text-xs font-medium transition ${
                        selected
                          ? "border border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_2px_8px_-2px_rgba(37,99,235,0.45)]"
                          : "border border-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)]/40"
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="explore-inset-well flex flex-col gap-2 p-2 sm:flex-row sm:items-stretch">
              <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
                <svg
                  className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4" strokeLinecap="round" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !searchLoading) void handleSemanticSearch();
                  }}
                  placeholder="무엇을 찾을까요?"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  aria-label="의미 검색어"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSemanticSearch()}
                disabled={searchLoading}
                className="shrink-0 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.65),0_2px_0_0_rgba(0,0,0,0.2)] transition hover:brightness-110 disabled:opacity-50"
              >
                {searchLoading ? "검색 중…" : "검색"}
              </button>
            </div>

            {searchResults.length === 0 && !searchLoading && (
              <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/35 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-xs font-medium text-[var(--text-primary)]">예시로 한 번 찾아보기</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">버튼을 누르면 입력창에 넣고 바로 검색합니다.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXPLORE_SEARCH_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => void handleSemanticSearch(ex)}
                      className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchMessage && (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2 text-xs text-[var(--text-secondary)]">
                {searchMessage}
              </p>
            )}

            <div className="space-y-3">
              {searchResults.map((result, index) => {
                const text = chooseSearchExcerpt(result);
                const expanded = expandedSearchResults.has(result.content_id);
                const isLong = text.length > 220;
                return (
                  <article
                    key={result.content_id}
                    className="explore-result-card-3d relative rounded-2xl border border-[var(--border)] border-l-4 border-l-[var(--accent)] bg-[var(--surface-muted)] p-4"
                  >
                    <span
                      className="absolute -left-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-br-lg rounded-tl-xl bg-[var(--accent)] text-[10px] font-bold text-white shadow-md"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2 pl-5">
                      <h3 className="min-w-0 text-sm font-semibold leading-snug text-[var(--text-primary)]">
                        {displayTitle(result.title, result.content_id)}
                      </h3>
                      <span className="shrink-0 rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent-strong)] shadow-sm">
                        {similarityTierLabel(result.similarity_score)} · {result.similarity_score.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-2 pl-5 text-[11px] text-[var(--text-muted)]">
                      · {getMatchReason(searchQuery, result)}
                    </p>
                    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/55 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                        {expanded || !isLong ? text : truncateText(text, 220)}
                      </p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => toggleSearchResult(result.content_id)}
                          className="mt-1 text-[11px] font-medium text-[var(--accent-strong)] hover:underline"
                        >
                          {expanded ? "접기" : "더보기"}
                        </button>
                      )}
                    </div>
                    {result.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                        {result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--tag-chip-bg)] text-[var(--tag-chip-fg)] [border-color:var(--tag-chip-border)]"
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
          </div>
        </section>

        <section className="surface-card explore-panel-lift flex max-h-[min(88dvh,52rem)] min-h-0 flex-col gap-4 rounded-3xl p-6 lg:sticky lg:top-28">
          <div className="shrink-0 border-b border-[var(--border)] pb-3">
            <span className="inline-flex rounded-lg bg-[var(--tone-violet)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] shadow-sm shadow-black/15">
              질문
            </span>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">AI 어시스턴트</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              저장해 둔 자료의 근거 문단만 골라 답합니다. 왼쪽에서 먼저 관련 기사를 찾아도 좋아요.
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
            <div className="explore-inset-well space-y-3 p-4">
              <label className="block text-[11px] font-medium text-[var(--text-muted)]">질문 입력</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleAskAssistant();
                  }
                }}
                rows={4}
                placeholder="예: LG CNS가 어디에 투자했는지, 관련 기사 근거만 정리해줘"
                className="w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[inset_0_2px_6px_rgba(0,0,0,0.12)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="text-[10px] text-[var(--text-muted)]">Ctrl+Enter 로 바로 질문하기</p>
              <button
                type="button"
                onClick={() => void handleAskAssistant()}
                disabled={chatLoading}
                className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5),0_2px_0_0_rgba(0,0,0,0.18)] transition hover:brightness-110 disabled:opacity-50"
              >
                {chatLoading ? "답변 생성 중…" : "질문하기"}
              </button>
            </div>

            {chatMessage && (
              <p className="text-xs font-medium text-[var(--status-danger-fg)]">{chatMessage}</p>
            )}

            {chatAnswer && (
              <div className="explore-answer-card-3d space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">답변</p>
                  {(() => {
                    const cv = confidenceBarsFromScore(chatAnswer.confidence);
                    return (
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className="text-[11px] text-[var(--text-muted)]">{cv.label}</span>
                        <div className="flex gap-1" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className={`h-2 w-7 rounded-sm ${
                                i < cv.filled ? "bg-[var(--accent)] shadow-sm" : "bg-[var(--border-strong)] opacity-35"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-[var(--accent-strong)]">
                          {chatAnswer.confidence.toFixed(3)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                  {chatAnswer.answer}
                </p>
                {chatAnswer.sources.length > 0 && (
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      근거 출처{" "}
                      <span className="font-normal text-[var(--text-muted)]">({chatAnswer.sources.length})</span>
                    </p>
                    {chatAnswer.sources.map((source, index) => {
                      if (!showAllAiSources && index >= 2) return null;
                      const sourceKey = `${source.content_id}-${source.chunk_index}-${index}`;
                      const expanded = expandedSources.has(sourceKey);
                      const cleanedSnippet = cleanSnippet(source.snippet);
                      const isLong = cleanedSnippet.length > 220;
                      return (
                        <div
                          key={sourceKey}
                          className="explore-result-card-3d rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {displayTitle(source.title, source.content_id)}
                            </p>
                            <span className="text-[11px] text-[var(--text-muted)]">
                              청크 {source.chunk_index} · {source.similarity_score.toFixed(3)}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                            {expanded || !isLong ? cleanedSnippet : truncateText(cleanedSnippet, 220)}
                          </p>
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => toggleSource(sourceKey)}
                              className="mt-1 text-[11px] font-medium text-[var(--accent-strong)] hover:underline"
                            >
                              {expanded ? "접기" : "더보기"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {chatAnswer.sources.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAiSources((v) => !v)}
                        className="text-[11px] font-medium text-[var(--accent-strong)] hover:underline"
                      >
                        {showAllAiSources
                          ? "출처 접기"
                          : `출처 ${chatAnswer.sources.length - 2}개 더 보기`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      </div>

      {selectedContent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setSelectedContent(null)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full">
                <label className="block text-xs text-[var(--text-secondary)]">제목</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveTitle()}
                    disabled={savingTitle}
                    className="whitespace-nowrap rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-strong)] disabled:opacity-50"
                  >
                    {savingTitle ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedContent(null)}
                    className="whitespace-nowrap rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)]"
                  >
                    닫기
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  생성 {new Date(selectedContent.created_at).toLocaleString()}
                </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedContent.status} />
              {selectedContent.is_public && (
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--chip-public-bg)] text-[var(--chip-public-fg)] [border-color:var(--chip-public-border)]">
                  공개
                </span>
              )}
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--chip-type-bg)] text-[var(--chip-type-fg)] [border-color:var(--chip-type-border)]">
                {selectedContent.content_type}
              </span>
              {isYouTubeUrl(selectedContent.url) && (
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--chip-youtube-bg)] text-[var(--chip-youtube-fg)] [border-color:var(--chip-youtube-border)]">
                  youtube
                </span>
              )}
            </div>

            {selectedContent.thumbnail_url?.trim() && !detailThumbFailed && (
              <div className="mt-4 flex min-h-0 justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]">
                {/* object-contain: 잘리지 않고 전체 표시(여백은 카드 배경). cover는 영역 채우기 위해 상하/좌우를 자름 */}
                <img
                  src={selectedContent.thumbnail_url.trim()}
                  alt={`${displayTitle(selectedContent.title, selectedContent.id)} 대표 이미지`}
                  className="max-h-80 w-full object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setDetailThumbFailed(true)}
                />
              </div>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">요약 전체</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
                {selectedContent.summary || "요약이 아직 생성되지 않았습니다."}
              </p>
            </div>

            {selectedContent.status === "failed" && selectedContent.processing_error && (
              <div className="mt-3 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3">
                <p className="text-xs font-semibold text-[var(--status-danger-fg)]">실패 원인</p>
                <p className="mt-1 text-xs text-[var(--status-danger-fg)]">{selectedContent.processing_error}</p>
              </div>
            )}

            {selectedContent.tags && selectedContent.tags.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">태그</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedContent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[var(--tag-chip-bg)] text-[var(--tag-chip-fg)] [border-color:var(--tag-chip-border)]"
                    >
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
                className="mt-5 inline-block text-xs text-[var(--accent-strong)] underline-offset-2 hover:underline"
              >
                원문 보기
              </a>
            )}
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="콘텐츠를 삭제할까요?"
        description={
          deleteTarget
            ? `${displayTitle(deleteTarget.title, deleteTarget.id)} 항목을 삭제하면 되돌릴 수 없습니다.`
            : ""
        }
        confirmLabel="삭제"
        tone="danger"
        busy={deletePending}
        onCancel={() => {
          if (!deletePending) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteContent}
      />

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed right-4 top-24 z-[70] w-auto max-w-[min(280px,calc(100vw-1.5rem))]">
          <div className="space-y-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`rounded-xl border px-3.5 py-2.5 text-sm leading-5 shadow-card backdrop-blur-md ${
                  toast.kind === "success"
                    ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]"
                    : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]"
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
    <Suspense fallback={<p className="text-sm text-[var(--text-secondary)]">내 자료 화면을 불러오는 중이에요...</p>}>
      <DashboardPageContent />
    </Suspense>
  );
}


