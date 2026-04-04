"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { api } from "@/lib/api";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const { token, userEmail, initialized, logout, isExpiringSoon, secondsUntilExpiry } = useAuth();
  const remainMinutes =
    secondsUntilExpiry && secondsUntilExpiry > 0 ? Math.ceil(secondsUntilExpiry / 60) : 0;

  const handleLogout = async () => {
    setLogoutPending(true);
    try {
      if (token) {
        await api.logout(token);
      }
    } catch {
      // 서버 응답이 실패해도 로컬 세션은 정리합니다.
    } finally {
      logout();
      setLogoutPending(false);
      setLogoutDialogOpen(false);
      router.push("/");
    }
  };

  const desktopNav = (
    <nav className="hidden items-center gap-5 text-sm text-[var(--text-secondary)] sm:flex">
      <Link href="/" className="whitespace-nowrap rounded-full px-2 py-1 transition hover:text-[var(--text-primary)]">
        소개
      </Link>
      <Link
        href="/dashboard"
        className="whitespace-nowrap rounded-full px-2 py-1 transition hover:text-[var(--text-primary)]"
      >
        내 자료
      </Link>
      <Link
        href="/project-notes"
        className="whitespace-nowrap rounded-full px-2 py-1 transition hover:text-[var(--text-primary)]"
      >
        프로젝트 노트
      </Link>
    </nav>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 border-b soft-divider bg-[color:var(--surface-muted)] backdrop-blur-lg">
        {initialized && token && isExpiringSoon && (
          <div className="border-b border-amber-300/30 bg-amber-400/10">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-amber-100 sm:px-10">
              <p>세션이 약 {remainMinutes}분 뒤 만료됩니다. 계속 작업하려면 다시 로그인해 주세요.</p>
              <Link
                href={`/login?reauth=1&next=${encodeURIComponent(pathname || "/dashboard")}`}
                className="shrink-0 whitespace-nowrap rounded-full border border-amber-200/40 px-3 py-1 text-[11px] font-medium hover:bg-amber-300/10"
              >
                세션 연장
              </Link>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-10">
          {/* 모바일: 로고·테마·계정 + 바로 노출 링크(소개·내 자료). 프로젝트 노트는 제외 */}
          <div className="flex flex-col gap-2 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/"
                className="min-w-0 truncate text-lg font-semibold tracking-tight text-[var(--text-primary)]"
              >
                SmartCurator
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                {initialized && token ? (
                  <button
                    type="button"
                    onClick={() => setLogoutDialogOpen(true)}
                    className="whitespace-nowrap rounded-full border border-red-500/30 px-2.5 py-1 text-[11px] text-red-200 transition hover:bg-red-500/10"
                  >
                    로그아웃
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="whitespace-nowrap rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                    >
                      로그인
                    </Link>
                    <Link
                      href="/register"
                      className="whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-medium text-white shadow-lg shadow-blue-500/20 transition hover:opacity-90"
                    >
                      가입
                    </Link>
                  </>
                )}
              </div>
            </div>
            {initialized && token && userEmail && (
              <p className="truncate text-[11px] text-[var(--text-muted)]">{userEmail}</p>
            )}
            <nav
              aria-label="주요 메뉴"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t soft-divider pt-2 text-sm font-medium text-[var(--text-secondary)]"
            >
              <Link
                href="/"
                className={`rounded-full px-2 py-1 transition hover:text-[var(--text-primary)] ${
                  pathname === "/" ? "text-[var(--accent-strong)]" : ""
                }`}
              >
                소개
              </Link>
              <Link
                href="/dashboard"
                className={`rounded-full px-2 py-1 transition hover:text-[var(--text-primary)] ${
                  pathname === "/dashboard" ? "text-[var(--accent-strong)]" : ""
                }`}
              >
                내 자료
              </Link>
            </nav>
          </div>

          {/* 데스크톱: 기존 3열 + 프로젝트 노트 */}
          <div className="hidden grid-cols-[auto_1fr_auto] items-center gap-3 sm:grid">
            <Link
              href="/"
              className="shrink-0 text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
            >
              SmartCurator
            </Link>

            <div className="flex justify-center">{desktopNav}</div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {initialized && token ? (
                <>
                  <span className="hidden max-w-[220px] truncate rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--text-primary)] lg:inline">
                    {userEmail ?? "로그인됨"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogoutDialogOpen(true)}
                    className="whitespace-nowrap rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-200 transition hover:bg-red-500/10"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="whitespace-nowrap rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 transition hover:opacity-90"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConfirmationDialog
        open={logoutDialogOpen}
        title="로그아웃할까요?"
        description="현재 기기에서 저장된 세션을 정리하고 홈 화면으로 이동합니다."
        confirmLabel="로그아웃"
        tone="danger"
        busy={logoutPending}
        onCancel={() => {
          if (!logoutPending) setLogoutDialogOpen(false);
        }}
        onConfirm={handleLogout}
      />
    </>
  );
}
