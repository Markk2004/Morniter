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
  const failureAnalysis = activeJob.failureAnalysis;

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
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
              Active Job Status
            </span>
            {activeJob.requesterLabel && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                {activeJob.requesterLabel}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-100 mt-0.5">
            {presetName} <span className="text-xs font-normal text-slate-400 font-mono">({activeJob.projectId})</span>
          </h3>
          <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono text-slate-400">
            <span>{activeJob.category}</span>
            {activeJob.srsIds?.length ? <span>{activeJob.srsIds.join(", ")}</span> : null}
            <span>{activeJob.databaseTarget === "defaultdb" ? "Aiven defaultdb" : activeJob.databaseTarget === "none" ? "No database" : activeJob.databaseTarget}</span>
          </div>
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

      {failureAnalysis && ["failed", "timed_out", "agent_lost"].includes(status) && (
        <section
          aria-live="polite"
          aria-label="Failure summary"
          className="rounded-xl border border-rose-500/30 bg-slate-950/70 p-4 space-y-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono font-semibold text-rose-300">
                Failure summary
              </p>
              <h4 className="mt-1 text-sm font-semibold text-slate-100">{failureAnalysis.title}</h4>
            </div>
            <span className="w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-mono uppercase text-amber-300">
              {failureAnalysis.confidence} confidence
            </span>
          </div>

          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Likely cause</dt>
              <dd className="mt-1 text-slate-200">{failureAnalysis.cause}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Where to fix</dt>
              <dd className="mt-1 text-slate-200">{failureAnalysis.fixLocation}</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">
            <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">Recommended next step</span>
            <p className="mt-1">{failureAnalysis.recommendation}</p>
          </div>

          {failureAnalysis.evidence.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Evidence</p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-400">
                {failureAnalysis.evidence.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="rounded-md bg-slate-900 px-2.5 py-1.5 font-mono break-all">
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
