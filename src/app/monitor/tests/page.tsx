import React from "react";
import TestRunnerPanel from "@/components/test-runner/TestRunnerPanel";

export default function TestRunnerPage() {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-800/80">
        <h1 className="text-xl font-bold tracking-tight text-white">Playwright Automation Workspace</h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Build, execute and inspect browser automation tests via Windows Local Agent
        </p>
      </div>

      <TestRunnerPanel />
    </div>
  );
}
