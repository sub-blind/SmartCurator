"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import type { ChatAnswer, ContentItem, SearchResultItem } from "@/types/content";
import { QuickAddForm } from "@/components/forms/quick-add-form";

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
  const { token, initialized } = useAuth();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [chatAnswer, setChatAnswer] = useState<ChatAnswer | null>(null);

  const loadContents = async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getMyContents(token);
      setContents(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "컨텐츠를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized && token) {
      void loadContents();
    }
  }, [initialized, token]);

  if (!initialized) {
    return <p className="text-sm text-slate-300">초기화 중입니다...</p>;
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-card">
        <h1 className="text-2xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-300">
          대시보드에서 내 컨텐츠를 관리하려면 먼저 로그인해 주세요.
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

  const hasContents = contents.length > 0;

  const handleSemanticSearch = async () => {
    if (!token || !searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchMessage(null);
    try {
      const response = await api.semanticSearch(searchQuery.trim(), token);
      setSearchResults(response.results);
      if (response.results.length === 0) {
        setSearchMessage("검색 결과가 없습니다. 다른 표현으로 다시 검색해보세요.");
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">내 컨텐츠</h1>
              <p className="text-xs text-slate-300">
                저장된 기사·노트들이 요약/태깅된 결과를 한눈에 확인할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadContents()}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:border-brand"
            >
              새로고침
            </button>
          </div>
          {loading && <p className="text-xs text-slate-400">불러오는 중...</p>}
          {message && <p className="text-xs text-red-300">{message}</p>}
          <div className="mt-2 space-y-3">
            {!hasContents && !loading && (
              <p className="text-sm text-slate-400">
                아직 저장된 컨텐츠가 없습니다. 오른쪽에서 첫 컨텐츠를 추가해 보세요.
              </p>
            )}
            {contents.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 hover:border-brand/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{item.title}</h2>
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
                  <p className="mt-2 line-clamp-3 text-xs text-slate-200">
                    {item.summary.length > 260 ? `${item.summary.slice(0, 260)}…` : item.summary}
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
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.reprocessContent(item.id, token);
                        setMessage("재처리 요청을 보냈습니다.");
                      } catch (err) {
                        setMessage(
                          err instanceof Error ? err.message : "재처리 요청에 실패했습니다.",
                        );
                      }
                    }}
                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-slate-100 hover:border-blue-400"
                  >
                    요약 재처리
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = window.confirm("정말 이 컨텐츠를 삭제하시겠습니까?");
                      if (!ok) return;
                      try {
                        await api.deleteContent(item.id, token);
                        setContents((prev) => prev.filter((c) => c.id !== item.id));
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
                      }
                    }}
                    className="rounded-full border border-red-500/40 px-3 py-1 text-[11px] text-red-200 hover:bg-red-500/10"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">새 컨텐츠 추가</h2>
            <p className="text-xs text-slate-300">
              기사 URL이나 노트를 붙여넣으면 백엔드가 자동으로 요약과 태그를 생성합니다.
            </p>
          </div>
          <QuickAddForm token={token} onCreated={loadContents} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">의미론적 검색</h2>
            <p className="text-xs text-slate-300">
              저장한 컨텐츠를 키워드가 아니라 의미 기준으로 검색합니다. 결과에는 매칭된 핵심 chunk 근거가 함께 표시됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="예: LLM 에이전트 아키텍처"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSemanticSearch}
              disabled={searchLoading}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {searchLoading ? "검색 중..." : "검색"}
            </button>
          </div>
          {searchMessage && <p className="text-xs text-slate-300">{searchMessage}</p>}
          <div className="space-y-3">
            {searchResults.map((result) => (
              <article key={result.content_id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{result.title}</h3>
                  <span className="text-[11px] text-blue-200">
                    score {result.similarity_score.toFixed(3)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  {result.top_snippet || result.summary || "매칭된 snippet이 없습니다."}
                </p>
                {result.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-card">
          <div>
            <h2 className="text-lg font-semibold text-white">AI 어시스트</h2>
            <p className="text-xs text-slate-300">
              저장된 기사와 노트의 chunk 근거를 바탕으로 질문에 답합니다.
            </p>
          </div>
          <div className="space-y-3">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="예: 내가 저장한 기사들 기준으로 RAG 구조를 설명해줘"
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
                  confidence {chatAnswer.confidence.toFixed(3)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{chatAnswer.answer}</p>
              {chatAnswer.sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">근거 출처</p>
                  {chatAnswer.sources.map((source, index) => (
                    <div key={`${source.content_id}-${source.chunk_index}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-white">{source.title}</p>
                        <span className="text-[11px] text-slate-400">
                          chunk {source.chunk_index} · {source.similarity_score.toFixed(3)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{source.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

