"use client";

import React from "react";
import { useTestRunner } from "./useTestRunner";
import { ExecutionUnlock } from "./ExecutionUnlock";
import { AgentStatusBanner } from "./AgentStatusBanner";
import { PresetLauncher } from "./PresetLauncher";
import { RunProgress } from "./RunProgress";
import { LiveTestTerminal } from "./LiveTestTerminal";
import JobHistory from "./JobHistory";

export function TestRunnerWorkspace() {
  const {
    catalog,
    presence,
    isUnlocked,
    activeJob,
    terminalLines,
    history,
    loadingCatalog,
    isSubmitting,
    actionError,
    isJobRunning,
    createJob,
    cancelJob,
    refreshHistory,
  } = useTestRunner();

  if (loadingCatalog) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-400">
        Loading test runner workspace...
      </div>
    );
  }

  const isAgentOnline = presence?.state === "online";

  return (
    <div className="space-y-8">
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-mono text-rose-300 flex items-center justify-between">
          <span>{actionError}</span>
        </div>
      )}

      {/* Execution Step-Up Lock Card */}
      {!isUnlocked && <ExecutionUnlock onUnlocked={() => window.location.reload()} />}

      {/* Agent Presence Banner */}
      <AgentStatusBanner presence={presence} />

      {/* Preset Launcher Shortcuts */}
      <PresetLauncher
        catalog={catalog}
        activeJob={activeJob}
        isUnlocked={isUnlocked}
        isAgentOnline={isAgentOnline}
        isJobRunning={isJobRunning}
        isSubmitting={isSubmitting}
        onRunPreset={createJob}
      />

      {/* Active Job Progress */}
      <RunProgress activeJob={activeJob} onCancelJob={cancelJob} isSubmitting={isSubmitting} />

      {/* Live Log Terminal */}
      <LiveTestTerminal lines={terminalLines} />

      {/* Execution History */}
      <JobHistory history={history} onRefresh={refreshHistory} />
    </div>
  );
}

export default TestRunnerWorkspace;
