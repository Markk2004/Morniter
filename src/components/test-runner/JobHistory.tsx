"use client";

import React from "react";

interface JobHistoryProps {
  jobs?: any[];
  history?: any[];
  activeJobId?: string | null;
  onSelectJob?: (job: any) => void;
  onRefresh?: () => void;
}

export function JobHistory({
  jobs,
  history,
  activeJobId,
  onSelectJob,
  onRefresh,
}: JobHistoryProps) {
  const list = jobs || history || [];

  if (list.length === 0) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 italic flex items-center justify-between">
        <span>No past test execution jobs recorded yet.</span>
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold rounded-full">PASSED</span>;
      case "failed":
        return <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold rounded-full">FAILED</span>;
      case "running":
        return <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold rounded-full animate-pulse">RUNNING</span>;
      case "queued":
        return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold rounded-full">QUEUED</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-semibold rounded-full">CANCELLED</span>;
      case "timed_out":
        return <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold rounded-full">TIMED OUT</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-semibold rounded-full">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Job Execution History (Last {list.length})
        </h4>
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

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {list.map((job) => {
          const isSelected = job.id === activeJobId;
          const label =
            job.presetName ||
            (job.source === "workspace" ? "Workspace Code" : `Tests (${job.testIds?.length || 1})`);
          const time = job.queuedAt || job.createdAt || new Date().toISOString();

          return (
            <button
              key={job.id}
              onClick={() => onSelectJob?.(job)}
              className={`w-full text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between gap-3 ${
                isSelected
                  ? "bg-slate-800 border-indigo-500/50 text-slate-100"
                  : "bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/50"
              }`}
            >
              <div className="space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span>{label}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({job.projectId})</span>
                  {job.browsers && (
                    <span className="text-[10px] text-indigo-300 font-mono">
                      [{job.browsers.join(", ")}]
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(time).toLocaleString()}
                </div>

                {job.failureAnalysis && ["failed", "timed_out", "agent_lost"].includes(job.status) && (
                  <div className="mt-2 max-w-2xl text-[10px] leading-relaxed">
                    <p className="text-rose-300">Failure summary: {job.failureAnalysis.title}</p>
                    <p className="text-slate-500">Fix: {job.failureAnalysis.fixLocation}</p>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {getStatusBadge(job.status)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default JobHistory;
