"use client";

import { useState } from "react";
import LocalTime from "@/components/LocalTime";
import type { MonitorDiagnosticsResult, MonitorEvent } from "@/lib/monitor/types";

type Props = { eventId: string; eventType?: MonitorEvent["type"] };

export default function EventDiagnosticDetails({ eventId, eventType }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MonitorDiagnosticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDeployment = eventType === "deployment";
  const buttonLabel = expanded
    ? isDeployment
      ? "Hide deployment log"
      : "Hide diagnostic details"
    : isDeployment
      ? "View deployment log"
      : "View diagnostic details";

  const loadingLabel = isDeployment ? "Loading deployment logs…" : "Loading diagnostic logs…";

  const toggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (result || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/monitor/diagnostics?eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store" },
      );
      if (response.status === 429) {
        setError("Provider rate limit reached. Try again later.");
        return;
      }
      if (!response.ok) throw new Error("diagnostics request failed");
      setResult((await response.json()) as MonitorDiagnosticsResult);
    } catch {
      setError("Unable to load diagnostic logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 font-mono text-xs">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 transition text-[11px] font-medium"
      >
        {buttonLabel}
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-slate-800 bg-slate-950 p-3 space-y-2 text-slate-300">
          {loading && <div className="text-slate-400 text-xs italic">{loadingLabel}</div>}
          {error && (
            <div role="alert" className="text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}
          {result && (
            <>
              <div className="text-xs text-amber-300 font-semibold border-b border-slate-800 pb-1.5">
                Summary: {result.summary}
              </div>
              <ul className="space-y-1 text-[11px] leading-relaxed overflow-x-auto">
                {result.lines.map((line) => (
                  <li key={line.id} className="flex items-start space-x-2">
                    {line.occurredAt && (
                      <span className="text-slate-500 shrink-0">
                        [<LocalTime value={line.occurredAt} />]
                      </span>
                    )}
                    <span
                      className={`font-semibold uppercase shrink-0 ${
                        line.level === "error"
                          ? "text-rose-400"
                          : line.level === "warning"
                            ? "text-amber-400"
                            : "text-cyan-400"
                      }`}
                    >
                      [{line.level}]
                    </span>
                    <span className="text-violet-300 uppercase shrink-0">[{line.stage}]</span>
                    <span className="text-slate-200 whitespace-pre-wrap break-all">{line.message}</span>
                  </li>
                ))}
              </ul>
              {result.truncated && (
                <div className="text-[10px] text-amber-400/80 italic border-t border-slate-800/60 pt-1.5">
                  Log output was truncated
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
