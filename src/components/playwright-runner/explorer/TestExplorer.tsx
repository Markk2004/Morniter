"use client";

import React, { useState, useMemo } from "react";
import type { ProjectCoverageGroup, PlaywrightTestDescriptor, NativeRunner } from "@/lib/playwright-runner/types";

type LegacyTestGroup = {
  name: string;
  tests: PlaywrightTestDescriptor[];
};

export type TestGroup = ProjectCoverageGroup | LegacyTestGroup;

const RUNNER_LABELS: Record<NativeRunner, string> = {
  playwright: "Playwright",
  "generated-playwright": "Playwright (Gen)",
  "node-test": "Frontend Node",
  jest: "Backend Jest",
  "jest-e2e": "Backend Jest E2E",
};

const RUNNER_BADGE_STYLES: Record<NativeRunner, string> = {
  playwright: "border-sky-500/30 bg-sky-950/40 text-sky-300",
  "generated-playwright": "border-cyan-500/30 bg-cyan-950/40 text-cyan-300",
  "node-test": "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
  jest: "border-purple-500/30 bg-purple-950/40 text-purple-300",
  "jest-e2e": "border-indigo-500/30 bg-indigo-950/40 text-indigo-300",
};

export type RunnerFilter = "all" | "playwright" | "node-test" | "jest" | "jest-e2e";

interface TestExplorerProps {
  groups: TestGroup[];
  scanPathLabel?: string;
  selected: string[];
  onToggle: (testId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onLoadSource?: (testId: string) => void;
  disabled?: boolean;
}

export function TestExplorer({
  groups,
  scanPathLabel,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onLoadSource,
  disabled = false,
}: TestExplorerProps) {
  const [search, setSearch] = useState("");
  const [runnerFilter, setRunnerFilter] = useState<RunnerFilter>("all");
  // Start with all groups collapsed by default; user clicks to view details
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const normalizedGroups = useMemo<ProjectCoverageGroup[]>(
    () => groups.map((group, index) => {
      if ("id" in group && "gaps" in group) return group;
      return {
        id: `legacy-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
        name: group.name,
        tests: group.tests.map((test) => ({
          id: test.id,
          title: test.title,
          relativePath: test.relativePath,
          runner: "playwright" as const,
          executable: true,
          risk: "read-only" as const,
          origin: "manual" as const,
          confidence: "high" as const,
          matchedBy: ["path" as const],
        })),
        gaps: [],
      };
    }),
    [groups],
  );

  const availableRunners = useMemo(() => {
    const set = new Set<NativeRunner>();
    for (const g of normalizedGroups) {
      for (const t of g.tests) {
        set.add(t.runner);
      }
    }
    return Array.from(set);
  }, [normalizedGroups]);

  const totalTests = useMemo(
    () => normalizedGroups.reduce((acc, g) => acc + g.tests.filter((test) => test.executable !== false).length, 0),
    [normalizedGroups],
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return normalizedGroups
      .map((group) => ({
        ...group,
        tests: group.tests.filter((t) => {
          if (runnerFilter !== "all") {
            if (runnerFilter === "playwright" && t.runner !== "playwright" && t.runner !== "generated-playwright") {
              return false;
            }
            if (runnerFilter !== "playwright" && t.runner !== runnerFilter) {
              return false;
            }
          }
          if (!q) return true;
          return (
            t.title.toLowerCase().includes(q) ||
            group.name.toLowerCase().includes(q) ||
            t.relativePath.toLowerCase().includes(q) ||
            t.runner.toLowerCase().includes(q) ||
            t.matchedBy.some((method) => method.toLowerCase().includes(q))
          );
        }),
      }))
      .filter((group) => group.tests.length > 0 || (group.gaps.length > 0 && runnerFilter === "all" && !q));
  }, [normalizedGroups, search, runnerFilter]);

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            Test Explorer
          </h3>
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
            {selected.length} of {totalTests} selected
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSelectAll && (
            <button
              type="button"
              disabled={disabled || totalTests === 0}
              onClick={onSelectAll}
              className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 disabled:opacity-40 cursor-pointer"
            >
              All
            </button>
          )}
          {onDeselectAll && (
            <button
              type="button"
              disabled={disabled || selected.length === 0}
              onClick={onDeselectAll}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
            >
              None
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div>
        <input
          type="text"
          placeholder="Filter tests by name, path, group, tag..."
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Runner Filter Chips */}
      {availableRunners.length > 1 && (
        <div className="flex flex-wrap gap-1 pt-0.5" role="group" aria-label="Filter tests by runner">
          <button
            type="button"
            onClick={() => setRunnerFilter("all")}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
              runnerFilter === "all"
                ? "bg-indigo-600 border-indigo-500 text-white font-medium"
                : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            All
          </button>
          {(availableRunners.includes("playwright") || availableRunners.includes("generated-playwright")) && (
            <button
              type="button"
              onClick={() => setRunnerFilter("playwright")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                runnerFilter === "playwright"
                  ? "bg-sky-600 border-sky-500 text-white font-medium"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              Playwright
            </button>
          )}
          {availableRunners.includes("node-test") && (
            <button
              type="button"
              onClick={() => setRunnerFilter("node-test")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                runnerFilter === "node-test"
                  ? "bg-emerald-600 border-emerald-500 text-white font-medium"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              Node
            </button>
          )}
          {availableRunners.includes("jest") && (
            <button
              type="button"
              onClick={() => setRunnerFilter("jest")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                runnerFilter === "jest"
                  ? "bg-purple-600 border-purple-500 text-white font-medium"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              Jest
            </button>
          )}
          {availableRunners.includes("jest-e2e") && (
            <button
              type="button"
              onClick={() => setRunnerFilter("jest-e2e")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                runnerFilter === "jest-e2e"
                  ? "bg-indigo-600 border-indigo-500 text-white font-medium"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              Jest E2E
            </button>
          )}
        </div>
      )}

      {/* Test Tree */}
      <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
        {filteredGroups.length === 0 ? (
          <div className="py-6 text-center text-xs font-mono text-slate-400 italic">
            {search || runnerFilter !== "all" ? (
              "No matching tests found"
            ) : (
              <>
                <p>No tests found</p>
                {scanPathLabel && (
                  <p className="mt-2 text-[10px] text-slate-500 not-italic">
                    Scanned: {scanPathLabel}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          filteredGroups.map((group, groupIdx) => {
            const isExpanded = Boolean(search.trim()) || runnerFilter !== "all" || Boolean(expandedGroups[group.id]);
            const isCollapsed = !isExpanded;
            const groupSelectedCount = group.tests.filter((t) =>
              t.executable !== false && selected.includes(t.id),
            ).length;

            return (
              <div key={`${group.id}-${groupIdx}`} className="space-y-1.5">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroupExpand(group.id)}
                  className="w-full flex items-center justify-between text-left group py-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono transition-transform duration-150 text-slate-500 group-hover:text-slate-300">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                      {group.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {groupSelectedCount}/{group.tests.filter((t) => t.executable !== false).length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-1 pl-2 border-l border-slate-800">
                    {group.tests.map((test, testIdx) => {
                      const isChecked = selected.includes(test.id);
                      const runnable = test.executable !== false;
                      const badgeStyle = RUNNER_BADGE_STYLES[test.runner] || "border-slate-700 bg-slate-800 text-slate-300";

                      return (
                        <div
                          key={`${test.id}-${testIdx}`}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                            isChecked
                              ? "bg-indigo-950/30 border-indigo-500/30 text-white"
                              : "bg-slate-950/30 border-slate-800/80 text-slate-300 hover:bg-slate-800/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {runnable ? (
                              <input
                                type="checkbox"
                                aria-label={`Select ${test.title}`}
                                checked={isChecked}
                                disabled={disabled}
                                onChange={() => onToggle(test.id)}
                                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                              />
                            ) : (
                              <span aria-hidden="true" className="w-3.5 shrink-0 text-center text-slate-600">•</span>
                            )}
                            <button
                              type="button"
                              title={`Open ${test.relativePath} in editor`}
                              disabled={disabled || !onLoadSource}
                              onClick={() => onLoadSource?.(test.id)}
                              className="truncate text-left cursor-pointer disabled:cursor-default disabled:opacity-100 flex-1 min-w-0"
                            >
                              <span className="block truncate font-medium hover:text-indigo-300">{test.title}</span>
                              <span className="block text-[10px] font-mono text-slate-400 truncate">
                                {test.relativePath}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-block text-[9px] font-mono px-1.5 py-0.2 rounded border ${badgeStyle}`}>
                                  {RUNNER_LABELS[test.runner] || test.runner}
                                </span>
                                {test.risk && (
                                  <span
                                    className={`inline-block text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                      test.risk === "mutating"
                                        ? "border-amber-500/30 bg-amber-950/40 text-amber-300"
                                        : "border-slate-700 bg-slate-800/60 text-slate-400"
                                    }`}
                                  >
                                    {test.risk === "mutating" ? "Mutating" : "Read-only"}
                                  </span>
                                )}
                                {test.confidence && (
                                  <span className="text-[10px] text-slate-500">
                                    · {test.confidence}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>

                          {onLoadSource && (
                            <button
                              type="button"
                              title="Load source code into editor"
                              disabled={disabled}
                              onClick={() => onLoadSource(test.id)}
                              className="shrink-0 ml-2 p-1 text-[10px] font-mono text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            >
                              Open 📝
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {group.gaps.map((gap) => (
                      <div
                        key={gap.targetId}
                        className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-2 text-[10px] text-amber-300"
                      >
                        Coverage gap: {gap.title} ({gap.status})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default TestExplorer;
