"use client";

import React from "react";
import type { BrowserName, PlaywrightSource, RunMode } from "@/lib/playwright-runner/types";

interface ExecutionToolbarProps {
  source: PlaywrightSource;
  onSourceChange: (source: PlaywrightSource) => void;
  selectedTestCount: number;
  selectedBrowsers: BrowserName[];
  mode: RunMode;
  isUnlocked: boolean;
  canRun: boolean;
  isSubmitting: boolean;
  isJobRunning: boolean;
  workspaceAvailable?: boolean;
  onRun: () => void;
  onCancel: () => void;
}

export function ExecutionToolbar({
  source,
  onSourceChange,
  selectedTestCount,
  selectedBrowsers,
  mode,
  isUnlocked,
  canRun,
  isSubmitting,
  isJobRunning,
  workspaceAvailable = true,
  onRun,
  onCancel,
}: ExecutionToolbarProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md space-y-4">
      {/* Top row: Source Switcher & Mode Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onSourceChange("project-test")}
            disabled={isJobRunning}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${
              source === "project-test"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📂 Project Tests ({selectedTestCount})
          </button>
          <button
            type="button"
            onClick={() => onSourceChange("workspace")}
            disabled={isJobRunning || !workspaceAvailable}
            title={!workspaceAvailable ? "Workspace execution is disabled for this project" : undefined}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${
              source === "workspace"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📝 Code Workspace
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>Browsers: <strong className="text-slate-200">{selectedBrowsers.join(", ") || "None"}</strong></span>
          <span>•</span>
          <span>Mode: <strong className="text-slate-200">{mode}</strong></span>
        </div>
      </div>

      {/* Bottom row: Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
        <div className="text-xs font-mono text-slate-400">
          {!isUnlocked ? (
            <span className="text-amber-400">🔒 Unlock password required</span>
          ) : isJobRunning ? (
            <span className="text-indigo-400 animate-pulse">● Execution in progress...</span>
          ) : (
            <span>Ready to execute</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isJobRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-mono font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <span>⏹</span>
              <span>{mode === "interactive" ? "Stop UI" : "Cancel Run"}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canRun || isSubmitting}
              onClick={onRun}
              className={`px-6 py-2.5 rounded-xl text-xs font-mono font-bold transition-all shadow-lg flex items-center gap-2 ${
                canRun && !isSubmitting
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <span>{isSubmitting ? "⏳" : "▶"}</span>
              <span>
                {isSubmitting
                  ? "Submitting..."
                  : mode === "interactive"
                  ? "Open Interactive UI"
                  : source === "project-test"
                  ? `Run ${selectedTestCount} Test${selectedTestCount === 1 ? "" : "s"}`
                  : "Run Workspace Code"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExecutionToolbar;
