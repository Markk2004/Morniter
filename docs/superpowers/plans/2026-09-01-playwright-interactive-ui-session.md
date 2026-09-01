# Playwright Interactive UI Session Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator open a bounded Playwright UI session on the Local Agent desktop and replay selected tests while Morniter safely owns, monitors, and closes that session.

**Architecture:** Extend the existing Playwright job contract with `interactive` mode and `session_closed` lifecycle metadata. The Agent launches Playwright UI on loopback with one browser and selected contained specs, keeps the active lease through the process lifetime, and closes it on user exit, Stop, or a 30-minute timeout.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vitest, Testing Library, Playwright Test UI, Upstash Redis, Node.js Local Agent, Windows process tree management

## Global Constraints

- Do not add dependencies, WebSockets, SSE, desktop-control APIs, or a remote Playwright UI proxy.
- Bind Playwright UI to `127.0.0.1` with `--ui-port=0`.
- Never expose the UI URL, absolute paths, cwd, raw command/arguments, environment values, tokens, or passwords.
- Interactive mode accepts only `source: "project-test"`, at least one selected test ID, and exactly one browser.
- Default interactive browser is Chromium.
- Keep the Agent active lease for at most 30 minutes and terminate the full process tree on Stop or timeout.
- Git operations remain manual and are not part of this plan.

---

### Task 1: Define the interactive session contract

**Files:**
- Modify: `src/lib/playwright-runner/types.ts`
- Modify: `src/lib/playwright-runner/schemas.ts`
- Modify: `agent/src/types.ts`
- Modify: `src/lib/playwright-runner/job-store-logic.ts`
- Test: `tests/unit/playwright-runner/schemas.test.ts`
- Test: `tests/unit/playwright-runner/job-store.test.ts`

**Interfaces:**
- Produces: `RunMode = "headless" | "headed" | "interactive"`
- Produces: `PlaywrightSessionCloseReason = "user_closed" | "operator_stopped" | "timeout" | "process_error"`
- Produces: terminal job status `session_closed` and optional `sessionCloseReason`

- [x] **Step 1: Add failing schema tests for the valid interactive request**

```ts
expect(PlaywrightJobRequestSchema.safeParse({
  projectId: "sts-playwright",
  source: "project-test",
  testIds: ["auth-login"],
  browsers: ["chromium"],
  mode: "interactive",
}).success).toBe(true);
```

- [x] **Step 2: Add failing rejection tests**

Assert `interactive` rejects workspace source, empty test IDs, and multiple browsers.

```ts
expect(parseInteractive({ source: "workspace", browsers: ["chromium"] }).success).toBe(false);
expect(parseInteractive({ source: "project-test", testIds: ["a"], browsers: ["chromium", "firefox"] }).success).toBe(false);
```

- [x] **Step 3: Run the focused schema tests and verify RED**

```powershell
npx vitest run tests/unit/playwright-runner/schemas.test.ts tests/unit/playwright-runner/job-store.test.ts --reporter=verbose
```

Expected: `interactive` and `session_closed` are rejected by the current unions.

- [x] **Step 4: Add the shared types and discriminated schema validation**

Use `superRefine` on the request schema:

```ts
if (data.mode === "interactive") {
  if (data.source !== "project-test") addIssue("Interactive UI requires project tests");
  if (data.browsers.length !== 1) addIssue("Interactive UI requires exactly one browser");
  if (!data.testIds?.length) addIssue("Interactive UI requires selected tests");
}
```

Add `session_closed` to terminal-state checks and allow transitions from `claimed`, `preparing`, `running`, and `cancel_requested` to `session_closed`.

- [x] **Step 5: Run focused tests and typecheck**

```powershell
npx vitest run tests/unit/playwright-runner/schemas.test.ts tests/unit/playwright-runner/job-store.test.ts --reporter=verbose
npm run typecheck
```

Expected: request invariants and lifecycle transitions pass.

---

### Task 2: Prepare a secure Playwright UI command

**Files:**
- Modify: `agent/src/playwright-executor.ts`
- Modify: `agent/src/types.ts`
- Test: `tests/unit/test-agent/playwright-runner.test.ts`
- Test: `tests/unit/test-agent/test-target-policy.test.ts`

**Interfaces:**
- Consumes: validated interactive `PlaywrightJob`
- Produces: `PreparedPlaywrightRun` with `interactive: boolean` and `timeoutSeconds: 1800`

- [x] **Step 1: Add a failing command-preparation test**

Prepare an interactive job with one contained test and assert:

```ts
expect(prepared.args).toContain("--ui");
expect(prepared.args).toContain("--ui-host=127.0.0.1");
expect(prepared.args).toContain("--ui-port=0");
expect(prepared.args).toContain("--project=chromium");
expect(prepared.timeoutSeconds).toBe(1800);
expect(prepared.args.some((arg) => path.isAbsolute(arg) && arg.endsWith(".spec.ts"))).toBe(false);
```

- [x] **Step 2: Add failing tests for workspace, multiple browsers, and escaped paths**

Each invalid job must throw before spawn. Preserve `resolveInsideRoot` as the path authority.

- [x] **Step 3: Run the Agent preparation tests and verify RED**

```powershell
npx vitest run tests/unit/test-agent/playwright-runner.test.ts tests/unit/test-agent/test-target-policy.test.ts --reporter=verbose
```

- [x] **Step 4: Add interactive arguments after existing config and project validation**

```ts
if (job.mode === "interactive") {
  args.push("--ui", "--ui-host=127.0.0.1", "--ui-port=0");
}
```

Do not add `--headed`; Playwright UI owns browser launching. Force `timeoutSeconds` to `1800` for interactive mode while retaining configured limits for ordinary runs.

- [x] **Step 5: Run focused tests and Agent build**

```powershell
npx vitest run tests/unit/test-agent/playwright-runner.test.ts tests/unit/test-agent/test-target-policy.test.ts --reporter=verbose
npm run agent:build
```

---

### Task 3: Own and terminate the interactive process lifecycle

**Files:**
- Modify: `agent/src/playwright-executor.ts`
- Modify: `agent/src/runner.ts`
- Modify: `agent/src/process-adapter.ts`
- Modify: `agent/src/client.ts`
- Test: `tests/unit/test-agent/process-adapter.test.ts`
- Test: `tests/unit/test-agent/runner.test.ts`
- Test: `tests/unit/test-agent/playwright-runner.test.ts`

**Interfaces:**
- Produces: `PlaywrightExecutionResult.sessionCloseReason`
- Consumes: heartbeat response `cancelRequested`

- [x] **Step 1: Add failing lifecycle tests with a controllable fake child process**

Cover four independent outcomes:

```ts
expect(await closeByProcess()).toMatchObject({ status: "session_closed", sessionCloseReason: "user_closed" });
expect(await closeByAbort()).toMatchObject({ status: "session_closed", sessionCloseReason: "operator_stopped" });
expect(await closeByTimeout()).toMatchObject({ status: "session_closed", sessionCloseReason: "timeout" });
expect(await closeBySpawnError()).toMatchObject({ status: "session_closed", sessionCloseReason: "process_error" });
```

Also assert process-tree termination runs once even if Stop and timeout race.

- [x] **Step 2: Run lifecycle tests and verify RED**

```powershell
npx vitest run tests/unit/test-agent/process-adapter.test.ts tests/unit/test-agent/runner.test.ts tests/unit/test-agent/playwright-runner.test.ts --reporter=verbose
```

- [x] **Step 3: Separate interactive completion from ordinary test completion**

When `prepared.interactive` is true:

- child exit code is not interpreted as Passed/Failed;
- normal process close maps to `user_closed`;
- abort maps to `operator_stopped`;
- 30-minute timer maps to `timeout`;
- spawn/runtime error maps to `process_error`;
- `terminateProcessTree(pid)` is idempotent.

- [x] **Step 4: Emit lifecycle-only Terminal lines**

```text
[UI] Interactive session opened on Local Agent desktop
[UI] Selected tests: 1
[UI] Browser: chromium
[UI] Maximum duration: 30 minutes
[UI] Session closed: operator_stopped
```

Filter loopback URLs printed by Playwright UI and replace them with `[UI] Local Playwright UI ready`. Do not forward raw UI server stdout.

- [x] **Step 5: Run lifecycle tests and Agent build**

Expected: all close paths release the process once and publish no local URL or path.

---

### Task 4: Persist session closure and release the Agent lease

**Files:**
- Modify: `src/lib/playwright-runner/job-store.ts`
- Modify: `src/lib/playwright-runner/job-store-logic.ts`
- Modify: `src/app/api/playwright-runner/agent/jobs/[jobId]/complete/route.ts`
- Modify: `src/app/api/playwright-runner/jobs/[jobId]/cancel/route.ts`
- Test: `tests/unit/playwright-runner/job-store.test.ts`
- Test: `tests/integration/playwright-runner-agent-routes.test.ts`
- Test: `tests/integration/playwright-runner-browser-routes.test.ts`

**Interfaces:**
- Consumes: Agent completion `{ status: "session_closed", sessionCloseReason }`
- Produces: released active lease and durable job history

- [x] **Step 1: Add failing store tests**

Assert the Agent remains busy while the job is `running`, Stop changes it to `cancel_requested`, completion stores `session_closed`, and the active key is removed only by the owning Agent.

- [x] **Step 2: Add failing idempotency and stale recovery tests**

Repeated Stop and completion requests must return the same terminal job without reviving it. A stale interactive heartbeat must release through the existing reaper and record a safe close reason.

- [x] **Step 3: Run route and store tests to verify RED**

```powershell
npx vitest run tests/unit/playwright-runner/job-store.test.ts tests/integration/playwright-runner-agent-routes.test.ts tests/integration/playwright-runner-browser-routes.test.ts --reporter=verbose
```

- [x] **Step 4: Extend completion validation and ownership-safe release**

Accept `sessionCloseReason` only when status is `session_closed`. Reuse the existing owner check before deleting the active key. Return the terminal job for duplicate completion.

- [x] **Step 5: Run focused tests**

Expected: queue remains locked for an open UI, releases exactly once on closure, and the next queued job can be claimed.

---

### Task 5: Add Interactive UI controls to the workspace

**Files:**
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Modify: `src/components/playwright-runner/layout/WorkspaceControlBar.tsx`
- Modify: `src/components/playwright-runner/browser/RunModeSelector.tsx`
- Modify: `src/components/playwright-runner/execution/ExecutionToolbar.tsx`
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Test: `tests/components/playwright-runner/CompactToolbar.test.tsx`
- Test: `tests/components/playwright-runner/BrowserSelector.test.tsx`
- Test: `tests/components/playwright-runner/PlaywrightWorkspace.test.tsx`

**Interfaces:**
- Produces: interactive mode selection, one-browser enforcement, `Open Interactive UI`, `Stop UI`, elapsed/limit display

- [x] **Step 1: Add failing component tests for mode selection**

Assert selecting Interactive UI:

- retains Chromium if selected, otherwise selects Chromium;
- reduces multiple browsers to one;
- disables workspace source and Recipe Draft execution;
- requires at least one Test Explorer selection;
- labels the action `Open Interactive UI`.

- [x] **Step 2: Add failing active-session tests**

For an interactive running job assert `Stop UI`, `Interactive session active`, elapsed time, and `30 min limit` are visible. On `session_closed`, assert the close reason copy is visible and ordinary Run becomes available again.

- [x] **Step 3: Run component tests and verify RED**

```powershell
npx vitest run tests/components/playwright-runner/CompactToolbar.test.tsx tests/components/playwright-runner/BrowserSelector.test.tsx tests/components/playwright-runner/PlaywrightWorkspace.test.tsx --reporter=verbose
```

- [x] **Step 4: Implement the mode behavior**

Use the existing Run endpoint and cancel endpoint. Do not add a second client-side session store. Derive active interactive state from `activeJob.mode === "interactive"` and active status.

- [x] **Step 5: Add operator guidance**

Render: `Playwright UI opens on the Windows computer running Local Agent. Replay results stay in that window.` Use `role="status"` for lifecycle copy and preserve keyboard operation.

- [x] **Step 6: Run component tests and typecheck**

Expected: mode and button transitions pass without changing Headless/Headed behavior.

---

### Task 6: End-to-end and real ProjectSTS acceptance

**Files:**
- Modify: `e2e/playwright-workspace-layout.spec.ts`
- Modify: `tests/integration/playwright-runner-e2e-flow.test.ts`
- Modify: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Verifies browser, API, Redis lifecycle, and Local Agent desktop behavior

- [x] **Step 1: Add an E2E stubbed interactive lifecycle**

Exercise: select project tests → choose Interactive UI → browser count becomes one → submit → active Stop UI control → Stop request → `session_closed` with `operator_stopped` → Run re-enabled. Assert no mutation endpoint and no UI URL appear.

- [x] **Step 2: Add an integration queue-lock test**

Create two users, start one interactive job, assert the second receives `409 ACTIVE_JOB_EXISTS`, close the first session, and assert the second can enqueue afterward.

- [x] **Step 3: Run all release gates**

```powershell
npm run typecheck
npm run lint
npm test
npm run agent:build
npm run build
npx playwright test --reporter=line
```

Expected: every command exits 0 with no unexpected skip or warning introduced by interactive mode.

- [x] **Step 4: Run a real read-only ProjectSTS acceptance test**

Use `sts-playwright`, `frontend/e2e/auth/login.spec.ts`, Chromium, and Interactive UI. Verify the Playwright UI window opens on the Agent desktop, remains open after a replay, permits at least two manual Runs, and closes through `Stop UI`.

- [x] **Step 5: Verify timeout and cleanup safely**

Use an injected short timeout in the Agent unit/integration harness rather than waiting 30 minutes. Confirm the production constant remains exactly `1800` seconds.

- [x] **Step 6: Update team status**

Record automated counts, real acceptance result, and any production-only limitation. Do not mark production ready until the deployed Morniter instance can start and stop the local interactive session through production Redis and authentication.
