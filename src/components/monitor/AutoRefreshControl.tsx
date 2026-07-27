"use client";

import React from "react";
import LocalTime from "@/components/LocalTime";

interface AutoRefreshControlProps {
  isPaused: boolean;
  isRefreshing: boolean;
  lastUpdated: string | null;
  onTogglePause: () => void;
  onManualRefresh: () => void;
}

export default function AutoRefreshControl({
  isPaused,
  isRefreshing,
  lastUpdated,
  onTogglePause,
  onManualRefresh,
}: AutoRefreshControlProps) {
  return (
    <div className="flex w-full sm:w-auto flex-wrap items-center justify-between gap-2 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
      <div className="flex items-center space-x-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isPaused
              ? "bg-amber-500 animate-pulse"
              : isRefreshing
                ? "bg-cyan-400 animate-ping"
                : "bg-emerald-400 animate-pulse"
          }`}
        />
        <span className="font-mono text-slate-300">
          {isPaused ? "PAUSED" : isRefreshing ? "REFRESHING..." : "LIVE (15s)"}
        </span>
      </div>

      {lastUpdated && (
        <span className="hidden sm:inline text-slate-500 font-mono">
          Last: <LocalTime value={lastUpdated} />
        </span>
      )}

      <div className="flex items-center space-x-1.5 border-l border-slate-800 pl-3">
        <button
          type="button"
          onClick={onTogglePause}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 font-mono transition text-slate-200"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="px-2 py-1 rounded bg-emerald-950/80 border border-emerald-700/50 hover:bg-emerald-900 text-emerald-300 font-mono transition disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
