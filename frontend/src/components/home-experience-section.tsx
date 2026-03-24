"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";
import type { SearchResultItem } from "@/types/content";
import { Section } from "./ui/section";

const DEFAULT_QUERY = "AI 에이전트 도입 시 주의할 점";

function truncateText(text: string, maxLength: number) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function HomeExperienceSection() {
  const { token, initialized } = useAuth();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);

  const searchDisabled = useMemo(() => loading || !query.trim(), [loading, query]);

  const handleGuestSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.publicSemanticSearch(query.trim(), {
        limit: 4,
        score_threshold: 0.1,
      });
      setResults(response.results);
      if (response.results.length === 0) {
        setError("일치하는 공개 콘텐츠가 없어요. 다른 키워드로 시도해 보세요.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "공개 검색 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) {
    return (
      <Section
        id="experience"
        title="기능 중심으로 바로 시작"
        description="환경을 확인하고 있어요."
      >
        <p className="text-sm text-slate-300">로딩 중...</p>
      </Section>
    );
  }

  if (token) {
    return (
      <Section
        id="quick-guide"
        title="빠른 사용 가이드"
        description="로그인한 상태에서는 아래 3단계만 따라오면 바로 활용할 수 있어요."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "콘텐츠 추가",
              detail: "URL, 메모, PDF를 넣어 내 지식 베이스를 만듭니다.",
            },
            {
              step: "2",
              title: "의미 검색",
              detail: "키워드가 달라도 맥락이 맞는 내용을 찾아냅니다.",
            },
            {
              step: "3",
              title: "AI에게 질문",
              detail: "근거 스니펫과 함께 답을 받아 빠르게 정리합니다.",
            },
          ].map((item) => (
            <article key={item.step} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs text-blue-300">Step {item.step}</p>
              <h3 className="mt-1 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            대시보드로 이동
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section
      id="try-without-signup"
      title="회원가입 없이 먼저 써보기"
      description="공개 샘플 데이터 검색으로 SmartCurator의 핵심 경험을 바로 확인해 보세요."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 기업 AI 도입의 실패 원인"
              className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGuestSearch}
              disabled={searchDisabled}
              className="min-w-[110px] whitespace-nowrap rounded-xl bg-brand px-4 py-2 text-sm font-semibold leading-none text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "검색 중" : "샘플 검색"}
            </button>
          </div>
          {error && <p className="text-xs text-slate-300">{error}</p>}
          <div className="space-y-3">
            {results.map((result) => (
              <article key={result.content_id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{result.title || `콘텐츠 #${result.content_id}`}</h3>
                  <span className="shrink-0 text-[11px] text-blue-200">{result.similarity_score.toFixed(3)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-300">{truncateText(result.top_snippet || result.summary, 180)}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <h3 className="text-base font-semibold text-white">로그인하면 바로 확장됩니다</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>내 링크/문서 업로드 후 자동 요약</li>
            <li>내 데이터만 대상으로 의미 검색</li>
            <li>근거 포함 AI 질의응답</li>
          </ul>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-100 hover:border-brand"
            >
              로그인
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
