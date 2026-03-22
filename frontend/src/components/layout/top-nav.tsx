"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, userEmail, initialized, logout, isExpiringSoon, secondsUntilExpiry } = useAuth();
  const remainMinutes =
    secondsUntilExpiry && secondsUntilExpiry > 0 ? Math.ceil(secondsUntilExpiry / 60) : 0;

  const handleLogout = async () => {
    try {
      if (token) {
        await api.logout(token);
      }
    } catch {
      // 서버 통신 실패 시에도 로컬 로그아웃은 진행
    } finally {
      logout();
      router.push("/");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-lg">
      {initialized && token && isExpiringSoon && (
        <div className="border-b border-amber-300/30 bg-amber-400/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2 text-xs text-amber-100 sm:px-10">
            <p>
              로그인 세션이 약 {remainMinutes}분 후 만료됩니다. 작업 중단을 막으려면 세션을 연장하세요.
            </p>
            <Link
              href={`/login?reauth=1&next=${encodeURIComponent(pathname || "/dashboard")}`}
              className="shrink-0 rounded-full border border-amber-200/40 px-3 py-1 text-[11px] font-medium hover:bg-amber-300/10"
            >
              세션 연장
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          SmartCurator
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 sm:flex">
          <Link href="/dashboard" className="transition hover:text-white">
            대시보드
          </Link>
          {initialized && !token && (
            <Link href="/login" className="transition hover:text-white">
              로그인
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {initialized && token ? (
            <>
              <span className="hidden text-xs text-slate-300 sm:inline">
                {userEmail ?? "로그인됨"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 transition hover:border-red-400 hover:text-red-200"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand hover:text-white"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}





