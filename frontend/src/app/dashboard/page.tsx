"use client";

import { useEffect, useState } from "react";
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

function truncateText(text: string, maxLength: number) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function cleanSnippet(text: string) {
  let cleaned = (text || "").replace(/\s+/g, " ").trim();
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
  if (!normalized) return `肄섑뀗痢?#${contentId}`;
  if (/^?댁뒪\s*\d+$/i.test(normalized)) return `???肄섑뀗痢?#${contentId}`;
  return normalized;
}

function getMatchReason(query: string, result: SearchResultItem) {
  const terms = (query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return "?섎? ?좎궗??湲곕컲 留ㅼ묶";

  const haystack = `${result.title} ${result.summary} ${result.top_snippet} ${(result.tags || []).join(" ")}`.toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term));
  if (matched.length === 0) return "?섎? ?좎궗??湲곕컲 留ㅼ묶";
  return `留ㅼ묶 洹쇨굅: ${matched.slice(0, 3).join(", ")}`;
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

export default function DashboardPage() {
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
  const [expandedSearchResults, setExpandedSearchResults] = useState<Set<number>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showQuickGuide, setShowQuickGuide] = useState(false);

  const ONBOARDING_DISMISS_KEY = "smartcurator_dashboard_quick_guide_dismissed_v1";

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

  const loadContents = async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getMyContents(token);
      setContents(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "肄섑뀗痢좊? 遺덈윭?ㅼ? 紐삵뻽?듬땲??");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized && token) {
      void loadContents();
    }
  }, [initialized, token]);

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
        setSearchMessage("寃??寃곌낵媛 ?놁뒿?덈떎. ??援ъ껜?곸씤 ?ㅼ썙?쒕줈 ?ㅼ떆 寃?됲빐蹂댁꽭??");
      }
    } catch (err) {
      setSearchMessage(err instanceof Error ? err.message : "寃?됱뿉 ?ㅽ뙣?덉뒿?덈떎.");
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
      setChatMessage(err instanceof Error ? err.message : "?듬? ?앹꽦???ㅽ뙣?덉뒿?덈떎.");
    } finally {
      setChatLoading(false);
    }
  };

  if (!initialized) {
    return <p className="text-sm text-slate-300">珥덇린??以묒엯?덈떎...</p>;
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-card">
        <h1 className="text-2xl font-semibold text-white">濡쒓렇?몄씠 ?꾩슂?⑸땲??</h1>
        <p className="mt-2 text-sm text-slate-300">
          ??쒕낫?쒖뿉?쒕뒗 ??ν븳 肄섑뀗痢? 寃?? AI ?댁떆?ㅽ듃 湲곕뒫???뺤씤?????덉뒿?덈떎.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            濡쒓렇??          </Link>
          <Link
            href="/register"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 hover:border-brand"
          >
            ?뚯썝媛??          </Link>
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
              <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Quick Guide</p>
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
        <section className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">??肄섑뀗痢?</h1>
              <p className="text-xs text-slate-300">
                ??ν븳 湲곗궗? ?명듃??泥섎━ ?곹깭, ?붿빟, ?쒓렇瑜??뺤씤?⑸땲??
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadContents()}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:border-brand"
            >
              ?덈줈怨좎묠
            </button>
          </div>
          {loading && <p className="text-xs text-slate-400">遺덈윭?ㅻ뒗 以?..</p>}
          {message && <p className="text-xs text-red-300">{message}</p>}
          <div className="mt-2 space-y-3">
            {contents.length === 0 && !loading && (
              <p className="text-sm text-slate-400">
                ?꾩쭅 ??ν븳 肄섑뀗痢좉? ?놁뒿?덈떎. ?ㅻⅨ履??낅젰 ?쇱뿉??癒쇱? 異붽??대낫?몄슂.
              </p>
            )}
            {contents.map((item) => (
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
                          怨듦컻
                        </span>
                      )}
                      {item.content_type && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                          {item.content_type}
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
                      ?먮Ц 蹂닿린
                    </a>
                  )}
                </div>
                {item.summary && (
                  <button
                    type="button"
                    onClick={() => setSelectedContent(item)}
                    className="mt-2 block w-full text-left text-xs text-slate-200"
                  >
                    {truncateText(item.summary, 260)}
                    <span className="ml-1 text-[11px] text-blue-300">?꾩껜 蹂닿린</span>
                  </button>
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
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="flex gap-2">
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
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-slate-100 hover:border-blue-400"
                    >
                      재처리
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
                      className="rounded-full border border-red-500/40 px-3 py-1 text-[11px] text-red-200 hover:bg-red-500/10"
                    >
                      삭제
                    </button>
                  </div>
                  <p className="shrink-0 text-[11px] text-slate-400">
                    {item.status === "completed" ? "처리 완료" : "최근 업데이트"}{" "}
                    {formatKoreanDateTime(item.updated_at || item.created_at)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">肄섑뀗痢?異붽?</h2>
            <p className="text-xs text-slate-300">
              湲곗궗 URL?대굹 ?띿뒪?몃? ?ｌ쑝硫?諛깆뿏?쒓? ?붿빟, ?쒓렇, 踰≫꽣瑜??앹꽦?⑸땲??
            </p>
          </div>
          <QuickAddForm token={token} onCreated={loadContents} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">?섎?濡좎쟻 寃??</h2>
            <p className="text-xs text-slate-300">
              ??ν븳 肄섑뀗痢좊? ?ㅼ썙?쒓? ?꾨땲???섎? 湲곗??쇰줈 寃?됲빀?덈떎. 寃곌낵??吏㏃? ?듭떖 snippet留?蹂댁뿬以띾땲??
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "strict", label: "?뺥솗", hint: "?≪쓬 理쒖냼" },
              { id: "balanced", label: "洹좏삎", hint: "湲곕낯" },
              { id: "broad", label: "?볤쾶", hint: "?뺤옣" },
            ].map((mode) => {
              const selected = searchMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSearchMode(mode.id as "strict" | "balanced" | "broad")}
                  title={mode.hint}
                  className={`rounded-full px-3 py-1 text-xs transition ${
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
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {searchLoading ? "검색 중.." : "검색"}
            </button>
          </div>
          {searchMessage && <p className="text-xs text-slate-300">{searchMessage}</p>}
          <div className="space-y-3">
            {searchResults.map((result) => {
              const text = cleanSnippet(result.top_snippet || result.summary || "留ㅼ묶??snippet???놁뒿?덈떎.");
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
                      score {result.similarity_score.toFixed(3)}
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
            <h2 className="text-lg font-semibold text-white">AI ?댁떆?ㅽ듃</h2>
            <p className="text-xs text-slate-300">
              ??ν븳 湲곗궗? ?명듃??洹쇨굅 chunk瑜?諛뷀깢?쇰줈 吏덈Ц???듯빀?덈떎.
            </p>
          </div>
          <div className="space-y-3">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="?? LG CNS媛 ?대뵒???ъ옄?덉뼱?, ?숈쓽 ??湲곗궗 ?듭떖留??뺣━?댁쨾"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAskAssistant}
              disabled={chatLoading}
              className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {chatLoading ? "?듬? ?앹꽦 以?.." : "吏덈Ц?섍린"}
            </button>
          </div>
          {chatMessage && <p className="text-xs text-red-300">{chatMessage}</p>}
          {chatAnswer && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">?듬?</p>
                <span className="text-[11px] text-blue-200">
                  confidence {chatAnswer.confidence.toFixed(3)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{chatAnswer.answer}</p>
              {chatAnswer.sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">洹쇨굅 異쒖쿂</p>
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
                            chunk {source.chunk_index} 쨌 {source.similarity_score.toFixed(3)}
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedContent.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  ?앹꽦 {new Date(selectedContent.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContent(null)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:border-brand"
              >
                ?リ린
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedContent.status} />
              {selectedContent.is_public && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-100">怨듦컻</span>
              )}
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                {selectedContent.content_type}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-300">?붿빟 ?꾩껜</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                {selectedContent.summary || "?붿빟???꾩쭅 ?앹꽦?섏? ?딆븯?듬땲??"}
              </p>
            </div>

            {selectedContent.tags && selectedContent.tags.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-300">?쒓렇</p>
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
                ?먮Ц 蹂닿린
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


