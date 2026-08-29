# Playwright Automation Workspace Design

**Status**: Proposed Architecture Specification  
**Route**: `/monitor/tests`  
**Repository**: `Markk2004/Morniter`  
**Date**: 2026-08-26  

---

## 1. Overview & Objectives

Transform `/monitor/tests` from a preset-driven test execution runner into an interactive **Playwright Automation Workspace**. The workspace empowers developers and QA engineers to:
1. Select any combination of **Chromium**, **Firefox**, and **WebKit** using checkboxes.
2. Toggle between **Headless** (automated background execution) and **Headed** (visual browser execution rendering on the Windows Local Agent machine).
3. Automatically scan, discover, and group Playwright `.spec.ts` test files and exported functions.
4. Author, edit, format, and execute custom Playwright scripts inside a sandboxed **Code Workspace**.
5. Stream real-time logs through a sequence-cursor **Live Terminal**.
6. Inspect execution metrics and download/view **Traces**, **Screenshots**, **Videos**, and **HTML Reports**.
7. Retain existing security invariants: **Execution Unlock** (15-min JWT session), **Agent Bearer Token**, **Redis queueing**, and **Multi-Pass Redaction**.

---

## 2. Trust Boundaries & Isolation Model

```
[Browser Client]
       │
       │  Boundary A: Untrusted HTTP Input (Strict Zod validation)
       ▼
[Next.js Server]
       │
       │  Boundary B: Authorized Queue & State (Upstash Redis)
       ▼
[Upstash Redis]
       │
       │  Boundary C: Authenticated Agent Polling (Timing-Safe Token)
       ▼
[Windows Local Agent]
       │
       │  Boundary D: Sandboxed OS Execution Boundary (Safe childEnv, shell: false)
       ▼
[Playwright Child Process]
```

### Critical Security Invariants:
- **No Server Execution**: `eval(code)` and `new Function(code)` are strictly prohibited on Next.js server processes.
- **Dedicated Temp Workspace**: Workspace code is written to `%LOCALAPPDATA%\Morniter\runs\<jobId>\workspace.spec.ts` and never committed or written into project repositories.
- **Fixed Binary & Command Construction**: Commands are constructed deterministically by the Local Agent; raw shell commands are never accepted.
- **Environment Isolation**: Server secrets, database tokens, and provider credentials are excluded from the test environment.
- **Process Tree Destruction**: Cancellations and timeouts invoke native `taskkill.exe /PID <pid> /T /F`.

---

## 3. UI Component Architecture

```
src/components/playwright-runner/
├── PlaywrightWorkspace.tsx        # Main orchestration container
├── usePlaywrightRunner.ts         # Hook managing polling, active jobs, and state
├── project/
│   ├── ProjectSelector.tsx        # Dropdown to select active project
│   └── AgentProjectStatus.tsx     # Display agent presence and browser capabilities
├── explorer/
│   ├── TestExplorer.tsx           # Tree view of test files and suites
│   ├── TestGroup.tsx              # Category/Group accordions
│   ├── TestItem.tsx               # Individual test case selector
│   └── FunctionExplorer.tsx       # AST-extracted testable functions
├── browser/
│   ├── BrowserSelector.tsx        # Checkboxes for Chromium, Firefox, WebKit
│   ├── RunModeSelector.tsx        # Toggle Headless vs Headed
│   └── BrowserExecutionStatus.tsx # Per-browser status cards
├── editor/
│   ├── CodeWorkspace.tsx          # Monaco / CodeMirror editor
│   ├── EditorToolbar.tsx          # Format, Reset, Save Draft, Run actions
│   └── default-template.ts        # Boilerplate test templates
├── execution/
│   ├── ExecutionToolbar.tsx       # Run / Cancel controls
│   ├── RunProgress.tsx            # Multi-browser progress meters
│   ├── PlaywrightTerminal.tsx     # Live terminal log stream
│   └── JobHistory.tsx             # List of recent execution runs
└── artifacts/
    ├── ArtifactPanel.tsx          # Artifact container tabs
    ├── TraceArtifact.tsx          # Playwright trace viewer link
    ├── ScreenshotArtifact.tsx     # Failure screenshot viewer
    ├── VideoArtifact.tsx          # WebM session recording player
    └── ReportArtifact.tsx         # HTML report viewer
```

---

## 4. Backend API Endpoints

- `GET /api/test-runner/catalog`: Returns agent presence, browser capabilities, and discovered project test suites.
- `GET /api/test-runner/playwright/source?projectId=X&testId=Y`: Loads authorized test file source for inspection in the Code Workspace.
- `POST /api/test-runner/jobs`: Enqueues an existing test suite or ad-hoc workspace code execution.
- `GET /api/test-runner/jobs/:jobId`: Returns job status, per-browser results, and cursor-paged log stream (`?afterSequence=N`).
- `POST /api/test-runner/jobs/:jobId/cancel`: Signals cancellation of active test execution.
- `GET /api/test-runner/playwright/artifacts/:artifactId`: Authenticated stream / download endpoint for traces, screenshots, videos, and reports.

---

## 5. Local Agent Subsystems

- `agent/src/playwright/catalog.ts`: Discovers `.spec.ts` files, parses test titles, extracts tags, and generates path-safe test IDs.
- `agent/src/playwright/validator.ts`: Validates project IDs, browser enums, code size limits, and path boundaries.
- `agent/src/playwright/workspace.ts`: Manages temporary workspace lifecycle in `%LOCALAPPDATA%\Morniter\runs\<jobId>`.
- `agent/src/playwright/command-builder.ts`: Assembles deterministic `playwright test` CLI invocations.
- `agent/src/playwright/runner.ts`: Spawns child test processes, streams output batches, and manages cancellation.
- `agent/src/playwright/result-parser.ts`: Parses structured JSON reporter events for browser/test progress.
- `agent/src/playwright/artifacts.ts`: Discovers generated trace files, screenshots, and videos.
- `agent/src/playwright/cleanup.ts`: Purges expired temporary workspaces and artifact storage.
