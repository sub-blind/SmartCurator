"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";
import type { SearchResultItem } from "@/types/content";
import { Section } from "./ui/section";

const DEFAULT_QUERY = "AI 에이전트 도입 전 주의사항";

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
      <Section id="experience" title="조금만요" description="화면을 불러오는 중이에요.">
        <p className="text-sm text-[var(--text-secondary)]">로딩 중...</p>
      </Section>
    );
  }

  if (token) {
    return (
      <Section
        id="quick-guide"
        title="내 자료는 이렇게 쓰면 돼요"
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
              detail: "검색할 때 딱 맞는 단어가 안 떠올라도 비슷한 뜻의 글을 찾습니다.",
            },
            {
              step: "3",
              title: "물어보기",
              detail: "질문하면 답과 함께 어떤 문장을 근거로 봤는지도 보여줍니다.",
            },
          ].map((item) => (
            <article key={item.step} className="surface-muted rounded-2xl p-4">
              <p className="text-xs text-[var(--accent-strong)]">{item.step}단계</p>
              <h3 className="mt-1 text-base font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            내 자료 열기
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
        <div className="surface-muted space-y-3 rounded-2xl p-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 기업 AI 도입 실패 원인"
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGuestSearch}
              disabled={searchDisabled}
              className="min-w-[110px] whitespace-nowrap rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold leading-none text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "검색 중..." : "샘플 검색"}
            </button>
          </div>
          {error && <p className="text-xs text-[var(--text-secondary)]">{error}</p>}
          <div className="space-y-3">
            {results.length === 0 && !error && (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">검색 전 가이드</p>
                <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                  위에 단어를 넣고 샘플 검색을 누르면 비슷한 뜻의 글 제목이랑 짧은 발췌가 나옵니다.
                </p>
              </div>
            )}
            {results.map((result) => (
              <article key={result.content_id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {result.title || `콘텐츠 #${result.content_id}`}
                  </h3>
                  <span className="shrink-0 text-[11px] text-[var(--accent-strong)]">
                    {result.similarity_score.toFixed(3)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  {truncateText(result.top_snippet || result.summary, 180)}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="surface-muted flex min-h-[250px] flex-col justify-center space-y-4 rounded-2xl p-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">로그인하면</h3>
          <ul className="space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
            <li>내 링크, 메모, 파일을 모아두고 요약 받기</li>
            <li>태그와 의미 검색으로 다시 찾기</li>
            <li>질문과 함께 근거 문장까지 보기</li>
          </ul>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--accent)]"
            >
              로그인
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
