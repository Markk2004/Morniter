"use client";

import React, { useState } from "react";
import LocalTime from "@/components/LocalTime";
import type { TestCaseResultItem, TestExecutionSummary, BrowserExecutionResult } from "@/lib/playwright-runner/types";
import { extractTestExecutionSummary } from "@/lib/playwright-runner/progress-parser";

export interface HistoricalJobItem {
  id: string;
  projectId: string;
  presetName?: string;
  source?: string;
  code?: string;
  testIds?: string[];
  browsers?: string[];
  status: string;
  queuedAt?: string;
  createdAt?: string;
  completedAt?: string;
  testExecutionSummary?: TestExecutionSummary;
  testCases?: TestCaseResultItem[];
  browserResults?: BrowserExecutionResult[];
  failureAnalysis?: {
    category?: string;
    title: string;
    cause: string;
    fixLocation: string;
    recommendation?: string;
    evidence?: string[];
    confidence?: string;
  };
}

interface JobHistoryProps {
  jobs?: HistoricalJobItem[];
  history?: HistoricalJobItem[];
  activeJobId?: string | null;
  onSelectJob?: (job: HistoricalJobItem) => void;
  onLoadWorkspaceCode?: (job: HistoricalJobItem) => void;
  onRefresh?: () => void;
}

export function JobHistory({
  jobs,
  history,
  activeJobId,
  onSelectJob,
  onLoadWorkspaceCode,
  onRefresh,
}: JobHistoryProps) {
  const list = jobs || history || [];
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");

  if (list.length === 0) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 italic flex items-center justify-between">
        <span>ยังไม่มีบันทึกประวัติการทดสอบระบบ (No past test execution jobs recorded yet)</span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-[11px] text-indigo-400 hover:underline font-mono"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  const passedCount = list.filter((j) => j.status === "passed").length;
  const failedCount = list.filter((j) => j.status === "failed" || j.status === "timed_out").length;

  const filteredList = list.filter((j) => {
    if (statusFilter === "passed") return j.status === "passed";
    if (statusFilter === "failed") return j.status === "failed" || j.status === "timed_out";
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold rounded-full shadow-sm">
            <span>✓</span> ผ่าน (PASSED)
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-semibold rounded-full shadow-sm">
            <span>✗</span> ไม่ผ่าน (FAILED)
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-semibold rounded-full animate-pulse shadow-sm">
            <span>⏳</span> กำลังรัน (RUNNING)
          </span>
        );
      case "queued":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold rounded-full">
            รอคิว (QUEUED)
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-500/15 text-slate-400 border border-slate-500/30 text-[10px] font-semibold rounded-full">
            ยกเลิก (CANCELLED)
          </span>
        );
      case "timed_out":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-semibold rounded-full">
            หมดเวลา (TIMED OUT)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-full">
            {status}
          </span>
        );
    }
  };

  const toggleExpand = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  const handleLoadCode = (job: HistoricalJobItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onLoadWorkspaceCode) {
      onLoadWorkspaceCode(job);
    } else if (onSelectJob) {
      onSelectJob(job);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow-sm">
      {/* Header and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊</span>
              <span>ประวัติการทดสอบระบบ (Test Execution & UAT History)</span>
            </h4>
            <span className="text-[10px] font-mono bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-full border border-slate-700/60">
              {list.length} รายการ
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            บันทึกผลการทดสอบย้อนหลัง สามารถตรวจสอบผลราย Test Case และโหลดโค้ดกลับเข้า Workspace ได้ทันที
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filter Pills */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-0.5 rounded transition-colors ${
                statusFilter === "all"
                  ? "bg-slate-800 text-slate-100 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ทั้งหมด ({list.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("passed")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === "passed"
                  ? "bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-emerald-400/70 hover:text-emerald-300"
              }`}
            >
              <span>✓</span> ผ่าน ({passedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("failed")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === "failed"
                  ? "bg-rose-950/80 text-rose-300 font-semibold border border-rose-500/30"
                  : "text-rose-400/70 hover:text-rose-300"
              }`}
            >
              <span>✗</span> ไม่ผ่าน ({failedCount})
            </button>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-[11px] text-indigo-400 hover:underline font-mono px-1"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* History Items List */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {filteredList.map((job) => {
          const isSelected = job.id === activeJobId;
          const isExpanded = expandedJobId === job.id;

          // Obtain structured test execution summary from job or synthesize
          const summary =
            job.testExecutionSummary ||
            extractTestExecutionSummary(job);

          const uatTitle =
            summary.uatTitle ||
            job.presetName ||
            (job.source === "workspace" ? "Workspace Code Draft" : `Tests (${job.testIds?.length || 1})`);

          const time = job.queuedAt || job.createdAt || new Date().toISOString();
          const cases = summary.cases || [];
          const hasCases = cases.length > 0;
          const passedCases = cases.filter((c) => c.status === "passed").length;
          const totalCases = cases.length;

          return (
            <div
              key={job.id}
              className={`rounded-lg border text-xs transition-colors overflow-hidden ${
                isSelected
                  ? "bg-slate-800/90 border-indigo-500/50 shadow-sm"
                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80"
              }`}
            >
              {/* Row Header / Main Click Area */}
              <div className="w-full text-left p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div
                  onClick={() => onSelectJob?.(job)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectJob?.(job);
                    }
                  }}
                  className="space-y-1.5 flex-1 min-w-0 cursor-pointer select-none"
                >
                  <div className="font-semibold text-slate-100 flex flex-wrap items-center gap-2">
                    <span className="truncate max-w-md">{uatTitle}</span>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                      {job.projectId}
                    </span>
                    {job.browsers && (
                      <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950/40 border border-indigo-500/20 px-1.5 py-0.2 rounded">
                        [{job.browsers.join(", ")}]
                      </span>
                    )}
                    {hasCases && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                          job.status === "passed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        ผ่าน {passedCases}/{totalCases} เคส
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                    <LocalTime value={time} format="datetime" />
                    {summary.duration && (
                      <span className="text-slate-500">⏱️ {summary.duration}</span>
                    )}
                    {job.code && (
                      <span className="text-indigo-400/80">📄 โค้ดใน Workspace พร้อมโหลด</span>
                    )}
                  </div>

                  {job.failureAnalysis && ["failed", "timed_out", "agent_lost"].includes(job.status) && (
                    <div className="mt-2 max-w-2xl text-[10px] leading-relaxed bg-rose-950/30 border border-rose-900/40 p-2 rounded">
                      <p className="text-rose-300 font-medium">Failure summary: {job.failureAnalysis.title}</p>
                      <p className="text-slate-400">Fix: {job.failureAnalysis.fixLocation}</p>
                    </div>
                  )}
                </div>

                {/* Right Badges & Actions */}
                <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                  {getStatusBadge(job.status)}

                  {/* Load Code Shortcut Button */}
                  {(job.code || job.source === "workspace" || job.testIds?.length) && (
                    <button
                      type="button"
                      title="โหลดโค้ดของรอบทดสอบนี้กลับเข้า Workspace"
                      onClick={(e) => handleLoadCode(job, e)}
                      className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>📥</span> โหลดโค้ด
                    </button>
                  )}

                  {/* Expand / Collapse Chevron Button */}
                  <button
                    type="button"
                    aria-label="ดูรายละเอียด Test Case"
                    title={isExpanded ? "ย่อรายละเอียด" : "ดูผลการทดสอบราย Test Case"}
                    onClick={(e) => toggleExpand(job.id, e)}
                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Accordion Expandable Details: Individual Test Cases */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 bg-slate-900/50 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold pt-1">
                    <span className="flex items-center gap-1.5">
                      <span>🧪</span>
                      <span>รายละเอียดผลการทดสอบแต่ละ Test Case ({cases.length} เคส)</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleLoadCode(job, e)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono hover:underline flex items-center gap-1"
                    >
                      <span>📥</span> โหลดโค้ดกลับเข้า Workspace
                    </button>
                  </div>

                  {hasCases ? (
                    <div className="space-y-1.5">
                      {cases.map((c, cIdx) => {
                        const isPass = c.status === "passed";
                        return (
                          <div
                            key={`${c.id}-${cIdx}`}
                            className={`p-2 rounded border text-xs flex flex-col gap-1 ${
                              isPass
                                ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-200"
                                : "bg-rose-950/25 border-rose-500/25 text-rose-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                                    isPass
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  }`}
                                >
                                  {isPass ? "PASS" : "FAIL"}
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-slate-100">
                                  {c.id}
                                </span>
                                <span className="truncate text-slate-300">{c.title}</span>
                              </div>
                              {c.duration && (
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  ⏱️ {c.duration}
                                </span>
                              )}
                            </div>

                            {/* Failure details / Error message if present */}
                            {c.error && !isPass && (
                              <div className="mt-1 text-[10px] font-mono text-rose-300 bg-rose-950/50 p-1.5 rounded border border-rose-900/50 break-all">
                                <span className="font-semibold text-rose-400">⚠️ Error: </span>
                                {c.error}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950/60 rounded border border-slate-800 text-center text-slate-400 text-xs italic">
                      ชุดทดสอบนี้ไม่มีรายละเอียดเคสย่อย (Basic sanity check / single test)
                    </div>
                  )}

                  {/* Primary CTA: Load code back into workspace */}
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleLoadCode(job, e)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>📥</span>
                      <span>โหลดโค้ดนี้กลับเข้า Workspace (Load Code into Workspace)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default JobHistory;
