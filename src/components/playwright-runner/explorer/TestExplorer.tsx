"use client";

import React, { useState, useMemo } from "react";
import type { PlaywrightTestDescriptor } from "@/lib/playwright-runner/types";

export interface TestGroup {
  name: string;
  tests: PlaywrightTestDescriptor[];
}

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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const totalTests = useMemo(
    () => groups.reduce((acc, g) => acc + g.tests.length, 0),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        tests: group.tests.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            group.name.toLowerCase().includes(q) ||
            t.relativePath.toLowerCase().includes(q) ||
            (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q))),
        ),
      }))
      .filter((group) => group.tests.length > 0);
  }, [groups, search]);

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
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
              className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
            >
              All
            </button>
          )}
          {onDeselectAll && (
            <button
              type="button"
              disabled={disabled || selected.length === 0}
              onClick={onDeselectAll}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-40"
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

      {/* Test Tree */}
      <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
        {filteredGroups.length === 0 ? (
          <div className="py-6 text-center text-xs font-mono text-slate-400 italic">
            {search ? (
              "No matching tests found"
            ) : (
              <>
                <p>No Playwright tests found</p>
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
            const isCollapsed = Boolean(collapsedGroups[group.name]);
            const groupSelectedCount = group.tests.filter((t) =>
              selected.includes(t.id),
            ).length;

            return (
              <div key={`${group.name}-${groupIdx}`} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(group.name)}
                  className="w-full flex items-center justify-between text-left group py-1 text-slate-400 hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono transition-transform duration-150">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                      {group.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {groupSelectedCount}/{group.tests.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-1 pl-2 border-l border-slate-800">
                    {group.tests.map((test, testIdx) => {
                      const isChecked = selected.includes(test.id);

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
                            <input
                              type="checkbox"
                              aria-label={`Select ${test.title}`}
                              checked={isChecked}
                              disabled={disabled}
                              onChange={() => onToggle(test.id)}
                              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                            />
                            <button
                              type="button"
                              title={`Open ${test.relativePath} in editor`}
                              disabled={disabled || !onLoadSource}
                              onClick={() => onLoadSource?.(test.id)}
                              className="truncate text-left cursor-pointer disabled:cursor-default disabled:opacity-100"
                            >
                              <p className="truncate font-medium hover:text-indigo-300">{test.title}</p>
                              <p className="text-[10px] font-mono text-slate-400 truncate">
                                {test.relativePath}
                                {test.line ? `:${test.line}` : ""}
                              </p>
                            </button>
                          </div>

                          {onLoadSource && (
                            <button
                              type="button"
                              title="Load source code into editor"
                              disabled={disabled}
                              onClick={() => onLoadSource(test.id)}
                              className="shrink-0 ml-2 p-1 text-[10px] font-mono text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
                            >
                              Open 📝
                            </button>
                          )}
                        </div>
                      );
                    })}
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
