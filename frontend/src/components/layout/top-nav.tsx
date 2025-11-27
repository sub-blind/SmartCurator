"use client";

import Link from "next/link";

export function TopNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          SmartCurator
        </Link>
        <nav className="hidden gap-6 text-sm text-slate-300 sm:flex">
          <Link href="#quick-start" className="transition hover:text-white">
            빠른 시작
          </Link>
          <Link href="#architecture" className="transition hover:text-white">
            아키텍처
          </Link>
          <Link href="#roadmap" className="transition hover:text-white">
            다음 단계
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/"
            target="_blank"
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand hover:text-white"
          >
            GitHub
          </Link>
          <Link
            href="#quick-start"
            className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
          >
            데모 보기
          </Link>
        </div>
      </div>
    </header>
  );
}




