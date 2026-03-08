"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";

export function TopNav() {
  const router = useRouter();
  const { token, userEmail, initialized, logout } = useAuth();

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





