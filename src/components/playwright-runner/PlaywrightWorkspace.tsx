"use client";

import React, { useRef } from "react";
import { ExecutionUnlock } from "@/components/test-runner/ExecutionUnlock";
import { AgentStatusBanner } from "@/components/test-runner/AgentStatusBanner";
import { LiveTestTerminal } from "@/components/test-runner/LiveTestTerminal";
import { JobHistory } from "@/components/test-runner/JobHistory";

import { ProjectSelector } from "./project/ProjectSelector";
import { BrowserSelector } from "./browser/BrowserSelector";
import { RunModeSelector } from "./browser/RunModeSelector";
import { BrowserExecutionStatus } from "./browser/BrowserExecutionStatus";
import { TestExplorer } from "./explorer/TestExplorer";
import { CodeWorkspace } from "./editor/CodeWorkspace";
import { ExecutionToolbar } from "./execution/ExecutionToolbar";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import { RecipeBuilder } from "./recipe/RecipeBuilder";
import { usePlaywrightRunner } from "./usePlaywrightRunner";
import { usePlaywrightTutorial } from "./tutorial/usePlaywrightTutorial";
import { PlaywrightTutorial } from "./tutorial/PlaywrightTutorial";
import type { ProjectCoverageGroup } from "@/lib/playwright-runner/types";

export function PlaywrightWorkspace() {
  const runner = usePlaywrightRunner();
  const tutorialButtonRef = useRef<HTMLButtonElement>(null);
  const tutorial = usePlaywrightTutorial(!runner.loadingCatalog, runner.catalogError);

  const testGroups: ProjectCoverageGroup[] = runner.currentProject?.coverageGroups ??
    (runner.currentProject?.testGroups ?? []).map((group) => ({
      id: `legacy-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: group.name,
      tests: group.tests.map((test) => ({
        id: test.id,
        title: test.title,
        relativePath: test.relativePath,
        runner: "playwright" as const,
        executable: true,
        origin: "manual" as const,
        confidence: "high" as const,
        matchedBy: ["path" as const],
      })),
      gaps: [],
    }));
  const hasResults =
    (runner.browserResults && runner.browserResults.length > 0) ||
    (runner.activeJob?.artifacts && runner.activeJob.artifacts.length > 0) ||
    (runner.history && runner.history.length > 0);

  return (
    <>
      <div id="playwright-workspace-root" className="space-y-6">
        {/* Workspace Header with Permanent Tutorial Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Playwright Automation</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Build, execute and inspect browser automation tests via Windows Local Agent
            </p>
          </div>

          <button
            ref={tutorialButtonRef}
            type="button"
            onClick={tutorial.openTutorial}
            aria-label="เปิด Tutorial การใช้งาน Playwright"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:text-white text-xs font-mono transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <span>📖</span>
            <span>Tutorial</span>
          </button>
        </div>

        {runner.loadingCatalog ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400">
            Loading Playwright workspace...
          </div>
        ) : runner.catalogError && runner.projects.length === 0 ? (
          <div className="p-8 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center space-y-3">
            <p className="text-sm font-semibold text-rose-300">
              ไม่สามารถโหลด Playwright Catalog ได้
            </p>
            <p className="text-xs font-mono text-slate-400">
              กรุณาตรวจสอบว่า Local Test Agent กำลังทำงานและเชื่อมต่อกับระบบ
            </p>
            <button
              type="button"
              onClick={runner.refreshCatalog}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono hover:bg-slate-700 transition-colors cursor-pointer"
            >
              🔄 ลองใหม่ (Retry)
            </button>
          </div>
        ) : (
          <>
            {/* Step 2: Execution Step-up Auth Password Unlock */}
            <div
              data-tutorial-id="execution-lock"
              data-tutorial-state={runner.isUnlocked ? "unavailable" : "available"}
            >
              {!runner.isUnlocked && <ExecutionUnlock onUnlocked={runner.refreshUnlock} />}
            </div>

            {/* Step 1: Local Agent Heartbeat Presence Banner */}
            <div data-tutorial-id="agent">
              <AgentStatusBanner presence={runner.presence} />
            </div>

            {/* Main 2-Column Grid */}
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              {/* Left Sidebar: Controls & Test Explorer */}
              <aside className="space-y-4">
                <div data-tutorial-id="project">
                  <ProjectSelector
                    projects={runner.projects}
                    value={runner.selectedProjectId}
                    onChange={runner.selectProject}
                    disabled={runner.isJobRunning}
                  />
                </div>

                <div data-tutorial-id="browsers" className="space-y-4">
                  <BrowserSelector
                    selected={runner.selectedBrowsers}
                    capabilities={runner.browserCapabilities}
                    onToggle={runner.toggleBrowser}
                    disabled={runner.isJobRunning}
                  />

                  <RunModeSelector
                    value={runner.runMode}
                    headedAvailable={runner.headedAvailable}
                    onChange={runner.setRunMode}
                    disabled={runner.isJobRunning}
                  />
                </div>

                <div data-tutorial-id="select-test">
                  <TestExplorer
                    key={runner.selectedProjectId ?? "no-project"}
                    groups={testGroups}
                    scanPathLabel={runner.currentProject?.scanPathLabel}
                    selected={runner.selectedTestIds}
                    onToggle={runner.toggleTest}
                    onSelectAll={runner.selectAllTests}
                    onDeselectAll={runner.deselectAllTests}
                    onLoadSource={runner.loadTestSource}
                    disabled={runner.isJobRunning}
                  />
                </div>
              </aside>

              {/* Right Main Panel: Code Workspace & Execution */}
              <main className="space-y-4">
                {runner.isRecipeBuilderOpen && runner.recipeDraft && (
                  <div data-testid="recipe-builder-panel">
                    <RecipeBuilder
                      draft={runner.recipeDraft}
                      flows={runner.reusableFlows}
                      testTarget={runner.currentProject?.testTarget}
                      onChange={runner.updateRecipeDraft}
                      onClose={runner.closeRecipeBuilder}
                      onSave={runner.saveRecipeDraft}
                      onRunDraft={runner.run}
                      isSaving={runner.isSavingRecipe}
                      isRunDraftRunning={runner.isJobRunning}
                      isDraftVerified={runner.isDraftVerified}
                      saveError={runner.saveRecipeError}
                      saveSuccess={runner.saveRecipeSuccess}
                      disabled={runner.isJobRunning || runner.isSavingRecipe}
                    />
                  </div>
                )}

                <div data-tutorial-id="code">
                  <CodeWorkspace
                    code={runner.editorCode}
                    onChange={runner.setEditorCode}
                    dirty={runner.editorDirty}
                    onReset={runner.resetEditorCode}
                    onCreateDraft={() => runner.openRecipeBuilder()}
                    disabled={runner.isJobRunning}
                  />
                </div>

                <div data-tutorial-id="run">
                  <ExecutionToolbar
                    source={runner.source}
                    onSourceChange={runner.setSource}
                    selectedTestCount={runner.selectedTestIds.length}
                    selectedBrowsers={runner.selectedBrowsers}
                    mode={runner.runMode}
                    isUnlocked={runner.isUnlocked}
                    canRun={runner.canRun}
                    isSubmitting={runner.isSubmitting}
                    isJobRunning={runner.isJobRunning}
                    workspaceAvailable={runner.currentProject?.capabilities?.workspaceExecution !== false}
                    onRun={runner.run}
                    onCancel={runner.cancelActiveJob}
                  />
                </div>

                <BrowserExecutionStatus results={runner.browserResults} />
              </main>
            </div>

            {/* Step 8: Live Test Terminal */}
            <div data-tutorial-id="terminal">
              <LiveTestTerminal lines={runner.terminalLines} />
            </div>

            {/* Step 9: Result and History */}
            <div
              data-tutorial-id="result"
              data-tutorial-state={hasResults ? "available" : "unavailable"}
              className="space-y-4"
            >
              {runner.activeJob?.artifacts && runner.activeJob.artifacts.length > 0 && (
                <ArtifactPanel artifacts={runner.activeJob.artifacts} />
              )}

              <JobHistory
                jobs={runner.history}
                activeJobId={runner.activeJob?.id}
                onRefresh={runner.refreshHistory}
              />
            </div>
          </>
        )}
      </div>

      {/* Tutorial Overlay Modal */}
      <PlaywrightTutorial
        isOpen={tutorial.isOpen}
        currentStepIndex={tutorial.currentStepIndex}
        returnFocusRef={tutorialButtonRef}
        workspaceRootId="playwright-workspace-root"
        onClose={tutorial.closeTutorial}
        onSkip={tutorial.skipTutorial}
        onFinish={tutorial.finishTutorial}
        onNext={tutorial.nextStep}
        onPrevious={tutorial.previousStep}
        onStepChange={tutorial.goToStep}
      />
    </>
  );
}

export default PlaywrightWorkspace;
