"use client";

import React, { useState, useMemo } from "react";
import type {
  ProjectCoverageGroup,
  PlaywrightTestDescriptor,
  NativeRunner,
} from "@/lib/playwright-runner/types";
import {
  TEST_SECTION_PAGE_SIZE,
  partitionTestsByConfidence,
  getRunnerLabel,
} from "./test-explorer-presentation";
import { TestMatchDetails } from "./TestMatchDetails";

type LegacyTestGroup = {
  name: string;
  tests: PlaywrightTestDescriptor[];
};

export type TestGroup = ProjectCoverageGroup | LegacyTestGroup;

const RUNNER_BADGE_STYLES: Record<NativeRunner, string> = {
  playwright: "border-sky-500/30 bg-sky-950/40 text-sky-300",
  "generated-playwright": "border-cyan-500/30 bg-cyan-950/40 text-cyan-300",
  "node-test": "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
  jest: "border-purple-500/30 bg-purple-950/40 text-purple-300",
  "jest-e2e": "border-indigo-500/30 bg-indigo-950/40 text-indigo-300",
};

export type RunnerFilter = "all" | "playwright" | "node-test" | "jest" | "jest-e2e";

type TestSectionKind = "ready" | "review";
type SectionKey = `${string}:${TestSectionKind}`;

interface TestExplorerProps {
  groups: TestGroup[];
  scanPathLabel?: string;
  selected: string[];
  onToggle: (testId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onLoadSource?: (testId: string) => void;
  onCreateDraft?: (seed: {
    testId?: string;
    title: string;
    relativePath?: string;
    functionId?: string;
    functionName?: string;
  }) => void;
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
  onCreateDraft,
  disabled = false,
}: TestExplorerProps) {
  const [search, setSearch] = useState("");
  const [runnerFilter, setRunnerFilter] = useState<RunnerFilter>("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({});
  const [visibleLimits, setVisibleLimits] = useState<Record<string, number>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const filterKey = `${search.trim().toLowerCase()}:${runnerFilter}:${groups.length}`;

  const normalizedGroups = useMemo<ProjectCoverageGroup[]>(
    () =>
      groups.map((group, index) => {
        if ("id" in group && "gaps" in group) return group;
        return {
          id: `legacy-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
          name: group.name,
          functionId: "functionId" in group ? (group as { functionId?: string }).functionId : undefined,
          functionName: "functionName" in group ? (group as { functionName?: string }).functionName : undefined,
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
    () =>
      normalizedGroups.reduce(
        (acc, g) => acc + g.tests.filter((test) => test.executable !== false).length,
        0,
      ),
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
            (group.functionId && group.functionId.toLowerCase().includes(q)) ||
            (group.functionName && group.functionName.toLowerCase().includes(q)) ||
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

  const isSectionExpanded = (key: SectionKey, defaultExpanded: boolean) => {
    if (Boolean(search.trim())) return true;
    return expandedSections[key] ?? defaultExpanded;
  };

  const toggleSection = (key: SectionKey, defaultExpanded: boolean) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? defaultExpanded),
    }));
  };

  const getSectionLimit = (key: SectionKey) =>
    visibleLimits[`${key}:${filterKey}`] ?? TEST_SECTION_PAGE_SIZE;

  const increaseLimit = (key: SectionKey) => {
    const fullKey = `${key}:${filterKey}`;
    setVisibleLimits((prev) => ({
      ...prev,
      [fullKey]: (prev[fullKey] ?? TEST_SECTION_PAGE_SIZE) + TEST_SECTION_PAGE_SIZE,
    }));
  };

  const resetLimit = (key: SectionKey) => {
    const fullKey = `${key}:${filterKey}`;
    setVisibleLimits((prev) => ({
      ...prev,
      [fullKey]: TEST_SECTION_PAGE_SIZE,
    }));
  };

  const toggleDetail = (testId: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [testId]: !prev[testId],
    }));
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
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
      <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
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
            const hasSheetFunction = Boolean(group.functionId && group.functionName);
            const groupHeading = hasSheetFunction
              ? `${group.functionId} · ${group.functionName}`
              : group.name;

            const { ready, review } = partitionTestsByConfidence(group.tests);
            const readyKey: SectionKey = `${group.id}:ready`;
            const reviewKey: SectionKey = `${group.id}:review`;

            const isReadyOpen = isSectionExpanded(readyKey, true);
            const isReviewOpen = isSectionExpanded(reviewKey, false);

            const readyLimit = getSectionLimit(readyKey);
            const reviewLimit = getSectionLimit(reviewKey);

            const visibleReady = ready.slice(0, readyLimit);
            const visibleReview = review.slice(0, reviewLimit);

            return (
              <div key={`${group.id}-${groupIdx}`} className="space-y-2">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroupExpand(group.id)}
                  className="w-full flex items-center justify-between text-left group py-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono transition-transform duration-150 text-slate-500 group-hover:text-slate-300">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 truncate">
                      {groupHeading}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                    {groupSelectedCount}/{group.tests.filter((t) => t.executable !== false).length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-3 pt-1">
                    {/* Section 1: พร้อมทดสอบ (Ready) */}
                    {ready.length > 0 && (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          aria-expanded={isReadyOpen}
                          onClick={() => toggleSection(readyKey, true)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <span className="text-[9px] font-mono">{isReadyOpen ? "▼" : "▶"}</span>
                          <span>พร้อมทดสอบ {ready.length}</span>
                        </button>

                        {isReadyOpen && (
                          <div className="space-y-1">
                            {visibleReady.map((test, testIdx) => {
                              const isChecked = selected.includes(test.id);
                              const runnable = test.executable !== false;
                              const badgeStyle =
                                RUNNER_BADGE_STYLES[test.runner] ||
                                "border-slate-700 bg-slate-800 text-slate-300";
                              const panelId = `details-${test.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                              const isDetailsOpen = Boolean(expandedDetails[test.id]);

                              return (
                                <div key={`${test.id}-${testIdx}`} className="space-y-1">
                                  <div
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
                                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                                        />
                                      ) : (
                                        <span
                                          aria-hidden="true"
                                          className="w-3.5 shrink-0 text-center text-slate-600"
                                        >
                                          •
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        title={`Open ${test.relativePath} in editor`}
                                        disabled={disabled || !onLoadSource}
                                        onClick={() => onLoadSource?.(test.id)}
                                        className="truncate text-left cursor-pointer disabled:cursor-default disabled:opacity-100 flex-1 min-w-0"
                                      >
                                        <span className="block truncate font-medium hover:text-indigo-300">
                                          {test.title}
                                        </span>
                                        <span className="block text-[10px] font-mono text-slate-400 truncate">
                                          {test.relativePath}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                          {hasSheetFunction && (
                                            <span className="inline-block text-[9px] font-mono px-1.5 py-0.2 rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
                                              ตรงกับ Sheet
                                            </span>
                                          )}
                                          <span
                                            className={`inline-block text-[9px] font-mono px-1.5 py-0.2 rounded border ${badgeStyle}`}
                                          >
                                            {getRunnerLabel(test.runner)}
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
                                        </div>
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                      {onCreateDraft &&
                                        test.runner !== "playwright" &&
                                        test.runner !== "generated-playwright" && (
                                          <button
                                            type="button"
                                            title="Create Playwright browser test draft from this test"
                                            disabled={disabled}
                                            onClick={() =>
                                              onCreateDraft({
                                                testId: test.id,
                                                title: test.title,
                                                relativePath: test.relativePath,
                                                functionId: group.functionId,
                                                functionName: group.functionName,
                                              })
                                            }
                                            className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:text-white transition-colors cursor-pointer"
                                          >
                                            Draft 🪄
                                          </button>
                                        )}
                                      <button
                                        type="button"
                                        aria-expanded={isDetailsOpen}
                                        aria-controls={panelId}
                                        onClick={() => toggleDetail(test.id)}
                                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                                          isDetailsOpen
                                            ? "bg-slate-700 border-slate-600 text-white"
                                            : "border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                        }`}
                                      >
                                        รายละเอียด
                                      </button>
                                      {onLoadSource && (
                                        <button
                                          type="button"
                                          title="Load source code into editor"
                                          disabled={disabled}
                                          onClick={() => onLoadSource(test.id)}
                                          className="p-1 text-[10px] font-mono text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                        >
                                          Open 📝
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isDetailsOpen && (
                                    <TestMatchDetails
                                      panelId={panelId}
                                      functionId={group.functionId}
                                      functionName={group.functionName}
                                      test={test}
                                    />
                                  )}
                                </div>
                              );
                            })}

                            {/* Paging Actions */}
                            <div className="flex items-center gap-2 pt-1 text-[10px] font-mono">
                              {ready.length > readyLimit && (
                                <button
                                  type="button"
                                  onClick={() => increaseLimit(readyKey)}
                                  className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                >
                                  แสดงเพิ่มอีก {TEST_SECTION_PAGE_SIZE}
                                </button>
                              )}
                              {readyLimit > TEST_SECTION_PAGE_SIZE && ready.length > TEST_SECTION_PAGE_SIZE && (
                                <button
                                  type="button"
                                  onClick={() => resetLimit(readyKey)}
                                  className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                                >
                                  ย่อรายการ
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 2: ควรตรวจสอบการจับคู่ (Review Low Confidence) */}
                    {review.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                        <button
                          type="button"
                          aria-expanded={isReviewOpen}
                          onClick={() => toggleSection(reviewKey, false)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 hover:text-amber-300 cursor-pointer"
                        >
                          <span className="text-[9px] font-mono">{isReviewOpen ? "▼" : "▶"}</span>
                          <span>ควรตรวจสอบการจับคู่ {review.length}</span>
                        </button>

                        {isReviewOpen && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-mono italic mb-1">
                              รายการที่มีความมั่นใจต่ำ (Low confidence) ควรตรวจสอบเหตุผลการจับคู่ก่อนรัน
                            </p>
                            {visibleReview.map((test, testIdx) => {
                              const isChecked = selected.includes(test.id);
                              const runnable = test.executable !== false;
                              const badgeStyle =
                                RUNNER_BADGE_STYLES[test.runner] ||
                                "border-slate-700 bg-slate-800 text-slate-300";
                              const panelId = `details-${test.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                              const isDetailsOpen = Boolean(expandedDetails[test.id]);

                              return (
                                <div key={`${test.id}-${testIdx}`} className="space-y-1">
                                  <div
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
                                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                                        />
                                      ) : (
                                        <span
                                          aria-hidden="true"
                                          className="w-3.5 shrink-0 text-center text-slate-600"
                                        >
                                          •
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        title={`Open ${test.relativePath} in editor`}
                                        disabled={disabled || !onLoadSource}
                                        onClick={() => onLoadSource?.(test.id)}
                                        className="truncate text-left cursor-pointer disabled:cursor-default disabled:opacity-100 flex-1 min-w-0"
                                      >
                                        <span className="block truncate font-medium hover:text-indigo-300">
                                          {test.title}
                                        </span>
                                        <span className="block text-[10px] font-mono text-slate-400 truncate">
                                          {test.relativePath}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                          {hasSheetFunction && (
                                            <span className="inline-block text-[9px] font-mono px-1.5 py-0.2 rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
                                              ตรงกับ Sheet
                                            </span>
                                          )}
                                          <span
                                            className={`inline-block text-[9px] font-mono px-1.5 py-0.2 rounded border ${badgeStyle}`}
                                          >
                                            {getRunnerLabel(test.runner)}
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
                                        </div>
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                      {onCreateDraft &&
                                        test.runner !== "playwright" &&
                                        test.runner !== "generated-playwright" && (
                                          <button
                                            type="button"
                                            title="Create Playwright browser test draft from this test"
                                            disabled={disabled}
                                            onClick={() =>
                                              onCreateDraft({
                                                testId: test.id,
                                                title: test.title,
                                                relativePath: test.relativePath,
                                                functionId: group.functionId,
                                                functionName: group.functionName,
                                              })
                                            }
                                            className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:text-white transition-colors cursor-pointer"
                                          >
                                            Draft 🪄
                                          </button>
                                        )}
                                      <button
                                        type="button"
                                        aria-expanded={isDetailsOpen}
                                        aria-controls={panelId}
                                        onClick={() => toggleDetail(test.id)}
                                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                                          isDetailsOpen
                                            ? "bg-slate-700 border-slate-600 text-white"
                                            : "border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                        }`}
                                      >
                                        รายละเอียด
                                      </button>
                                      {onLoadSource && (
                                        <button
                                          type="button"
                                          title="Load source code into editor"
                                          disabled={disabled}
                                          onClick={() => onLoadSource(test.id)}
                                          className="p-1 text-[10px] font-mono text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                        >
                                          Open 📝
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isDetailsOpen && (
                                    <TestMatchDetails
                                      panelId={panelId}
                                      functionId={group.functionId}
                                      functionName={group.functionName}
                                      test={test}
                                    />
                                  )}
                                </div>
                              );
                            })}

                            {/* Paging Actions */}
                            <div className="flex items-center gap-2 pt-1 text-[10px] font-mono">
                              {review.length > reviewLimit && (
                                <button
                                  type="button"
                                  onClick={() => increaseLimit(reviewKey)}
                                  className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                >
                                  แสดงเพิ่มอีก {TEST_SECTION_PAGE_SIZE}
                                </button>
                              )}
                              {reviewLimit > TEST_SECTION_PAGE_SIZE && review.length > TEST_SECTION_PAGE_SIZE && (
                                <button
                                  type="button"
                                  onClick={() => resetLimit(reviewKey)}
                                  className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                                >
                                  ย่อรายการ
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Coverage Gaps */}
                    {group.gaps.map((gap) => (
                      <div
                        key={gap.targetId}
                        className="flex items-center justify-between p-2 rounded-lg border border-amber-500/20 bg-amber-950/10 text-[10px] text-amber-300"
                      >
                        <span>
                          Coverage gap: {gap.title} ({gap.status})
                        </span>
                        {onCreateDraft && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              onCreateDraft({
                                title: gap.title,
                                functionId: group.functionId,
                                functionName: group.functionName,
                              })
                            }
                            className="px-1.5 py-0.5 text-[9px] font-mono rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                          >
                            Draft 🪄
                          </button>
                        )}
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
