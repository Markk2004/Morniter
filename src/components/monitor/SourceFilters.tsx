"use client";

import React from "react";
import type { MonitorSource, Severity, DiagnosticStage } from "@/lib/monitor/types";

interface SourceFiltersProps {
  selectedSource: MonitorSource | "all";
  selectedSeverity: Severity | "all";
  selectedStatus: string | "all";
  selectedStage: DiagnosticStage | "all";
  availableStatuses: string[];
  availableStages: DiagnosticStage[];
  onSelectSource: (source: MonitorSource | "all") => void;
  onSelectSeverity: (severity: Severity | "all") => void;
  onSelectStatus: (status: string | "all") => void;
  onSelectStage: (stage: DiagnosticStage | "all") => void;
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
  selectedStatus,
  selectedStage,
  availableStatuses,
  availableStages,
  onSelectSource,
  onSelectSeverity,
  onSelectStatus,
  onSelectStage,
}: SourceFiltersProps) {
  return (
    <div className="flex flex-col gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Source filter tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-slate-400 mr-1">Source:</span>
          {SOURCES.map((src) => {
            const isActive = selectedSource === src.id;
            return (
              <button
                key={src.id}
                data-testid={`filter-source-${src.id}`}
                type="button"
                onClick={() => onSelectSource(src.id)}
                className={`px-2.5 py-1 rounded-md transition ${
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
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-slate-400 mr-1">Severity:</span>
          {SEVERITIES.map((sev) => {
            const isActive = selectedSeverity === sev.id;
            return (
              <button
                key={sev.id}
                data-testid={`filter-severity-${sev.id}`}
                type="button"
                onClick={() => onSelectSeverity(sev.id)}
                className={`px-2 py-1 rounded border transition ${
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

      {/* Status & Stage filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800/60 pt-2">
        {/* Status filter */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-slate-400 mr-1">Status:</span>
          <button
            type="button"
            data-testid="filter-status-all"
            onClick={() => onSelectStatus("all")}
            className={`px-2 py-0.5 rounded transition ${
              selectedStatus === "all"
                ? "bg-slate-700 text-white font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            All
          </button>
          {availableStatuses.map((st) => (
            <button
              key={st}
              type="button"
              data-testid={`filter-status-${st}`}
              onClick={() => onSelectStatus(st)}
              className={`px-2 py-0.5 rounded transition ${
                selectedStatus === st
                  ? "bg-cyan-900 border border-cyan-600 text-cyan-200 font-semibold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Stage filter */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-slate-400 mr-1">Stage:</span>
          <button
            type="button"
            data-testid="filter-stage-all"
            onClick={() => onSelectStage("all")}
            className={`px-2 py-0.5 rounded transition ${
              selectedStage === "all"
                ? "bg-slate-700 text-white font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            All
          </button>
          {availableStages.map((stg) => (
            <button
              key={stg}
              type="button"
              data-testid={`filter-stage-${stg}`}
              onClick={() => onSelectStage(stg)}
              className={`px-2 py-0.5 rounded transition ${
                selectedStage === stg
                  ? "bg-violet-900 border border-violet-600 text-violet-200 font-semibold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {stg}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
