"use client";

import React, { useRef, useState, useEffect } from "react";
import { ExecutionUnlock } from "@/components/test-runner/ExecutionUnlock";
import { LiveTestTerminal } from "@/components/test-runner/LiveTestTerminal";
import { JobHistory } from "@/components/test-runner/JobHistory";

import { BrowserExecutionStatus } from "./browser/BrowserExecutionStatus";
import { TestExplorer } from "./explorer/TestExplorer";
import { CodeWorkspace } from "./editor/CodeWorkspace";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import { RecipeBuilder } from "./recipe/RecipeBuilder";
import { usePlaywrightRunner } from "./usePlaywrightRunner";
import { usePlaywrightTutorial } from "./tutorial/usePlaywrightTutorial";
import { PlaywrightTutorial } from "./tutorial/PlaywrightTutorial";
import { useWorkspaceLayout } from "./layout/useWorkspaceLayout";
import { WorkspaceControlBar } from "./layout/WorkspaceControlBar";
import { BalancedWorkspaceLayout } from "./layout/BalancedWorkspaceLayout";
import type { ProjectCoverageGroup } from "@/lib/playwright-runner/types";
import type { TutorialTargetId } from "./tutorial/tutorial-steps";

export function PlaywrightWorkspace() {
  const runner = usePlaywrightRunner();
  const layout = useWorkspaceLayout();
  const tutorialButtonRef = useRef<HTMLButtonElement>(null);
  const tutorial = usePlaywrightTutorial(
    !runner.loadingCatalog,
    runner.catalogError,
    runner.isJobRunning,
  );

  // Terminal unread logs tracking: increment when terminal is inactive/collapsed
  const [lastSeenLogCount, setLastSeenLogCount] = useState<number>(0);
  const terminalLineCount = runner.terminalLines.length;
  const isTerminalActive = layout.isNarrow
    ? layout.activeTab === "terminal"
    : !layout.terminalCollapsed;

  useEffect(() => {
    if (isTerminalActive) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setLastSeenLogCount(terminalLineCount);
    }
  }, [isTerminalActive, terminalLineCount]);

  const unreadLogsCount = isTerminalActive
    ? 0
    : Math.max(0, terminalLineCount - lastSeenLogCount);

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
  const hasExecutableTests = testGroups.some((group) =>
    group.tests.some((test) => test.executable),
  );
  const tutorialUnavailableTargetIds: TutorialTargetId[] = [
    ...(runner.isUnlocked ? (["execution-lock"] as const) : []),
    ...(runner.projects.length === 0 ? (["project", "browsers"] as const) : []),
    ...(!hasExecutableTests ? (["select-test"] as const) : []),
    ...(!hasResults ? (["result"] as const) : []),
  ];

  return (
    <div
      id="playwright-workspace-root"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden flex-1"
    >
      {/* Workspace Header with Permanent Tutorial Trigger */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
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

      {tutorial.isOpen ? (
        <PlaywrightTutorial
          isOpen={tutorial.isOpen}
          currentStepIndex={tutorial.currentStepIndex}
          returnFocusRef={tutorialButtonRef}
          workspaceRootId="playwright-workspace-root"
          unavailableTargetIds={tutorialUnavailableTargetIds}
          onClose={tutorial.closeTutorial}
          onSkip={tutorial.skipTutorial}
          onFinish={tutorial.finishTutorial}
          onNext={tutorial.nextStep}
          onPrevious={tutorial.previousStep}
          onStepChange={tutorial.goToStep}
        />
      ) : runner.loadingCatalog ? (
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
            className="shrink-0"
          >
            {!runner.isUnlocked && <ExecutionUnlock onUnlocked={runner.refreshUnlock} />}
            {runner.runError && (
              <div
                role="alert"
                className="mt-2 p-2.5 rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs font-mono"
              >
                {runner.runError}
              </div>
            )}

            {/* Interactive Mode Guidance & Status Banner */}
            {(runner.runMode === "interactive" || runner.activeJob?.mode === "interactive") && (
              <div
                role="status"
                className="mt-2 p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/30 text-indigo-200 text-xs font-mono flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span>🖥️</span>
                  <span>Playwright UI opens on the Windows computer running Local Agent. Replay results stay in that window.</span>
                </div>
                {runner.activeJob?.mode === "interactive" && runner.isJobRunning && (
                  <span className="px-2 py-0.5 rounded bg-indigo-600/40 border border-indigo-400/40 text-[11px] text-white font-semibold animate-pulse">
                    Interactive session active (30 min limit)
                  </span>
                )}
                {runner.activeJob?.status === "session_closed" && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
                    {runner.activeJob.sessionCloseReason === "operator_stopped"
                      ? "Interactive session stopped by operator."
                      : runner.activeJob.sessionCloseReason === "timeout"
                        ? "Interactive session closed due to 30-minute timeout."
                        : runner.activeJob.sessionCloseReason === "process_error"
                          ? "Interactive session closed due to process error."
                          : "Interactive session closed by user."}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Main Balanced Workspace Layout (Layout B) */}
          <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
            <BalancedWorkspaceLayout
              layout={layout}
              isJobRunning={runner.isJobRunning}
              unreadLogsCount={unreadLogsCount}
              toolbar={
                <WorkspaceControlBar
                  projects={runner.projects}
                  selectedProjectId={runner.selectedProjectId}
                  onSelectProject={runner.selectProject}
                  selectedBrowsers={runner.selectedBrowsers}
                  browserCapabilities={runner.browserCapabilities}
                  onToggleBrowser={runner.toggleBrowser}
                  runMode={runner.runMode}
                  headedAvailable={runner.headedAvailable}
                  onRunModeChange={runner.setRunMode}
                  presence={runner.presence}
                  source={runner.source}
                  onSourceChange={runner.setSource}
                  workspaceAvailable={runner.currentProject?.capabilities?.workspaceExecution !== false}
                  selectedTestCount={runner.selectedTestIds.length}
                  isUnlocked={runner.isUnlocked}
                  canRun={runner.canRun}
                  isSubmitting={runner.isSubmitting}
                  isJobRunning={runner.isJobRunning}
                  onRun={runner.run}
                  onCancel={runner.cancelActiveJob}
                  onResetLayout={layout.resetLayout}
                />
              }
              explorer={
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
                    onCreateDraft={runner.openRecipeBuilder}
                    disabled={runner.isJobRunning}
                  />
                </div>
              }
              code={
                <div className="space-y-4">
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

                  <BrowserExecutionStatus results={runner.browserResults} />

                  {/* Step 9: Result and History */}
                  <div
                    data-tutorial-id="result"
                    data-tutorial-state={hasResults ? "available" : "unavailable"}
                    className="space-y-4 pt-2"
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
                </div>
              }
              terminal={
                <LiveTestTerminal
                  lines={runner.terminalLines}
                  height={layout.terminalHeight}
                  compact={true}
                />
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export default PlaywrightWorkspace;
