"use client";

import React, { useState } from "react";
import type { TestProjectCatalog, TestPreset } from "@/lib/test-runner/types";
import { RunConfirmation } from "./RunConfirmation";

interface PresetLauncherProps {
  catalog: TestProjectCatalog | null;
  isUnlocked: boolean;
  isAgentOnline: boolean;
  isJobRunning: boolean;
  isSubmitting: boolean;
  onRunPreset: (projectId: string, presetId: string) => Promise<boolean>;
}

export function PresetLauncher({
  catalog,
  isUnlocked,
  isAgentOnline,
  isJobRunning,
  isSubmitting,
  onRunPreset,
}: PresetLauncherProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [confirmPreset, setConfirmPreset] = useState<TestPreset | null>(null);

  const projects = catalog?.projects || [];
  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const canRun = isUnlocked && isAgentOnline && !isJobRunning && !isSubmitting;

  const handleConfirmRun = async () => {
    if (!currentProject || !confirmPreset) return;
    const ok = await onRunPreset(currentProject.id, confirmPreset.id);
    if (ok) {
      setConfirmPreset(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-tight text-slate-200 uppercase font-mono">
          Available Preset Shortcuts
        </h2>

        {projects.length > 1 && (
          <div className="flex items-center space-x-2">
            <label htmlFor="project-select" className="text-xs text-slate-400 font-mono">
              Project:
            </label>
            <select
              id="project-select"
              value={currentProject?.id || ""}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!currentProject || currentProject.presets.length === 0 ? (
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400 font-mono">
          No test presets available in catalog.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentProject.presets.map((preset) => (
            <div
              key={preset.id}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-between space-y-4 hover:border-slate-700/80 transition duration-200"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-bold text-slate-100">{preset.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                    {preset.timeoutSeconds}s
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{preset.description || "No description provided."}</p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-400 truncate">
                  {preset.commandPreview}
                </div>
              </div>

              <button
                type="button"
                disabled={!canRun}
                onClick={() => setConfirmPreset(preset)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 border border-cyan-500/30 hover:border-cyan-500 transition duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {!isUnlocked
                  ? "Unlock Execution Required"
                  : !isAgentOnline
                  ? "Agent Offline"
                  : isJobRunning
                  ? "Job In Progress"
                  : `Run ${preset.name}`}
              </button>
            </div>
          ))}
        </div>
      )}

      <RunConfirmation
        isOpen={Boolean(confirmPreset)}
        projectName={currentProject?.name || ""}
        preset={confirmPreset}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmRun}
        onCancel={() => setConfirmPreset(null)}
      />
    </div>
  );
}
