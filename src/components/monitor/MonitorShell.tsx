"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TAB_SESSION_STORAGE_KEY } from "@/lib/auth/tab-session";

interface MonitorShellProps {
  displayName?: string;
  children: React.ReactNode;
}

export function MonitorShell({ displayName = "Morniter Operator", children }: MonitorShellProps) {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md shadow-cyan-500/20">
              M
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
              Morniter
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
