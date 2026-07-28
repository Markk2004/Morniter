"use client";

import React, { useState, useMemo } from "react";
import type { TestJob, TestProjectCatalog, TestPreset } from "@/lib/test-runner/types";
import { RunConfirmation } from "./RunConfirmation";

interface PresetLauncherProps {
  catalog: TestProjectCatalog | null;
  activeJob?: TestJob | null;
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
  const projects = useMemo(() => catalog?.projects || [], [catalog]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projects[0]?.id || "");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [confirmPreset, setConfirmPreset] = useState<TestPreset | null>(null);

  const effectiveProjectId = projects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : projects[0]?.id || "";
  const currentProject = projects.find((p) => p.id === effectiveProjectId) || projects[0];
  const selectedPreset = currentProject?.presets.find((p) => p.id === selectedPresetId) || null;

  const hasActiveJob = isJobRunning;
  const isControlsDisabled = hasActiveJob || !isAgentOnline || isSubmitting;
  const canRun = isUnlocked && isAgentOnline && !hasActiveJob && !isSubmitting && Boolean(selectedPreset);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedPresetId("");
    setConfirmPreset(null);
  };

  const handleConfirmRun = async () => {
    if (!currentProject || !confirmPreset) return;
    const ok = await onRunPreset(currentProject.id, confirmPreset.id);
    if (ok) {
      setConfirmPreset(null);
    }
  };

  const categoryLabel = (category: TestPreset["category"]) => {
    switch (category) {
      case "automated":
        return "Automated testing";
      case "execution":
        return "Execution test";
      case "uat":
        return "UAT";
      default:
        return category;
    }
  };

  const targetLabel = (preset: TestPreset) => {
    if (preset.category === "execution" && preset.databaseTarget === "defaultdb") return "Aiven defaultdb";
    if (preset.category === "uat") return "Read-only deployment";
    return "No database";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-tight text-slate-200 uppercase font-mono">
          Run Test Command
        </h2>
      </div>

      {projects.length === 0 ? (
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400 font-mono">
          No test projects or presets available in catalog.
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Select */}
            <div className="space-y-1.5">
              <label htmlFor="project-select" className="text-xs text-slate-400 font-mono font-medium block">
                Project
              </label>
              <select
                id="project-select"
                aria-label="Project"
                value={currentProject?.id || ""}
                disabled={isControlsDisabled}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Test Command Select */}
            <div className="space-y-1.5">
              <label htmlFor="test-select" className="text-xs text-slate-400 font-mono font-medium block">
                Test command
              </label>
              <select
                id="test-select"
                aria-label="Test command"
                value={selectedPresetId}
                disabled={isControlsDisabled}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a test</option>
                {currentProject?.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({preset.commandPreview})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Test Details Panel */}
          {selectedPreset && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selectedPreset.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedPreset.description || "No description provided."}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  {selectedPreset.timeoutSeconds}s timeout
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {categoryLabel(selectedPreset.category)}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Risk: {selectedPreset.risk}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Target: {targetLabel(selectedPreset)}
                </span>
                {(selectedPreset.srsIds || []).length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    SRS: {selectedPreset.srsIds.join(", ")}
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 truncate">
                {selectedPreset.commandPreview}
              </div>
            </div>
          )}

          {/* Action Run Button */}
          <button
            type="button"
            disabled={!canRun}
            onClick={() => selectedPreset && setConfirmPreset(selectedPreset)}
            className="w-full py-3 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/10 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!isUnlocked
              ? "Unlock Execution Required"
              : !isAgentOnline
              ? "Agent Offline"
              : hasActiveJob
              ? "Job In Progress"
              : !selectedPreset
              ? "Select a Test to Run"
              : "Run selected test"}
          </button>
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
