"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TAB_SESSION_STORAGE_KEY } from "@/lib/auth/tab-session";
import BrandLogo from "@/components/BrandLogo";

interface MonitorShellProps {
  displayName?: string;
  children: React.ReactNode;
}

export function MonitorShell({ displayName = "Monitor Operator", children }: MonitorShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.sessionStorage.removeItem(TAB_SESSION_STORAGE_KEY);
      router.push("/login");
      router.refresh();
    }
  }

  const isLogsActive = pathname === "/monitor";
  const isTestsActive = pathname === "/monitor/tests";

  return (
    <div
      className={`${
        isTestsActive
          ? "h-dvh overflow-hidden max-[899px]:h-auto max-[899px]:min-h-dvh max-[899px]:overflow-y-auto"
          : "min-h-screen"
      } bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950`}
    >
      {/* Top Header Navigation */}
      <header className="shrink-0 sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <BrandLogo size="sm" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
              Monitor
            </span>
          </div>

          <nav className="flex items-center space-x-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80" aria-label="Main Navigation">
            <Link
              href="/monitor"
              aria-current={isLogsActive ? "page" : undefined}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isLogsActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              Logs
            </Link>
            <Link
              href="/monitor/tests"
              aria-current={isTestsActive ? "page" : undefined}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isTestsActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              Tests
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs font-mono text-slate-400 hidden sm:inline-block px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs font-medium text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-rose-500/30 transition-all duration-200 disabled:opacity-50"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      {/* Main Page Workspace */}
      <main
        data-testid="monitor-page-workspace"
        className={`flex-1 w-full mx-auto p-3 sm:p-4 lg:p-5 ${
          isTestsActive
            ? "min-h-0 max-w-none overflow-hidden flex flex-col max-[899px]:flex-none max-[899px]:overflow-visible"
            : "max-w-7xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
