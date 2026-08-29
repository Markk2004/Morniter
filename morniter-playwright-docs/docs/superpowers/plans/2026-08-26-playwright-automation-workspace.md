# Playwright Automation Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the repository's task execution workflow to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Project**: Morniter  
**Feature**: Replace Production Test Runner UI with Playwright Automation Workspace  
**Target Route**: `/monitor/tests`  
**Plan Type**: Detailed implementation plan  
**Date**: 2026-08-26  

---

## 1. Objective

Transform the existing `/monitor/tests` Production Test Runner into an interactive **Playwright Automation Workspace** capable of:
- Selecting target browsers (**Chromium**, **Firefox**, **WebKit**).
- Toggling between **Headless** (CI/background) and **Headed** (visual rendering on the Local Agent host).
- Scanning existing Playwright test suites (`.spec.ts`) across projects connected to the Windows Local Agent.
- Selecting specific tests or functions to execute.
- Loading test source code into the **Code Workspace** editor.
- Running existing test files and ad-hoc workspace code.
- Streaming real-time live terminal logs with sequence cursors.
- Tracking structured progress per browser and per test.
- Harvesting artifacts: **Traces**, **Screenshots**, **Videos**, and **HTML Reports**.
- Supporting cancellation, timeouts, and execution history retention.
- Preserving critical security boundaries, step-up authorization, and secret redaction.

---

## 2. Non-Goals for Initial Release

The initial release intentionally excludes:
- Arbitrary shell terminal execution.
- Saving source code back into the permanent project repository directly from the browser UI.
- Git commit or push operations initiated from Morniter.
- AI-generated test script synthesis.
- Multi-agent scheduling and distributed worker clustering.
- Unlimited parallel test execution (initial release is 1 active job per agent).
- Remote interactive browser streaming / viewport embedding inside the web page (Headed mode launches real browser windows on the connected Windows Local Agent desktop).
- Default mutating/write operations against production targets.

---

## 3. Baseline to Preserve

Reuse existing, battle-tested infrastructure:
- Route: `/monitor/tests`
- Components: `ExecutionUnlock`, `AgentStatusBanner`, `LiveTestTerminal`, `JobHistory`, `RunProgress`, `useTestRunner`
- Backend API endpoints: `/api/test-runner/auth`, `/api/test-runner/lock`, `/api/test-runner/catalog`, `/api/test-runner/jobs`, `/api/test-runner/agent`
- Storage & Queuing: Upstash Redis queue, active job lock lease (`SET NX EX`), idempotency mapping, job logs, and sorted history
- Local Agent: Process adapter (`spawn(shell: false)`), timeout/cancel handling, Windows process-tree destruction (`taskkill`), and multi-pass secret redaction

---

## 4. High-Level Migration

```
[Current Flow]
PresetLauncher ──> { projectId, presetId } ──> Preset Resolver ──> Executable & Args

[Target Flow]
ProjectSelector + TestExplorer + BrowserSelector + CodeWorkspace
        │
        ▼
Playwright Job Contract ({ projectId, source, testIds, code, browsers, mode })
        │
        ▼
Playwright Job Validator
        │
        ▼
Workspace / Test Resolver
        │
        ▼
Fixed Playwright Command Builder (Deterministic CLI Invocation)
```

---

## 5. Phase 0 — Design & Security Contract

### Task 0.1 — Define Playwright job types
- [ ] **Step 1**: Create `src/lib/playwright-runner/types.ts`
- [ ] **Step 2**: Add shared types:
  ```ts
  export type BrowserName = "chromium" | "firefox" | "webkit";
  export type PlaywrightSource = "project-test" | "workspace";
  export type BrowserMode = "headless" | "headed";

  export interface PlaywrightJobRequest {
    projectId: string;
    source: PlaywrightSource;
    testIds?: string[];
    code?: string;
    browsers: BrowserName[];
    mode: BrowserMode;
  }
  ```
- [ ] **Step 3**: Verify no `command`, `cwd`, `args`, `env`, or absolute path fields exist in the request contract.

### Task 0.2 — Define Zod request schemas
- [ ] **Step 1**: Create `src/lib/playwright-runner/schemas.ts`
- [ ] **Step 2**: Implement strict validation rules:
  - `projectId`: Regex `/^[a-z0-9][a-z0-9-]{0,63}$/`
  - `browsers`: Array of `BrowserName` with min 1, max 3, and deduplication
  - `mode`: `"headless" | "headed"`
  - `source: "project-test"` requires `testIds` array (min 1, max 50)
  - `source: "workspace"` requires `code` string (min 1, max 200,000 bytes)
- [ ] **Step 3**: Write unit test in `tests/unit/playwright-runner/schemas.test.ts` verifying mutual exclusion and bounds.

### Task 0.3 — Agent project security config
- [ ] **Step 1**: Extend `agent/src/config.ts` with Playwright project definitions:
  ```json
  {
    "id": "projectsts",
    "name": "ProjectSTS",
    "root": "E:\\ProjectSTS",
    "playwright": {
      "enabled": true,
      "testDir": "e2e",
      "config": "playwright.config.ts",
      "allowWorkspaceExecution": true,
      "allowHeaded": true
    }
  }
  ```
- [ ] **Step 2**: Validate that `root` is absolute and `testDir`/`config` resolve strictly within `root` with no `..` traversal escapes.

### Task 0.4 — Environment policy
- [ ] **Step 1**: Create `agent/src/playwright/validator.ts` containing `buildSafeTestEnv()`.
- [ ] **Step 2**: Ensure sensitive keys (`SESSION_SIGNING_SECRET`, `GROUP_ACCESS_PASSWORD_HASH`, `TEST_RUNNER_PASSWORD_HASH`, `TEST_RUNNER_AGENT_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`, provider tokens) are explicitly blocked.
- [ ] **Step 3**: Only inject allowlisted variables (e.g., `PATH`, `NODE_ENV=test`, `PLAYWRIGHT_BROWSERS_PATH`, `STS_UAT_*`).

---

## 6. Phase 1 — Three-Browser Existing Test Runner

### Task 1.1 — Update Playwright project configuration
- [ ] **Step 1**: Update `playwright.config.ts` to declare `chromium`, `firefox`, and `webkit` device projects.

### Task 1.2 — Browser capability detection on Local Agent
- [ ] **Step 1**: Create `agent/src/playwright/capabilities.ts` to detect installed Playwright browser binaries:
  ```ts
  export interface AgentPlaywrightCapabilities {
    playwright: boolean;
    browsers: {
      chromium: boolean;
      firefox: boolean;
      webkit: boolean;
    };
    headed: boolean;
  }
  ```
- [ ] **Step 2**: Include detected capabilities in Agent heartbeat / presence payloads to Redis.

### Task 1.3 — Create `BrowserSelector` component
- [ ] **Step 1**: Create `src/components/playwright-runner/browser/BrowserSelector.tsx`
- [ ] **Step 2**: Render checkboxes for Chromium, Firefox, WebKit.
- [ ] **Step 3**: Disable checkboxes for browsers reported as not installed by the Agent.
- [ ] **Step 4**: Enforce that at least one browser is selected before submission.

### Task 1.4 — Create `RunModeSelector` component
- [ ] **Step 1**: Create `src/components/playwright-runner/browser/RunModeSelector.tsx`
- [ ] **Step 2**: Provide radio buttons for **Headless** and **Headed** modes.
- [ ] **Step 3**: Display helper notice: *"Headed mode opens browsers on the connected Local Agent machine."*

### Task 1.5 — Implement Playwright command builder
- [ ] **Step 1**: Create `agent/src/playwright/command-builder.ts`
- [ ] **Step 2**: Construct deterministic CLI arguments:
  ```ts
  export function buildPlaywrightInvocation(
    project: ResolvedPlaywrightProject,
    specPaths: string[],
    browsers: BrowserName[],
    mode: BrowserMode
  ) {
    const command = project.npxExecutable;
    const args = ["playwright", "test", ...specPaths];
    for (const browser of browsers) {
      args.push(`--project=${browser}`);
    }
    if (mode === "headed") {
      args.push("--headed");
    }
    return { command, args, cwd: project.root, env: project.safeEnvironment };
  }
  ```

### Task 1.6 — Execute via process adapter
- [ ] **Step 1**: Reuse `agent/src/process-adapter.ts` for child process spawning with `shell: false`.
- [ ] **Step 2**: Capture `stdout`/`stderr`, attach cancel signals, and invoke `taskkill` on abort/timeout.

### Task 1.7 — Extend job store model
- [ ] **Step 1**: Extend `src/lib/test-runner/store.ts` to store `source`, `browsers`, `mode`, `selectedTestIds`, and `browserResults`.

---

## 7. Phase 2 — Project Test Catalog & Explorer

### Task 2.1 — AST/Spec Test Scanner
- [ ] **Step 1**: Create `agent/src/playwright/catalog.ts`
- [ ] **Step 2**: Scan configured `testDir` for `*.spec.ts`, `*.spec.tsx`, and `*.test.ts`.
- [ ] **Step 3**: Extract test suites, test titles, line numbers, and tags.

### Task 2.2 — Path normalization & stable test descriptors
- [ ] **Step 1**: Map test files to stable IDs:
  ```ts
  export interface PlaywrightTestDescriptor {
    id: string;
    title: string;
    group: string;
    relativePath: string;
    line?: number;
  }
  ```
- [ ] **Step 2**: Ensure absolute paths are never sent to the browser client.

### Task 2.3 — Catalog publishing & API proxy
- [ ] **Step 1**: Publish discovered test suites in the Agent catalog payload to Redis.
- [ ] **Step 2**: Expose test catalog via `GET /api/test-runner/catalog`.

### Task 2.4 — Create `TestExplorer` UI
- [ ] **Step 1**: Create `src/components/playwright-runner/explorer/TestExplorer.tsx`
- [ ] **Step 2**: Render grouped collapsible test tree with search and selection checkboxes.

### Task 2.5 — Create `ProjectSelector` UI
- [ ] **Step 1**: Create `src/components/playwright-runner/project/ProjectSelector.tsx`
- [ ] **Step 2**: Handle project switching: reset selected tests, clear loaded code editor, and update capabilities.

---

## 8. Phase 3 — Code Workspace

### Task 3.1 — Editor component setup
- [ ] **Step 1**: Install / configure Monaco Editor (or CodeMirror) with Next.js dynamic imports (`ssr: false`).

### Task 3.2 — Create `CodeWorkspace` component
- [ ] **Step 1**: Create `src/components/playwright-runner/editor/CodeWorkspace.tsx`
- [ ] **Step 2**: Features: TypeScript syntax highlighting, line numbers, dirty indicator, Format, Reset, and Run Draft actions.
- [ ] **Step 3**: Maintain read-only/editable states.

### Task 3.3 — Implement source load API
- [ ] **Step 1**: Create `src/app/api/test-runner/playwright/source/route.ts`
- [ ] **Step 2**: Accept `projectId` and `testId`, verify paths inside root, and return sanitized file text content.

### Task 3.4 — Sandboxed temp workspace lifecycle
- [ ] **Step 1**: Create `agent/src/playwright/workspace.ts`
- [ ] **Step 2**: Write ad-hoc scripts to `%LOCALAPPDATA%\Morniter\runs\<jobId>\workspace.spec.ts`.
- [ ] **Step 3**: Clean up temporary files on job completion and on Agent startup.

### Task 3.5 — Workspace execution validation & bounds
- [ ] **Step 1**: Enforce max code length (200 KB), UTF-8 text encoding, null-byte rejection, and timeout caps.

### Task 3.6 — Execution environment separation
- [ ] **Step 1**: Write test confirming child processes do not receive server tokens or database URLs.

---

## 9. Phase 4 — Structured Progress & Artifacts

### Task 4.1 — Playwright progress parser
- [ ] **Step 1**: Create `agent/src/progress/playwright.ts` to parse standard Playwright CLI output.

### Task 4.2 — Custom structured reporter
- [ ] **Step 1**: Create `agent/playwright-reporter/` emitting structured JSON events (`test-begin`, `test-end`, `step-end`).

### Task 4.3 — Create `BrowserExecutionStatus` component
- [ ] **Step 1**: Create `src/components/playwright-runner/browser/BrowserExecutionStatus.tsx`
- [ ] **Step 2**: Render real-time cards showing per-browser status (`Waiting`, `Running`, `Passed`, `Failed`, duration).

### Task 4.4 — Configure Playwright artifacts capture
- [ ] **Step 1**: Configure `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, and `video: "retain-on-failure"`.

### Task 4.5 — Implement artifact manager
- [ ] **Step 1**: Create `agent/src/playwright/artifacts.ts` to index generated artifacts in `%LOCALAPPDATA%\Morniter\artifacts\<jobId>\`.
- [ ] **Step 2**: Publish artifact metadata to Redis.

### Task 4.6 — Authenticated artifact download proxy
- [ ] **Step 1**: Create `src/app/api/test-runner/playwright/artifacts/[artifactId]/route.ts`
- [ ] **Step 2**: Stream requested artifact with session verification, MIME check, and size validation.

### Task 4.7 — Artifact retention & cleanup
- [ ] **Step 1**: Create `agent/src/playwright/cleanup.ts` to purge artifacts older than 7 days (or exceeding max storage quota).

---

## 10. Phase 5 — Function Scanner (Future Phase)

### Task 5.1 — TypeScript AST scanner
- [ ] **Step 1**: Implement AST analyzer using TypeScript Compiler API to discover exported functions in project source files.

### Task 5.2 — Create `FunctionExplorer` component
- [ ] **Step 1**: Create `src/components/playwright-runner/explorer/FunctionExplorer.tsx` to list discoverable functions.

### Task 5.3 — Auto-generate test skeletons
- [ ] **Step 1**: Generate starting Playwright test boilerplate templates when selecting functions without spec files.

---

## 11. Phase 6 — Security Hardening

### Task 6.1 — Low-privilege Agent account
- [ ] **Step 1**: Document running the Local Agent under a dedicated Windows user with read-only project access and write-only temp workspace access.

### Task 6.2 — Production target guard
- [ ] **Step 1**: Enforce `workspaceExecution = false` for environments marked as `production`.

### Task 6.3 — Network policy & audit logging
- [ ] **Step 1**: Restrict child process outbound network connections to allowlisted base URLs.
- [ ] **Step 2**: Record structured audit logs for all test run requests (without secrets).

---

## 12. Frontend Refactor Steps

- [ ] **Step A**: Create `src/components/playwright-runner/PlaywrightWorkspace.tsx`.
- [ ] **Step B**: Replace `<TestRunnerPanel />` in `src/app/monitor/tests/page.tsx` with `<PlaywrightWorkspace />`.
- [ ] **Step C**: Keep existing shared components: `<ExecutionUnlock />`, `<AgentStatusBanner />`, `<LiveTestTerminal />`, `<JobHistory />`.
- [ ] **Step D**: Replace `<PresetLauncher />` with `<ProjectSelector />`, `<TestExplorer />`, `<BrowserSelector />`, `<RunModeSelector />`, `<CodeWorkspace />`, `<ExecutionToolbar />`, and `<ArtifactPanel />`.

---

## 13. Hook Refactor: `usePlaywrightRunner`

- [ ] **Step 1**: Create `src/components/playwright-runner/usePlaywrightRunner.ts`
- [ ] **Step 2**: State definition:
  ```ts
  export interface UsePlaywrightRunnerResult {
    catalog: PlaywrightCatalog | null;
    presence: AgentPresence | null;
    isUnlocked: boolean;
    selectedProjectId: string | null;
    selectedTestIds: string[];
    selectedBrowsers: BrowserName[];
    runMode: RunMode;
    editorCode: string;
    editorDirty: boolean;
    activeJob: PlaywrightJob | null;
    terminalLines: TestLogLine[];
    history: PlaywrightJob[];
    loadingCatalog: boolean;
    isSubmitting: boolean;
    isJobRunning: boolean;

    selectProject(id: string): void;
    toggleTest(id: string): void;
    toggleBrowser(browser: BrowserName): void;
    setRunMode(mode: RunMode): void;
    setEditorCode(code: string): void;
    loadTestSource(testId: string): Promise<void>;
    run(): Promise<boolean>;
    cancelActiveJob(): Promise<boolean>;
    refreshCatalog(): Promise<void>;
    refreshHistory(): Promise<void>;
    refreshUnlock(): Promise<void>;
  }
  ```

---

## 14. API & Redis Migration (v3 Namespace)

- [ ] **Step 1**: Update `POST /api/test-runner/jobs` to support discriminated union: `LegacyPresetJob | PlaywrightJob`.
- [ ] **Step 2**: Use Redis key namespace `monitor:test-runner:v3:*` to avoid colliding with legacy job structures during rollout.
- [ ] **Step 3**: Deprecate legacy preset payload handlers once migration is complete.

---

## 15. Testing & Verification Matrix

### Unit Tests
- **Frontend**: `BrowserSelector.test.tsx`, `RunModeSelector.test.tsx`, `TestExplorer.test.tsx`, `CodeWorkspace.test.tsx`, `usePlaywrightRunner.test.ts`
- **Server**: Zod schemas, execution step-up lock, mutual exclusion, bounds checking, idempotency
- **Agent**: `resolveInsideRoot`, `buildPlaywrightInvocation`, `buildSafeTestEnv`, workspace creation, process cancellation, artifact harvesting

### Integration Tests
- Enqueue Playwright job → Redis claim → Running status → Log streaming → Completed status
- Cancellation signal → Process tree killed (`taskkill`) → Cancelled state
- Timeout expiration → `timed_out` state
- Artifact metadata query → Authenticated stream response

### UI End-to-End Tests (`e2e/playwright-workspace.spec.ts`)
- Locked state → Unlock execution → Select ProjectSTS → Pick Chromium + Firefox → Headed → Run → Stream logs → Passed → Artifacts visible

---

## 16. Explicit Failure State Handling

| Failure Scenario | Expected UI Behavior |
|---|---|
| **Agent Offline** | Run button disabled; banner shows Agent Offline with last heartbeat |
| **Browser Not Installed** | Checkbox disabled with `(not installed)` badge |
| **No Browser Selected** | Validation error alert; Run blocked |
| **Test Deleted After Catalog Scan** | Refresh catalog notice; clean failure message |
| **TypeScript Syntax Error** | Red error banner in Live Terminal with line/column pointers |
| **Browser Crash / Launch Failure** | Browser execution status marked `Failed`; error streamed to terminal |
| **Test Timeout** | Job status set to `timed_out`; process tree terminated |
| **Agent Stops Mid-Run** | Lease expires; job marked failed due to agent disconnect |
| **Artifact Unavailable / Missing** | Job result displayed normally; artifact link indicates expired/missing |
| **Production Target Blocked** | Enqueue rejected with clear safety warning |

---

## 17. Staged Rollout Plan

- **Rollout 1**: Internal Developer — Existing tests, Chromium only, Headless mode.
- **Rollout 2**: Multi-Browser — Firefox and WebKit enabled, Headed mode activated.
- **Rollout 3**: Test Explorer — Automatic AST/spec discovery and source loader.
- **Rollout 4**: Code Workspace — In-browser editor and temporary workspace execution.
- **Rollout 5**: Rich Artifacts & Function Scanner — Traces, screenshots, video player, and function templates.

---

## 18. Rollback Strategy & Feature Flags

Environment flags:
- `PLAYWRIGHT_WORKSPACE_ENABLED=true`
- `PLAYWRIGHT_WORKSPACE_CODE_ENABLED=true`
- `PLAYWRIGHT_HEADED_ENABLED=true`

If issues occur, disable feature flags to revert to legacy PresetLauncher seamlessly without data loss.

---

## 19. Post-Implementation Documentation Checklist

- [ ] Update `README.md` with new workflow, commands, and environment setups.
- [ ] Update `ARCHITECTURE.md` with Playwright workspace architecture and trust boundaries.
- [ ] Update `CONTEXT.md` to reflect controlled user-authored test execution.
- [ ] Update `agent/test-runner.config.example.json` with project roots and Playwright configurations.

---

## 20. Final Acceptance Checklist

### Product & UX
- [ ] Project can be selected from dropdown.
- [ ] Test Explorer discovers and lists all `.spec.ts` files.
- [ ] Chromium, Firefox, and WebKit are independently selectable.
- [ ] Unavailable browsers are clearly disabled.
- [ ] Headless and Headed modes operate as specified (Headed launches on Agent screen).
- [ ] Existing tests and workspace draft scripts execute successfully.
- [ ] Terminal streams live logs continuously.
- [ ] Cancel and Timeout terminate the process tree reliably.
- [ ] Results and history are recorded per browser.
- [ ] Traces, Screenshots, Videos, and Reports are downloadable.

### Security & Invariants
- [ ] No raw shell commands accepted over HTTP.
- [ ] No client-specified working directories or absolute paths accepted.
- [ ] Project allowlisting and path containment enforced.
- [ ] Child test process environment stripped of all server secrets.
- [ ] Multi-pass log redaction active on all streams.
- [ ] Temporary workspaces isolated in `%LOCALAPPDATA%\Morniter\runs\<jobId>\` and purged.
- [ ] Mutating production runs denied by default.

### Quality & Performance
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run lint` passes.
- [ ] Unit, Integration, and E2E test suites pass.
- [ ] Manual verification in Windows Headed mode successful.
