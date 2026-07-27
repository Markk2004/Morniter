"use client";

import React from "react";
import type { MonitorSource, Severity } from "@/lib/monitor/types";

interface SourceFiltersProps {
  selectedSource: MonitorSource | "all";
  selectedSeverity: Severity | "all";
  onSelectSource: (source: MonitorSource | "all") => void;
  onSelectSeverity: (severity: Severity | "all") => void;
}

const SOURCES: { id: MonitorSource | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vercel", label: "Vercel" },
  { id: "render", label: "Render" },
  { id: "aiven", label: "Aiven" },
  { id: "cronjob", label: "CronJob" },
  { id: "health", label: "Health" },
];

const SEVERITIES: { id: Severity | "all"; label: string; color: string }[] = [
  { id: "all", label: "All", color: "text-slate-300 border-slate-700" },
  { id: "info", label: "Info", color: "text-cyan-400 border-cyan-800" },
  { id: "warning", label: "Warning", color: "text-amber-400 border-amber-800" },
  { id: "error", label: "Error", color: "text-rose-400 border-rose-800" },
];

export default function SourceFilters({
  selectedSource,
  selectedSeverity,
  onSelectSource,
  onSelectSeverity,
}: SourceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
      {/* Source filter tabs */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-slate-400 font-mono mr-1">Source:</span>
        {SOURCES.map((src) => {
          const isActive = selectedSource === src.id;
          return (
            <button
              key={src.id}
              data-testid={`filter-source-${src.id}`}
              type="button"
              onClick={() => onSelectSource(src.id)}
              className={`px-2.5 py-1 rounded-md font-mono transition ${
                isActive
                  ? "bg-cyan-950 border border-cyan-600 text-cyan-200 font-semibold"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-400"
              }`}
            >
              {src.label}
            </button>
          );
        })}
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-1">
        <span className="text-slate-400 font-mono mr-1">Severity:</span>
        {SEVERITIES.map((sev) => {
          const isActive = selectedSeverity === sev.id;
          return (
            <button
              key={sev.id}
              data-testid={`filter-severity-${sev.id}`}
              type="button"
              onClick={() => onSelectSeverity(sev.id)}
              className={`px-2 py-1 rounded font-mono border transition ${
                isActive
                  ? "bg-slate-800 border-slate-600 text-white font-bold"
                  : `bg-slate-950/60 opacity-60 hover:opacity-100 ${sev.color}`
              }`}
            >
              {sev.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
