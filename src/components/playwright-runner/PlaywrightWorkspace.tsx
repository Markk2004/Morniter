"use client";

import React from "react";
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
import { usePlaywrightRunner } from "./usePlaywrightRunner";

export function PlaywrightWorkspace() {
  const runner = usePlaywrightRunner();

  if (runner.loadingCatalog) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-400">
        Loading Playwright workspace...
      </div>
    );
  }

  const testGroups =
    runner.currentProject?.testGroups ?? [];

  return (
    <div className="space-y-6">
      {/* Execution Step-up Auth Password Unlock */}
      {!runner.isUnlocked && (
        <ExecutionUnlock onUnlocked={runner.refreshUnlock} />
      )}

      {/* Local Agent Heartbeat Presence Banner */}
      <AgentStatusBanner presence={runner.presence} />

      {/* Main 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left Sidebar: Controls & Test Explorer */}
        <aside className="space-y-4">
          <ProjectSelector
            projects={runner.projects}
            value={runner.selectedProjectId}
            onChange={runner.selectProject}
            disabled={runner.isJobRunning}
          />

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
        </aside>

        {/* Right Main Panel: Code Workspace & Execution */}
        <main className="space-y-4">
          <CodeWorkspace
            code={runner.editorCode}
            onChange={runner.setEditorCode}
            dirty={runner.editorDirty}
            onReset={runner.resetEditorCode}
            disabled={runner.isJobRunning}
          />

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

          <BrowserExecutionStatus results={runner.browserResults} />
        </main>
      </div>

      {/* Live Test Terminal with auto-scroll & cursor streaming */}
      <LiveTestTerminal lines={runner.terminalLines} />

      {/* Artifacts Panel (Traces, Screenshots, Videos, Reports) */}
      {runner.activeJob?.artifacts && runner.activeJob.artifacts.length > 0 && (
        <ArtifactPanel artifacts={runner.activeJob.artifacts} />
      )}

      {/* Past Executions History */}
      <JobHistory
        jobs={runner.history}
        activeJobId={runner.activeJob?.id}
        onRefresh={runner.refreshHistory}
      />
    </div>
  );
}

export default PlaywrightWorkspace;
