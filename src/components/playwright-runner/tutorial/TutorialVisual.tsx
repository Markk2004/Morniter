import React from "react";
import type { TutorialVisualKind } from "./tutorial-steps";

interface TutorialVisualProps {
  kind: TutorialVisualKind;
}

export default function TutorialVisual({ kind }: TutorialVisualProps) {
  return (
    <div
      data-tutorial-visual={kind}
      data-testid={`tutorial-visual-${kind}`}
      aria-hidden="true"
      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 shadow-md select-none"
    >
      {renderDiagram(kind)}
    </div>
  );
}

function renderDiagram(kind: TutorialVisualKind) {
  switch (kind) {
    case "agent":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-400 text-xs">ONLINE</span>
              <span className="text-slate-400 text-[11px]">· windows-local-agent-1</span>
            </div>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              v1.2.0
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded bg-slate-900 p-2 border border-slate-800/60">
              <div className="text-slate-400 text-[10px]">Workspace Root</div>
              <div className="truncate text-slate-200">E:\ProjectSTS</div>
            </div>
            <div className="rounded bg-slate-900 p-2 border border-slate-800/60">
              <div className="text-slate-400 text-[10px]">Heartbeat / Latency</div>
              <div className="text-slate-200">12ms · Just now</div>
            </div>
          </div>
          <div className="rounded bg-slate-900 border border-slate-800/80 p-2 text-[11px] font-mono">
            <div className="text-slate-400 text-[10px] mb-1 font-sans">Terminal คำสั่งเปิด Agent:</div>
            <div className="text-indigo-300">$ npm run test-agent:build</div>
            <div className="text-indigo-300">$ npm run test-agent</div>
          </div>
        </div>
      );

    case "lock":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans font-medium text-[11px]">Group Execution Guard</span>
            <span className="rounded bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 text-[10px] text-amber-300">
              15 Min Session
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-400 tracking-widest text-sm">
              ••••••••••••
            </div>
            <div className="rounded bg-indigo-600 px-3 py-1.5 font-sans font-semibold text-white text-[11px]">
              Unlock
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-sans">
            Authentication unlocks execution capabilities without storing plain credentials.
          </div>
        </div>
      );

    case "project":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans font-medium text-[11px]">Selected Project Catalog</span>
            <span className="rounded bg-indigo-950 border border-indigo-800/60 px-2 py-0.5 text-[10px] text-indigo-300">
              34 Tests Available
            </span>
          </div>
          <div className="rounded border border-indigo-500/40 bg-slate-900 p-2.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-indigo-300 text-xs">STS Playwright Automation</div>
              <div className="text-[10px] text-slate-400">Target: UAT Environment · Revision: #a8f19c</div>
            </div>
            <span className="text-slate-400 text-xs">▼</span>
          </div>
        </div>
      );

    case "test":
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans font-medium text-[11px]">Test Explorer Selection</span>
            <span className="text-[10px] text-indigo-400">2 tests selected</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center space-x-2 rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
              <span className="text-indigo-400">☑</span>
              <span className="text-slate-200">auth/login-admin.spec.ts</span>
              <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-400">E2E</span>
            </div>
            <div className="flex items-center space-x-2 rounded bg-slate-900 px-2.5 py-1.5 border border-slate-800">
              <span className="text-indigo-400">☑</span>
              <span className="text-slate-200">students/create-record.spec.ts</span>
              <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-400">E2E</span>
            </div>
            <div className="flex items-center space-x-2 rounded bg-slate-950 px-2.5 py-1.5 border border-slate-800/50 opacity-60">
              <span className="text-slate-500">☐</span>
              <span className="text-slate-400">reports/export-monthly.spec.ts</span>
              <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-500">E2E</span>
            </div>
          </div>
        </div>
      );

    case "browser":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans font-medium text-[11px]">Target Browsers</span>
            <span className="text-[10px] text-emerald-400">Headless Mode</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded border border-indigo-500 bg-indigo-950/60 p-2 text-indigo-200 font-medium">
              <div>Chromium</div>
              <div className="text-[9px] text-indigo-400 mt-0.5">Active</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900 p-2 text-slate-400">
              <div>Firefox</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Optional</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900 p-2 text-slate-400">
              <div>WebKit</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Optional</div>
            </div>
          </div>
        </div>
      );

    case "code":
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 text-[10px]">editor: login-admin.spec.ts</span>
            <span className="text-[10px] text-slate-400">TypeScript · Playwright Test</span>
          </div>
          <div className="rounded bg-slate-900 p-2 space-y-1 text-[11px] leading-relaxed">
            <div className="text-slate-400">
              <span className="text-slate-400 mr-2">1</span>
              <span className="text-purple-400">import</span> &#123; test, expect &#125; <span className="text-purple-400">from</span> <span className="text-emerald-300">&apos;@playwright/test&apos;</span>;
            </div>
            <div className="text-slate-400">
              <span className="text-slate-400 mr-2">2</span>
              test(<span className="text-emerald-300">&apos;admin login&apos;</span>, <span className="text-purple-400">async</span> (&#123; page &#125;) =&gt; &#123;
            </div>
            <div className="bg-indigo-950/80 -mx-2 px-2 py-0.5 rounded border-l-2 border-indigo-400 text-indigo-200">
              <span className="text-indigo-400 mr-2">3</span>
              <span className="text-purple-400">await</span> page.goto(<span className="text-emerald-300">&apos;https://uat.projectsts.example/login&apos;</span>);
            </div>
            <div className="text-slate-400">
              <span className="text-slate-400 mr-2">4</span>
              &#125;);
            </div>
          </div>
        </div>
      );

    case "run":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans font-medium text-[11px]">Execution Lifecycle</span>
            <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] text-emerald-300">
              Running
            </span>
          </div>
          <div className="flex items-center justify-between space-x-2 text-[10px]">
            <div className="flex-1 rounded bg-slate-900 border border-slate-800 p-2 text-center">
              <div className="text-slate-400">1. Queued</div>
              <div className="text-emerald-400 font-bold mt-0.5">✓ Ready</div>
            </div>
            <span className="text-slate-400">→</span>
            <div className="flex-1 rounded bg-indigo-950 border border-indigo-700 p-2 text-center text-indigo-200">
              <div className="text-indigo-300 font-bold">2. Running</div>
              <div className="text-indigo-400 text-[9px] mt-0.5">Chromium (1/1)</div>
            </div>
            <span className="text-slate-400">→</span>
            <div className="flex-1 rounded bg-slate-900 border border-slate-800 p-2 text-center text-slate-400">
              <div>3. Results</div>
              <div className="text-[9px] mt-0.5">Artifacts</div>
            </div>
          </div>
        </div>
      );

    case "terminal":
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-[10px]">
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-slate-400 font-semibold ml-1">Live Execution Logs</span>
            </div>
            <span className="text-emerald-400 font-mono text-[10px]">Streaming</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="text-slate-400 font-mono">
              <span className="text-cyan-400">[system]</span> 00:01 Claimed job job-playwright-8921
            </div>
            <div className="text-slate-200 font-mono">
              <span className="text-indigo-400">[stdout]</span> Running 2 tests using 1 worker
            </div>
            <div className="text-emerald-300 font-mono">
              <span className="text-emerald-400">[stdout]</span> ✓ login-admin.spec.ts:3:1 (1.8s)
            </div>
          </div>
        </div>
      );

    case "result":
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans font-medium text-[11px]">Run Summary &amp; Artifacts</span>
            <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] text-emerald-300">
              PASSED (2.4s)
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between rounded bg-slate-900 px-3 py-1.5 border border-slate-800">
              <span className="text-slate-200">Chromium Execution</span>
              <span className="text-emerald-400 font-semibold">2 / 2 Passed</span>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-900 px-3 py-1.5 border border-slate-800">
              <span className="text-slate-400">Playwright HTML Report</span>
              <span className="text-indigo-300 font-medium">Download Trace</span>
            </div>
          </div>
        </div>
      );
  }
}
