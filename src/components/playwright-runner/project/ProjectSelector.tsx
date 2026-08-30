"use client";

import React from "react";
import type { PlaywrightProjectCatalog } from "@/lib/playwright-runner/types";

interface ProjectSelectorProps {
  projects: PlaywrightProjectCatalog[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ProjectSelector({
  projects,
  value,
  onChange,
  disabled = false,
}: ProjectSelectorProps) {
  const currentProject = projects.find((p) => p.id === value);
  const totalTests = currentProject?.testGroups?.reduce(
    (acc, g) => acc + g.tests.length,
    0,
  ) ?? 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <label
          htmlFor="playwright-project-select"
          className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400"
        >
          Project
        </label>
        {currentProject && (
          <span className="text-[10px] font-mono text-slate-400">
            {totalTests} test{totalTests === 1 ? "" : "s"} found
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <select
          id="playwright-project-select"
          aria-label="Target Project"
          value={value || ""}
          disabled={disabled || projects.length === 0}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        >
          {projects.length === 0 ? (
            <option value="">No projects discovered</option>
          ) : (
            projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name} ({proj.id})
              </option>
            ))
          )}
        </select>
      </div>

      {currentProject?.rootLabel && (
        <p className="mt-2 text-[10px] font-mono text-slate-400 truncate">
          Root: {currentProject.rootLabel}
        </p>
      )}
      {currentProject?.scanPathLabel && (
        <p className="mt-1 text-[10px] font-mono text-slate-500 truncate">
          Scanned: {currentProject.scanPathLabel}
        </p>
      )}
    </section>
  );
}

export default ProjectSelector;
