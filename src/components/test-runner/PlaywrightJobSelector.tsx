"use client";

import React, { useState } from "react";
import type {
  PlaywrightCatalog,
  PlaywrightJob,
  PlaywrightJobRequest,
  BrowserName,
  RunMode,
} from "@/lib/playwright-runner/types";
import { BrowserSelector } from "./BrowserSelector";

interface PlaywrightJobSelectorProps {
  catalog: PlaywrightCatalog | null;
  activeJob?: PlaywrightJob | null;
  isUnlocked: boolean;
  isAgentOnline: boolean;
  isJobRunning: boolean;
  isSubmitting: boolean;
  onRunJob: (request: PlaywrightJobRequest) => Promise<boolean>;
}

const DEFAULT_WORKSPACE_CODE = `import { test, expect } from '@playwright/test';

test('verify application login flow', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.*Monitor|Student/);
});
`;

export function PlaywrightJobSelector({
  catalog,
  isUnlocked,
  isAgentOnline,
  isJobRunning,
  isSubmitting,
  onRunJob,
}: PlaywrightJobSelectorProps) {
  const projects = catalog?.projects || [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"project-test" | "workspace">("project-test");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [workspaceCode, setWorkspaceCode] = useState<string>(DEFAULT_WORKSPACE_CODE);
  const [browsers, setBrowsers] = useState<BrowserName[]>(["chromium"]);
  const [mode, setMode] = useState<RunMode>("headless");

  const effectiveProjectId = selectedProjectId || (projects[0]?.id ?? "");
  const currentProject = projects.find((p) => p.id === effectiveProjectId) || projects[0];
  const allAvailableTests = currentProject?.tests || [];

  const handleToggleTest = (testId: string) => {
    if (selectedTestIds.includes(testId)) {
      setSelectedTestIds(selectedTestIds.filter((id) => id !== testId));
    } else {
      setSelectedTestIds([...selectedTestIds, testId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTestIds.length === allAvailableTests.length) {
      setSelectedTestIds([]);
    } else {
      setSelectedTestIds(allAvailableTests.map((t) => t.id));
    }
  };

  const handleProjectChange = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
    const newProject = projects.find((p) => p.id === newProjectId);
    if (newProject?.tests && newProject.tests.length > 0) {
      setSelectedTestIds([newProject.tests[0].id]);
    } else {
      setSelectedTestIds([]);
    }
  };

  const handleRun = async () => {
    if (!currentProject) return;

    if (activeTab === "project-test") {
      if (selectedTestIds.length === 0) return;
      await onRunJob({
        projectId: currentProject.id,
        source: "project-test",
        testIds: selectedTestIds,
        browsers,
        mode,
      });
    } else {
      if (!workspaceCode.trim()) return;
      await onRunJob({
        projectId: currentProject.id,
        source: "workspace",
        code: workspaceCode,
        browsers,
        mode,
      });
    }
  };

  const isConfigReady = Boolean(currentProject);
  const canRun =
    isUnlocked &&
    isAgentOnline &&
    !isJobRunning &&
    !isSubmitting &&
    isConfigReady &&
    browsers.length > 0 &&
    (activeTab === "project-test" ? selectedTestIds.length > 0 : workspaceCode.trim().length > 0);

  return (
    <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Playwright Test Setup</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure test sources, browsers, and execution mode
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center space-x-3">
          <label htmlFor="project-select" className="text-xs font-mono text-slate-400">
            Project:
          </label>
          <select
            id="project-select"
            aria-label="Project"
            value={effectiveProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            disabled={isJobRunning || isSubmitting}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("project-test")}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeTab === "project-test"
              ? "bg-slate-800 text-indigo-400 font-semibold border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📂 Project Tests ({allAvailableTests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workspace")}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeTab === "workspace"
              ? "bg-slate-800 text-indigo-400 font-semibold border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📝 Code Workspace
        </button>
      </div>

      {/* Tab 1: Project Tests */}
      {activeTab === "project-test" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              Selected: {selectedTestIds.length} of {allAvailableTests.length} tests
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={allAvailableTests.length === 0}
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300"
            >
              {selectedTestIds.length === allAvailableTests.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
            {allAvailableTests.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500">
                No scanned Playwright tests found in this project.
              </div>
            ) : (
              allAvailableTests.map((t, idx) => (
                <label
                  key={`${t.id}-${idx}`}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedTestIds.includes(t.id)
                      ? "bg-slate-800/80 border-indigo-500/50 text-slate-200"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      aria-label={`Select test ${t.title}`}
                      checked={selectedTestIds.includes(t.id)}
                      onChange={() => handleToggleTest(t.id)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-200">{t.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{t.relativePath}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Code Workspace */}
      {activeTab === "workspace" && (
        <div className="space-y-2">
          <label htmlFor="workspace-code" className="text-xs font-mono text-slate-400">
            Write or paste Playwright test script:
          </label>
          <textarea
            id="workspace-code"
            aria-label="Workspace Code"
            rows={10}
            value={workspaceCode}
            onChange={(e) => setWorkspaceCode(e.target.value)}
            disabled={isJobRunning || isSubmitting}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/90 p-4 font-mono text-xs text-indigo-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {/* Target Browsers */}
      <BrowserSelector
        selectedBrowsers={browsers}
        onChangeBrowsers={setBrowsers}
        mode={mode}
        onChangeMode={setMode}
        capabilities={currentProject?.capabilities}
        disabled={isJobRunning || isSubmitting}
      />

      {/* Run Action */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            canRun
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 active:scale-95"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
          }`}
        >
          {isSubmitting
            ? "Launching..."
            : isJobRunning
            ? "Test Job Running..."
            : !isUnlocked
            ? "Unlock Execution Required"
            : !isAgentOnline
            ? "Agent Offline"
            : "▶ Execute Playwright Tests"}
        </button>
      </div>
    </div>
  );
}

export default PlaywrightJobSelector;
