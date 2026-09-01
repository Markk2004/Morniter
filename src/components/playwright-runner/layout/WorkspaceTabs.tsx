"use client";

import React, { useRef } from "react";
import type { WorkspaceTab } from "./workspace-layout-state";

export interface WorkspaceTabsProps {
  activeTab: WorkspaceTab;
  unreadLogsCount?: number;
  isJobRunning?: boolean;
  onChange: (tab: WorkspaceTab) => void;
  explorerPanel: React.ReactNode;
  codePanel: React.ReactNode;
  terminalPanel: React.ReactNode;
}

const TABS: Array<{ id: WorkspaceTab; label: string; icon: string }> = [
  { id: "explorer", label: "Explorer", icon: "📂" },
  { id: "code", label: "Code", icon: "📝" },
  { id: "terminal", label: "Terminal", icon: "💻" },
];

export function WorkspaceTabs({
  activeTab,
  unreadLogsCount = 0,
  isJobRunning = false,
  onChange,
  explorerPanel,
  codePanel,
  terminalPanel,
}: WorkspaceTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const targetTab = TABS[nextIndex].id;
      onChange(targetTab);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="flex min-h-[400px] flex-1 flex-col space-y-3 overflow-hidden">
      {/* 44px min touch target Tablist */}
      <div
        role="tablist"
        aria-label="Workspace tabs"
        className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0"
      >
        {TABS.map((tab, idx) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-controls={`tabpanel-${tab.id}`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>

              {tab.id === "terminal" && isJobRunning && (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Job is running">
                  <span className="sr-only">Running</span>
                </span>
              )}

              {tab.id === "terminal" && unreadLogsCount > 0 && !isSelected && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-950 border border-indigo-400/40 text-indigo-300 text-[10px] font-bold">
                  {unreadLogsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div
        role="tabpanel"
        id="tabpanel-explorer"
        aria-labelledby="tab-explorer"
        hidden={activeTab !== "explorer"}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {explorerPanel}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-code"
        aria-labelledby="tab-code"
        hidden={activeTab !== "code"}
        className="flex-1 min-h-0 overflow-y-auto space-y-4"
      >
        {codePanel}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-terminal"
        aria-labelledby="tab-terminal"
        hidden={activeTab !== "terminal"}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {terminalPanel}
      </div>
    </div>
  );
}
