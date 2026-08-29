"use client";

import React from "react";
import type { BrowserExecutionResult } from "@/lib/playwright-runner/types";

interface BrowserExecutionStatusProps {
  results: BrowserExecutionResult[];
}

export function BrowserExecutionStatus({ results }: BrowserExecutionStatusProps) {
  if (!results || results.length === 0) return null;

  const getStatusBadge = (status: BrowserExecutionResult["status"]) => {
    switch (status) {
      case "passed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "failed":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "running":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 animate-pulse";
      case "cancelled":
        return "bg-slate-500/10 text-slate-400 border-slate-700";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
  };

  const getBrowserIcon = (browser: string) => {
    switch (browser) {
      case "chromium":
        return "🌐";
      case "firefox":
        return "🦊";
      case "webkit":
        return "🧭";
      default:
        return "💻";
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {results.map((res) => (
        <div
          key={res.browser}
          className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{getBrowserIcon(res.browser)}</span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                {res.browser}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase ${getStatusBadge(
                res.status,
              )}`}
            >
              {res.status}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓ {res.passed}</span>
              <span className="text-rose-400">✗ {res.failed}</span>
              {res.skipped > 0 && (
                <span className="text-slate-400">○ {res.skipped}</span>
              )}
            </div>
            {res.durationMs !== undefined && (
              <span className="text-[10px] text-slate-400">
                {(res.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default BrowserExecutionStatus;
