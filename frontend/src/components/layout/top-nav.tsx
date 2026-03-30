"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { token, userEmail, initialized, logout, isExpiringSoon, secondsUntilExpiry } = useAuth();
  const remainMinutes =
    secondsUntilExpiry && secondsUntilExpiry > 0 ? Math.ceil(secondsUntilExpiry / 60) : 0;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    try {
      if (token) {
        await api.logout(token);
      }
    } catch {
      // 서버 통신이 실패해도 로컬 로그아웃은 진행한다.
    } finally {
      logout();
      router.push("/");
    }
  };

  const desktopNav = (
    <nav className="hidden items-center gap-6 text-base text-slate-200 sm:flex">
      <Link href="/" className="whitespace-nowrap rounded-full px-2 py-1 transition hover:text-white">
        소개
      </Link>
      <Link href="/dashboard" className="whitespace-nowrap rounded-full px-2 py-1 transition hover:text-white">
        대시보드
      </Link>
      <Link href="/project-notes" className="whitespace-nowrap rounded-full px-2 py-1 transition hover:text-white">
        프로젝트 노트
      </Link>
    </nav>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-lg">
      {initialized && token && isExpiringSoon && (
        <div className="border-b border-amber-300/30 bg-amber-400/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-amber-100 sm:px-10">
            <p>
              세션이 약 {remainMinutes}분 후 만료됩니다. 작업을 계속하려면 다시 로그인해 주세요.
            </p>
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
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link href="/" className="shrink-0 whitespace-nowrap text-2xl font-semibold tracking-tight text-white">
            SmartCurator
          </Link>

          <div className="flex justify-center">{desktopNav}</div>

          <div className="hidden items-center gap-2 sm:flex">
            {initialized && token ? (
              <>
                <span className="hidden text-sm text-slate-200 lg:inline">{userEmail ?? "로그인됨"}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 transition hover:border-red-400 hover:text-red-200"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand hover:text-white"
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>

          <div className="flex justify-end sm:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200"
              aria-expanded={mobileMenuOpen}
              aria-label="모바일 메뉴 열기"
            >
              메뉴
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/90 p-3 sm:hidden">
            <div className="flex flex-col gap-2 text-sm text-slate-200">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="whitespace-nowrap rounded-xl px-3 py-2 transition hover:bg-white/5 hover:text-white"
              >
                소개
              </Link>
              <Link
                href="/dashboard"
                onClick={closeMobileMenu}
                className="whitespace-nowrap rounded-xl px-3 py-2 transition hover:bg-white/5 hover:text-white"
              >
                대시보드
              </Link>
              <Link
                href="/project-notes"
                onClick={closeMobileMenu}
                className="whitespace-nowrap rounded-xl px-3 py-2 transition hover:bg-white/5 hover:text-white"
              >
                프로젝트 노트
              </Link>

              <div className="mt-1 border-t border-white/10 pt-2">
                {initialized && token ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-300">{userEmail ?? "로그인됨"}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleLogout();
                        closeMobileMenu();
                      }}
                      className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      onClick={closeMobileMenu}
                      className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200"
                    >
                      로그인
                    </Link>
                    <Link
                      href="/register"
                      onClick={closeMobileMenu}
                      className="whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white"
                    >
                      회원가입
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
