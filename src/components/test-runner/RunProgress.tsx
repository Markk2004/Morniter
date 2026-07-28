"use client";

import React from "react";
import type { TestJob } from "@/lib/test-runner/types";

interface RunProgressProps {
  activeJob: TestJob | null;
  onCancelJob: (jobId: string) => void;
  isSubmitting: boolean;
}

export function RunProgress({ activeJob, onCancelJob, isSubmitting }: RunProgressProps) {
  if (!activeJob) return null;

  const { status, progress, presetName, cancelRequested, error } = activeJob;

  const completed = progress?.completed;
  const total = progress?.total;
  const percentage = progress?.percentage;

  let statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
  if (status === "passed") statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (status === "failed" || status === "timed_out" || status === "agent_lost")
    statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/30";
  if (status === "cancelled" || status === "cancel_requested")
    statusColor = "text-slate-400 bg-slate-800 border-slate-700";

  return (
    <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Active Job Status
          </span>
          <h3 className="text-base font-bold text-slate-100 mt-0.5">{presetName}</h3>
        </div>

        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 rounded-full border text-xs font-mono font-semibold uppercase ${statusColor}`}>
            {status}
          </span>

          {(status === "running" || status === "claimed" || status === "queued") && (
            <button
              type="button"
              disabled={isSubmitting || cancelRequested}
              onClick={() => onCancelJob(activeJob.id)}
              className="px-3 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition disabled:opacity-50"
            >
              {cancelRequested ? "Cancelling..." : "Cancel Job"}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar (if percentage is available) */}
      {typeof percentage === "number" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>
              {completed !== null && total !== null ? `${completed} / ${total} tests` : "Running tests"}
            </span>
            <span className="font-semibold text-cyan-400">{percentage}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs font-mono text-rose-300">
          <strong>Failure Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
