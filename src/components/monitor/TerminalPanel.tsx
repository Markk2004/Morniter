"use client";

import React from "react";
import type { MonitorEvent } from "@/lib/monitor/types";
import LocalTime from "@/components/LocalTime";
import EventDiagnosticDetails from "./EventDiagnosticDetails";

interface TerminalPanelProps {
  events: MonitorEvent[];
  onClearVisible?: () => void;
}

export default function TerminalPanel({ events, onClearVisible }: TerminalPanelProps) {
  return (
    <div className="flex flex-col h-[520px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl font-mono">
      {/* Terminal Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-rose-500/80" />
          <div className="h-3 w-3 rounded-full bg-amber-500/80" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          <span className="text-xs text-slate-400 font-semibold ml-2">
            Terminal Stream ({events.length} events)
          </span>
        </div>

        {onClearVisible && (
          <button
            type="button"
            onClick={onClearVisible}
            className="text-[11px] text-slate-500 hover:text-slate-300 font-mono px-2 py-0.5 rounded bg-slate-800/60 transition"
          >
            Clear Screen
          </button>
        )}
      </div>

      {/* Terminal Body */}
      <div
        className="flex-1 p-4 overflow-y-auto space-y-2 text-xs divide-y divide-slate-900/60"
        aria-live="polite"
      >
        {events.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">
            No events match current filter.
          </div>
        ) : (
          events.map((evt) => {
            const isError = evt.severity === "error";
            const isWarn = evt.severity === "warning";

            const sevBadge = isError
              ? "bg-rose-950 text-rose-300 border-rose-800"
              : isWarn
                ? "bg-amber-950 text-amber-300 border-amber-800"
                : "bg-cyan-950 text-cyan-300 border-cyan-800";

            return (
              <div key={evt.id} className="pt-2.5 first:pt-0 flex flex-col space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-500 font-mono">
                    [<LocalTime key="time" value={evt.occurredAt} />]
                  </span>

                  <span className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px] uppercase font-semibold">
                    {evt.source}
                  </span>

                  <span className="text-slate-300 font-semibold">{evt.service}</span>

                  <span className={`px-1.5 py-0.2 rounded border text-[10px] uppercase font-semibold ${sevBadge}`}>
                    {evt.severity}
                  </span>

                  {evt.stage && (
                    <span className="px-1.5 py-0.5 rounded border border-violet-800/80 bg-violet-950 text-violet-300 text-[10px] uppercase">
                      {evt.stage}
                    </span>
                  )}

                  <span className="text-slate-400 font-mono text-[11px]">({evt.status})</span>

                </div>

                {evt.deploymentId && (
                  <div className="text-[10px] text-slate-500 font-mono pl-4">
                    Deployment ID: {evt.deploymentId}
                  </div>
                )}

                {(evt.commitSha || evt.commitMessage || evt.branch || evt.commitAuthor) && (
                  <div className="text-[11px] text-slate-400 font-mono pl-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {evt.commitSha && (
                      <span className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                        {evt.commitSha.slice(0, 7)}
                      </span>
                    )}
                    {evt.branch && (
                      <span className="text-cyan-400 font-semibold">
                        [{evt.branch}]
                      </span>
                    )}
                    {evt.commitAuthor && (
                      <span className="text-slate-400">by {evt.commitAuthor}</span>
                    )}
                    {evt.commitMessage && (
                      <span className="text-slate-300 italic whitespace-pre-wrap break-all">
                        &quot;{evt.commitMessage}&quot;
                      </span>
                    )}
                  </div>
                )}

                <div className="text-slate-300 pl-4 border-l-2 border-slate-800 whitespace-pre-wrap break-all leading-relaxed font-mono">
                  {evt.message}
                </div>

                {evt.diagnosticAvailable && (
                  <div className="pl-4">
                    <EventDiagnosticDetails eventId={evt.id} eventType={evt.type} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
