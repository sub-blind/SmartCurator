import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/layout/top-nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmartCurator | Personal Knowledge HQ",
  description:
    "Generate summaries, semantic search, and AI chat on top of your knowledge base powered by SmartCurator backend."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-slate-950 text-slate-100`}>
        <div className="gradient-ring fixed inset-0 -z-10 opacity-60" aria-hidden="true" />
        <div className="relative min-h-screen">
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-28 sm:px-10">{children}</main>
        </div>
      </body>
    </html>
  );
}




