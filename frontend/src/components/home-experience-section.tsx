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
        title="잠깐만요"
        description="화면 불러오는 중이에요."
      >
        <p className="text-sm text-slate-300">로딩 중...</p>
      </Section>
    );
  }

  if (token) {
    return (
      <Section
        id="quick-guide"
        title="대시보드에서 이렇게 쓰면 돼요"
        description="순서는 대충 이 세 가지예요."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "넣기",
              detail: "URL이나 메모, PDF를 올리면 요약이랑 태그가 붙습니다.",
            },
            {
              step: "2",
              title: "찾기",
              detail: "검색할 때 쓴 말이 저장할 때랑 달라도, 비슷한 글을 끌어옵니다.",
            },
            {
              step: "3",
              title: "물어보기",
              detail: "질문하면 답과 함께 어떤 문장을 근거로 썼는지 짧게 보여줍니다.",
            },
          ].map((item) => (
            <article key={item.step} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs text-blue-300">{item.step}단계</p>
              <h3 className="mt-1 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{item.detail}</p>
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
      title="가입 없이 먼저 써보기"
      description="공개 샘플만 검색해 볼 수 있어요."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
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
            {results.length === 0 && !error && (
              <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-4">
                <p className="text-sm font-medium text-slate-100">검색 전 가이드</p>
                <p className="mt-1 text-xs leading-6 text-slate-200">
                  위에 단어 넣고 샘플 검색을 누르면, 비슷한 글 제목이랑 짧은 발췌가 나옵니다.
                </p>
              </div>
            )}
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

        <div className="flex min-h-[250px] flex-col justify-center space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <h3 className="text-base font-semibold text-white">로그인하면</h3>
          <ul className="space-y-2 text-sm leading-6 text-slate-200">
            <li>내 링크·파일 올리고 요약 받기</li>
            <li>내가 넣은 글만 검색 대상으로</li>
            <li>질문할 때 근거 문장까지 같이 보기</li>
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
