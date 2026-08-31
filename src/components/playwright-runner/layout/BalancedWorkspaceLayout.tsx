"use client";

import React from "react";
import type { UseWorkspaceLayoutResult } from "./useWorkspaceLayout";
import { ResizeSeparator } from "./ResizeSeparator";
import { WorkspaceTabs } from "./WorkspaceTabs";

export interface BalancedWorkspaceLayoutProps {
  layout: UseWorkspaceLayoutResult;
  toolbar: React.ReactNode;
  explorer: React.ReactNode;
  code: React.ReactNode;
  terminal: React.ReactNode;
  unreadLogsCount?: number;
  isJobRunning?: boolean;
}

export function BalancedWorkspaceLayout({
  layout,
  toolbar,
  explorer,
  code,
  terminal,
  unreadLogsCount = 0,
  isJobRunning = false,
}: BalancedWorkspaceLayoutProps) {
  const {
    isNarrow,
    explorerWidth,
    terminalHeight,
    terminalCollapsed,
    activeTab,
    setExplorerWidth,
    setTerminalHeight,
    setTerminalCollapsed,
    setActiveTab,
  } = layout;

  if (isNarrow) {
    return (
      <div data-testid="balanced-workspace" className="flex flex-col gap-3 min-h-0 h-full overflow-hidden flex-1">
        <div className="shrink-0">{toolbar}</div>
        <WorkspaceTabs
          activeTab={activeTab}
          unreadLogsCount={unreadLogsCount}
          isJobRunning={isJobRunning}
          onChange={setActiveTab}
          explorerPanel={explorer}
          codePanel={code}
          terminalPanel={terminal}
        />
      </div>
    );
  }

  const maxTerminalHeight = typeof window !== "undefined"
    ? Math.max(160, Math.floor(window.innerHeight * 0.6))
    : 600;

  return (
    <div data-testid="balanced-workspace" className="flex flex-col gap-3 min-h-0 h-full overflow-hidden flex-1">
      {/* Top Toolbar */}
      <div className="shrink-0">{toolbar}</div>

      {/* Main Row: Explorer (Left) | Vertical Separator | Code (Right) */}
      <div
        data-testid="workspace-main-row"
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${explorerWidth}px 12px minmax(0, 1fr)`,
        }}
      >
        <div data-testid="workspace-explorer-panel" className="min-w-0 h-full overflow-y-auto">
          {explorer}
        </div>

        <ResizeSeparator
          orientation="vertical"
          value={explorerWidth}
          min={280}
          max={440}
          resetValue={320}
          label="Test Explorer width resizer"
          onChange={setExplorerWidth}
        />

        <div data-testid="workspace-code-panel" className="min-w-0 h-full overflow-y-auto space-y-4">
          {code}
        </div>
      </div>

      {/* Horizontal Separator between Workspace and Terminal */}
      {!terminalCollapsed && (
        <div className="shrink-0">
          <ResizeSeparator
            orientation="horizontal"
            value={terminalHeight}
            min={160}
            max={maxTerminalHeight}
            resetValue={240}
            label="Terminal height resizer"
            onChange={setTerminalHeight}
          />
        </div>
      )}

      {/* Terminal Region (Collapsible) */}
      <div data-tutorial-id="terminal" className="shrink-0 rounded-xl border border-slate-800 bg-slate-950/80 font-mono text-xs overflow-hidden shadow-sm">
        {/* Terminal Collapsible Header */}
        <button
          type="button"
          aria-expanded={!terminalCollapsed}
          aria-controls="terminal-panel-body"
          aria-label={terminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
          onClick={() => setTerminalCollapsed(!terminalCollapsed)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/80 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold text-xs flex items-center gap-1.5">
              <span>💻</span>
              <span>Terminal</span>
            </span>
            {isJobRunning && (
              <span className="px-2 py-0.2 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold animate-pulse">
                ● Running
              </span>
            )}
            {unreadLogsCount > 0 && terminalCollapsed && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-950 border border-indigo-400/40 text-indigo-300 text-[10px] font-bold">
                {unreadLogsCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {terminalCollapsed ? "Show Terminal ▲" : "Hide Terminal ▼"}
            </span>
          </div>
        </button>

        {/* Terminal Body */}
        {!terminalCollapsed && (
          <div id="terminal-panel-body" className="overflow-hidden">
            {terminal}
          </div>
        )}
      </div>
    </div>
  );
}

export default BalancedWorkspaceLayout;
