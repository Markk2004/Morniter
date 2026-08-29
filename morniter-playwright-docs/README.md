# Morniter Playwright Automation Workspace — Developer Documentation

**Status**: Proposed architecture / implementation specification  
**Target Route**: `/monitor/tests`  
**Target Repository**: `Markk2004/Morniter`  
**Date**: 2026-08-26  

---

## 1. Purpose

This document outlines the architectural transformation of `/monitor/tests` from a preset-driven test runner into an interactive **Playwright Automation Workspace** capable of:

- Selecting target browsers (**Chromium**, **Firefox**, **WebKit**) via a multi-select checklist.
- Toggling execution mode between **Headless** (background CI speed) and **Headed** (visual browser rendering on the Windows Local Agent).
- Loading and discovering existing Playwright test suites (`.spec.ts`) across configured projects.
- Selecting specific test cases or functions to execute.
- Authoring, editing, and formatting ad-hoc Playwright scripts in an embedded **Code Workspace**.
- Executing tests securely via the **Windows Local Agent**.
- Streaming live `stdout`/`stderr`/`system` logs with sequence cursors to the **Live Terminal**.
- Supporting instant test cancellation and automatic timeout handling.
- Inspecting pass/fail results broken down by browser and test group.
- Collecting and viewing rich execution artifacts: **Traces**, **Screenshots**, **Videos**, and **HTML Reports**.
- Maintaining execution job history and logs in Upstash Redis.
- Preserving critical security guardrails: **Execution Step-Up Unlock** (15-min JWT session), **Agent Bearer Token**, **Redis FIFO Queuing**, and **Multi-Pass Log Redaction**.

---

## 2. Baseline Architecture vs Target

### Current Frontend Pipeline
```
src/app/monitor/tests/page.tsx
        │
        ▼
TestRunnerPanel
        │
        ▼
TestRunnerWorkspace
        │
        ├─ ExecutionUnlock
        ├─ AgentStatusBanner
        ├─ PresetLauncher
        ├─ RunProgress
        ├─ LiveTestTerminal
        └─ JobHistory
```

### Current State Management (`useTestRunner.ts`)
- Manages execution unlock status (`monitor:execute` session).
- Handles agent catalog, presence heartbeat, and connection status.
- Tracks active job polling (1s active, 5s idle).
- Renders sequence-based terminal log stream (retaining last 1,000 lines).
- Creates and cancels jobs.

### Current Backend API Structure
```
src/app/api/test-runner/
├── agent/       # Agent heartbeat polling, log batch ingestion, job completion
├── auth/        # Execution step-up authentication (15m JWT cookie)
├── catalog/     # Read-only project & test catalog query
├── jobs/        # Enqueue job, fetch status/logs, cancel active job
└── lock/        # Execution lock / session termination
```

### Current Playwright Setup
Morniter has internal E2E tests (`e2e/`, `playwright.config.ts`), configured primarily for Chromium. The new architecture expands execution capabilities to multi-browser test execution (Chromium, Firefox, WebKit) across local projects.

---

## 3. Target Product & Navigation

- **Module Name**: Playwright Automation Workspace *(or Automation Testing Workspace)*
- **Subtitle**: *Build, execute and inspect browser automation tests*
- **Route**: `/monitor/tests`

---

## 4. Target User Flow

```
1. Open /monitor/tests
       │
2. Verify Execution Unlock (Enter execution password if locked)
       │
3. Check Agent Status (Online / Lagging / Offline)
       │
4. Select Project (e.g., ProjectSTS)
       │
5. Agent Scans & Publishes Test Catalog
       │
6. User Selects:
   ├── Existing Playwright Test (*.spec.ts)
   ├── Extracted Function / Step
   └── Workspace Code Editor (Draft / Custom Script)
       │
7. Select Browsers (☑ Chromium, ☑ Firefox, ☐ WebKit)
       │
8. Select Mode (○ Headless, ● Headed)
       │
9. Review / Edit / Format Script in Code Workspace
       │
10. Click [Run ▶]
       │
11. Server validates payload (Zod schema, bounds, auth)
       │
12. Redis enqueues job (FIFO, concurrency limit)
       │
13. Windows Local Agent claims job
       │
14. Agent prepares sandboxed execution workspace (%LOCALAPPDATA%\Morniter\runs\<jobId>)
       │
15. Playwright launches browser(s) (Headed renders on Agent screen)
       │
16. Test steps execute
       │
17. stdout/stderr streams to Live Terminal in real time
       │
18. Progress updates per browser (Chromium passed, Firefox running, WebKit skipped)
       │
19. Execution completes (Exit code evaluated, artifacts harvested)
       │
20. Job status recorded (passed / failed / cancelled / timed_out)
       │
21. Artifact links available ([Trace] [Screenshot] [Video] [HTML Report])
       │
22. Execution logged in Job History
```

---

## 5. Proposed UI Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Playwright Automation                                               │
│ Build, execute and inspect browser automation tests                 │
├──────────────────────────────────────────────────────────────────────┤
│ Agent: ● Online           Project: ProjectSTS        Execution: 🔓   │
├───────────────────────┬──────────────────────────────────────────────┤
│ TEST EXPLORER         │ CODE WORKSPACE                               │
│                       │                                              │
│ Authentication        │ import { test, expect } from "@playwright/test";
│ ☑ Login               │                                              │
│ ☐ Logout              │ test("Login Flow", async ({ page }) => {     │
│                       │   await page.goto("/login");                 │
│ Student Records       │   await page.fill("#user", "admin");         │
│ ☑ Create Student      │   await page.click("button[type=submit]");   │
│ ☐ Search Student      │   await expect(page).toHaveURL("/dashboard");│
│                       │ });                                          │
│                       │ [Format] [Reset] [Save Draft] [Run ▶]       │
├───────────────────────┼──────────────────────────────────────────────┤
│ BROWSERS              │ EXECUTION                                    │
│ ☑ Chromium            │ Chromium  ● Running                         │
│ ☑ Firefox             │ Firefox   ○ Waiting                         │
│ ☐ WebKit              │ WebKit    - Not selected                    │
│                       │                                              │
│ MODE                  │ Current test: Login Flow                     │
│ ○ Headless            │ Progress: 1 / 2 browsers complete            │
│ ● Headed              │                                              │
├───────────────────────┴──────────────────────────────────────────────┤
│ LIVE TERMINAL                                                        │
│ [chromium] [system] Preparing temporary workspace...                │
│ [chromium] [launch] Launching Chromium (headed)...                  │
│ [chromium] [stdout] ✓ Login with valid credentials (1.2s)           │
│ [firefox]  [launch] Launching Firefox (headed)...                   │
├──────────────────────────────────────────────────────────────────────┤
│ RESULT / ARTIFACTS                                                   │
│ 2 passed | 0 failed | 8.4 sec                                       │
│ [Trace] [Screenshot] [Video] [HTML Report]                          │
├──────────────────────────────────────────────────────────────────────┤
│ HISTORY                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Proposed Frontend Structure

```
src/components/playwright-runner/
├── PlaywrightWorkspace.tsx        # Main container & coordinator
├── usePlaywrightRunner.ts         # Hook: Polling, execution, state machine
│
├── project/
│   ├── ProjectSelector.tsx        # Dropdown to pick active project
│   └── AgentProjectStatus.tsx     # Display agent health & capabilities
│
├── explorer/
│   ├── TestExplorer.tsx           # Tree view of spec files & test suites
│   ├── TestGroup.tsx              # Grouping component (Authentication, Records)
│   ├── TestItem.tsx               # Individual test item with checkbox/action
│   └── FunctionExplorer.tsx       # AST-extracted testable functions
│
├── browser/
│   ├── BrowserSelector.tsx        # Checkboxes for Chromium, Firefox, WebKit
│   ├── RunModeSelector.tsx        # Toggle Headless vs Headed
│   └── BrowserExecutionStatus.tsx # Per-browser progress and pass/fail badges
│
├── editor/
│   ├── CodeWorkspace.tsx          # Code editor (Monaco / CodeMirror)
│   ├── EditorToolbar.tsx          # Format, Reset, Save Draft, Run buttons
│   └── default-template.ts        # Boilerplate Playwright script templates
│
├── execution/
│   ├── ExecutionToolbar.tsx       # Run / Cancel / Step-up unlock triggers
│   ├── RunProgress.tsx            # Multi-browser progress indicators
│   ├── PlaywrightTerminal.tsx     # Sequence-based terminal log renderer
│   └── JobHistory.tsx             # List of recent execution runs
│
└── artifacts/
    ├── ArtifactPanel.tsx          # Container for job artifacts
    ├── TraceArtifact.tsx          # Playwright trace viewer link
    ├── ScreenshotArtifact.tsx     # Failure screenshots modal/lightbox
    ├── VideoArtifact.tsx          # Recorded browser interaction video
    └── ReportArtifact.tsx         # Playwright HTML report view
```

---

## 7. Backend API Architecture

### Endpoints (Reusing & Extending `/api/test-runner/*`)
```
/api/test-runner/
├── auth/            # POST login / step-up execution session
├── lock/            # POST/DELETE execution unlock
├── agent/
│   ├── poll/        # Local Agent polling & heartbeat
│   └── jobs/[id]/
│       ├── logs/    # Stream log batch ingestion
│       └── complete/# Final job exit code and artifact metadata
├── catalog/         # Read aggregated project & test catalog
├── jobs/
│   ├── route.ts     # Enqueue new test run job
│   └── [jobId]/
│       ├── route.ts # Get job details & cursor logs (?afterSequence=N)
│       └── cancel/  # Cancel active test run
└── playwright/
    ├── source/      # Read spec source for a specific testId
    └── artifacts/   # Download / stream test traces and media
```

---

## 8. Contracts & Data Schemas

### Existing Test Run Request
```ts
export interface ExistingPlaywrightRunRequest {
  projectId: string;
  source: "project-test";
  testIds: string[];
  browsers: ("chromium" | "firefox" | "webkit")[];
  mode: "headless" | "headed";
}
```

### Workspace Code Run Request
```ts
export interface WorkspacePlaywrightRunRequest {
  projectId: string;
  source: "workspace";
  code: string;
  browsers: ("chromium" | "firefox" | "webkit")[];
  mode: "headless" | "headed";
}
```

### Test Catalog Schema
```ts
export interface PlaywrightCatalog {
  version: string;
  updatedAt: string;
  projects: PlaywrightProjectCatalog[];
}

export interface PlaywrightProjectCatalog {
  id: string;
  name: string;
  rootLabel: string;
  tests: PlaywrightTestDescriptor[];
}

export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  line?: number;
  tags?: string[];
}
```

---

## 9. Local Agent Architecture & Module Layout

```
agent/src/playwright/
├── catalog.ts           # Discovers *.spec.ts, normalizes test IDs, prevents traversal
├── source-reader.ts     # Safely reads spec source within project root
├── validator.ts         # Validates browser allowlists, modes, limits, code sizes
├── workspace.ts         # Prepares sandboxed temp directories (%LOCALAPPDATA%\Morniter\runs\<jobId>)
├── command-builder.ts   # Assembles fixed Playwright CLI command without raw shell inputs
├── runner.ts            # Executes child process via process-adapter, streams logs, handles cancel/timeout
├── artifacts.ts         # Discovers, indexes, and authorizes artifact files
├── result-parser.ts     # Parses Playwright reporter output for per-browser/test metrics
└── cleanup.ts           # Cleans temp workspaces and purges expired artifacts
```

---

## 10. Code Workspace Security & Isolation Invariants

> [!CAUTION]
> Allowing user-authored TypeScript/JavaScript execution introduces arbitrary code execution risks. The following controls are mandatory invariants:

1. **Zero Server Execution**: `eval(code)` and `new Function(code)` are strictly prohibited on Next.js. Server-side compilation is disabled.
2. **Dedicated Temporary Workspaces**: Ad-hoc code is written to `%LOCALAPPDATA%\Morniter\runs\<jobId>\workspace.spec.ts`. Ad-hoc code is **never** committed or written into the permanent project repository.
3. **Strict Parameter Allowlisting**: Executable paths, shell parameters, and working directories are derived solely by the Agent.
4. **Environment Isolation**: Server secrets (`SESSION_SIGNING_SECRET`, `TEST_RUNNER_AGENT_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`, provider keys) are completely omitted from child process environments.
5. **Process-Tree Termination**: Cancellations and timeouts trigger native Windows process destruction (`taskkill.exe /PID <pid> /T /F`).
6. **Multi-Pass Redaction**: All stdout/stderr outputs are stripped of secrets, database URLs, and bearer tokens before storage or UI streaming.

---

## 11. Delivery Roadmap

- **Phase 0 — Safety & Contract Design**: Define schemas, environment policies, temp workspace rules, and production guards.
- **Phase 1 — Existing Playwright Test Execution**: Multi-browser selection, headless/headed toggle, execution of existing `.spec.ts` files, live terminal streaming, cancel/timeout handling.
- **Phase 2 — Test Explorer**: AST/spec file scanner, test grouping, test-to-source loader.
- **Phase 3 — Code Workspace**: Embedded editor (Monaco/CodeMirror), draft persistence, temp workspace execution with size/timeout bounds.
- **Phase 4 — Artifacts & Rich Results UX**: Browser-level status cards, traces, screenshots, video player, HTML report viewer.
- **Phase 5 — Function Scanner**: TypeScript AST extraction of exported testable functions and auto-scaffolding.
- **Phase 6 — Hardening**: Sandboxing, low-privilege OS accounts, network egress restrictions, automated cleanup recovery.

---

## 12. Definition of Done

A release is considered complete when:
- Users can select any combination of Chromium, Firefox, and WebKit.
- Users can toggle Headless vs Headed mode (with Headed opening visually on the Local Agent host).
- Agent successfully discovers and lists existing Playwright test files.
- Users can select and execute individual or grouped tests.
- Live Terminal streams real-time stdout/stderr logs.
- Cancel and Timeout reliably terminate the entire process tree.
- Results are reported per browser with pass/fail counts.
- Failed tests produce downloadable Traces, Screenshots, and Videos.
- Workspace code executes strictly in isolated agent temp folders without touching server processes or repository files.
- All unit, integration, and E2E test suites pass with zero regressions.
