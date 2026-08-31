"use client";

import React from "react";
import type {
  BrowserName,
  PlaywrightProjectCatalog,
  PlaywrightSource,
  RunMode,
} from "@/lib/playwright-runner/types";
import type { AgentPresence } from "@/lib/test-runner/types";

export interface WorkspaceControlBarProps {
  projects: PlaywrightProjectCatalog[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  selectedBrowsers: BrowserName[];
  browserCapabilities?: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  onToggleBrowser: (browser: BrowserName) => void;
  runMode: RunMode;
  headedAvailable: boolean;
  onRunModeChange: (mode: RunMode) => void;
  presence: AgentPresence | null;
  source: PlaywrightSource;
  onSourceChange?: (source: PlaywrightSource) => void;
  workspaceAvailable?: boolean;
  selectedTestCount: number;
  isUnlocked: boolean;
  canRun: boolean;
  isSubmitting: boolean;
  isJobRunning: boolean;
  onRun: () => void;
  onCancel: () => void;
  onResetLayout?: () => void;
}

const BROWSERS: Array<{ id: BrowserName; label: string; icon: string; short: string }> = [
  { id: "chromium", label: "Chrome", icon: "🌐", short: "Chrome" },
  { id: "firefox", label: "Firefox", icon: "🦊", short: "Firefox" },
  { id: "webkit", label: "WebKit", icon: "🧭", short: "WebKit" },
];

export function WorkspaceControlBar({
  projects,
  selectedProjectId,
  onSelectProject,
  selectedBrowsers,
  browserCapabilities,
  onToggleBrowser,
  runMode,
  headedAvailable,
  onRunModeChange,
  presence,
  source,
  onSourceChange,
  workspaceAvailable = true,
  selectedTestCount,
  isUnlocked,
  canRun,
  isSubmitting,
  isJobRunning,
  onRun,
  onCancel,
  onResetLayout,
}: WorkspaceControlBarProps) {
  const agentState = presence?.state || "offline";
  let agentDot = "bg-rose-500";
  let agentText = "Offline";
  if (agentState === "online") {
    agentDot = "bg-emerald-400 animate-pulse";
    agentText = "Online";
  } else if (agentState === "lagging") {
    agentDot = "bg-amber-400";
    agentText = "Lagging";
  }

  return (
    <div
      data-testid="workspace-control-bar"
      className="flex flex-wrap items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 font-mono text-xs shadow-sm"
    >
      {/* Left: Controls (Project, Source, Browsers, Mode, Agent) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        {/* Project Selector */}
        <div data-tutorial-id="project" className="flex items-center gap-1.5 shrink-0">
          <label htmlFor="playwright-project-select" className="text-slate-400 font-semibold text-[11px]">
            Proj:
          </label>
          <select
            id="playwright-project-select"
            aria-label="Target Project"
            value={selectedProjectId || ""}
            disabled={isJobRunning || projects.length === 0}
            onChange={(e) => onSelectProject(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 max-w-[160px] sm:max-w-[200px] truncate"
          >
            {projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Source Switcher (Tests vs Workspace) */}
        {onSourceChange && (
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <button
              type="button"
              onClick={() => onSourceChange("project-test")}
              disabled={isJobRunning}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                source === "project-test"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              📂 Tests ({selectedTestCount})
            </button>
            <button
              type="button"
              onClick={() => onSourceChange("workspace")}
              disabled={isJobRunning || !workspaceAvailable}
              title={!workspaceAvailable ? "Workspace execution is disabled for this project" : undefined}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                source === "workspace"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              📝 Code
            </button>
          </div>
        )}

        {/* Browsers & Mode */}
        <div data-tutorial-id="browsers" className="flex items-center gap-1.5 flex-wrap">
          {/* Browser Chips */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-800 bg-slate-950/60">
            {BROWSERS.map((b) => {
              const isInstalled = !browserCapabilities || browserCapabilities[b.id] !== false;
              const isChecked = selectedBrowsers.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-label={b.label}
                  title={`${b.label}${!isInstalled ? " (not installed)" : ""}`}
                  aria-pressed={isChecked}
                  disabled={isJobRunning || !isInstalled}
                  onClick={() => onToggleBrowser(b.id)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isChecked
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <span>{b.icon}</span>
                  <span className="hidden md:inline">{b.short}</span>
                </button>
              );
            })}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <button
              type="button"
              title="Headless (Fast / Background)"
              aria-pressed={runMode === "headless"}
              disabled={isJobRunning}
              onClick={() => onRunModeChange("headless")}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                runMode === "headless"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              Headless
            </button>
            <button
              type="button"
              title={headedAvailable ? "Headed (Visual real browser window on agent desktop)" : "Headed mode unavailable"}
              aria-pressed={runMode === "headed"}
              disabled={isJobRunning || !headedAvailable}
              onClick={() => onRunModeChange("headed")}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                runMode === "headed"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              Headed
            </button>
          </div>
        </div>

        {/* Agent Presence Indicator */}
        <div data-tutorial-id="agent" className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-800 bg-slate-950/60 text-[11px] text-slate-300">
          <span className={`inline-block w-2 h-2 rounded-full ${agentDot}`} />
          <span className="font-semibold">{`Local Agent ${agentText}`}</span>
        </div>
      </div>

      {/* Right: Actions (Reset Layout, Run / Cancel) */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {onResetLayout && (
          <button
            type="button"
            onClick={onResetLayout}
            title="Reset workspace panels to default layout"
            className="px-2 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 text-[11px] transition-colors cursor-pointer"
          >
            ↺ Reset layout
          </button>
        )}

        {/* Stable Run / Cancel slot */}
        <div data-tutorial-id="run">
          {isJobRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>⏹</span>
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canRun || isSubmitting || !isUnlocked}
              onClick={onRun}
              title={!isUnlocked ? "Unlock execution required" : undefined}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 ${
                canRun && !isSubmitting && isUnlocked
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-indigo-600/20"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <span>{isSubmitting ? "⏳" : "▶"}</span>
              <span>
                {isSubmitting
                  ? "Submitting..."
                  : source === "project-test"
                    ? `Run ${selectedTestCount || ""}`
                    : "Run Code"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkspaceControlBar;
