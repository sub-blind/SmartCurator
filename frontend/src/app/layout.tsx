import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/layout/top-nav";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "SmartCurator | Personal Knowledge HQ",
  description:
    "Generate summaries, semantic search, and AI chat on top of your knowledge base powered by SmartCurator backend."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="overflow-x-hidden" suppressHydrationWarning>
      <body className={`${inter.className} app-body overflow-x-hidden`}>
        <div className="gradient-ring fixed inset-0 -z-10 opacity-40" aria-hidden="true" />
        <ThemeProvider>
          <AuthProvider>
            <div className="relative min-h-screen min-w-0">
              <TopNav />
              <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-16 pt-24 text-[15px] sm:px-6 sm:pt-28 sm:text-base md:px-10">
                {children}
              </main>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}




