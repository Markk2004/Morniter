# Playwright Realtime Terminal Recovery Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Playwright Run recover correctly from an expired execution session and show complete, identifiable realtime terminal output without exposing local paths or secrets.

**Architecture:** Keep the existing HTTP polling and Agent batching architecture. Standardize the log cursor as “next unread sequence,” recover authorization state in the browser hook, add a safe Agent-owned run summary, and perform bounded final reconciliation before polling stops.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Playwright, Upstash Redis, Node.js Local Agent

## Global Constraints

- Do not add WebSocket, SSE, a new queue, or a new dependency.
- Never expose absolute paths, cwd, raw commands, environment values, passwords, tokens, or authorization headers.
- Retain one-second browser polling, 250 ms Agent log batching, the 300-line browser rendering bound, and existing Redis TTLs.
- Preserve the project allowlist, path-containment checks, execute-session step-up, and same-origin protection.
- Git operations remain manual and are not part of this plan.

---

### Task 1: Standardize the incremental log cursor

**Files:**
- Modify: `src/lib/playwright-runner/job-store.ts`
- Modify: `tests/unit/playwright-runner/job-store.test.ts`
- Modify: `tests/integration/playwright-runner-e2e-flow.test.ts`

**Interfaces:**
- Consumes: `readPlaywrightLogPage(jobId, cursor, limit)`
- Produces: `PlaywrightLogPage.nextSequence`, defined as the next unread sequence

- [x] **Step 1: Add a failing multi-batch pagination test**

Create a job through the existing test fixture, append sequences `0..1`, read with cursor `0`, append sequences `2..3`, then read with the first response cursor. Assert that the second page returns both `line-2` and `line-3`, with no duplicates.

```ts
expect(firstPage.lines.map((line) => line.text)).toEqual(["line-0", "line-1"]);
expect(firstPage.nextSequence).toBe(2);
expect(secondPage.lines.map((line) => line.text)).toEqual(["line-2", "line-3"]);
expect(secondPage.nextSequence).toBe(4);
```

- [x] **Step 2: Run the regression test and confirm it fails by omitting `line-2`**

Run:

```powershell
npx vitest run tests/unit/playwright-runner/job-store.test.ts tests/integration/playwright-runner-e2e-flow.test.ts --reporter=verbose
```

Expected before the fix: the second page contains `line-3` but not `line-2`.

- [x] **Step 3: Change the store query to use the cursor as the inclusive next unread sequence**

```ts
const minScore = Math.max(0, cursor);
const nextSequence = sliced.length > 0
  ? sliced[sliced.length - 1].sequence + 1
  : cursor;
```

Rename the internal parameter from `afterSequence` to `cursor`. Keep accepting the existing `afterSequence` query parameter at the HTTP boundary during this release so deployed clients do not break.

- [x] **Step 4: Run the focused tests**

Expected: all focused tests pass and the two pages contain every sequence exactly once.

---

### Task 2: Recover the workspace when execution permission expires

**Files:**
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Modify: `tests/components/playwright-runner/PlaywrightWorkspace.test.tsx`
- Modify: `tests/integration/playwright-runner-browser-routes.test.ts`

**Interfaces:**
- Produces: `runError: string | null`
- Preserves: `run(): Promise<boolean>`

- [x] **Step 1: Add a failing component test for expired execution permission**

Mock `POST /api/playwright-runner/jobs` with:

```ts
new Response(
  JSON.stringify({
    code: "EXECUTION_REQUIRED",
    error: "Execution session expired or invalid",
  }),
  { status: 403, headers: { "content-type": "application/json" } },
)
```

Assert that the Execution Unlock panel becomes visible, Run is disabled, and the expiry message is rendered.

- [x] **Step 2: Run the component test and confirm the stale unlocked UI fails**

Run:

```powershell
npx vitest run tests/components/playwright-runner/PlaywrightWorkspace.test.tsx --reporter=verbose
```

- [x] **Step 3: Handle structured Run errors in the hook**

```ts
if (!res.ok) {
  const errorData = await res.json().catch(() => ({}));
  if (res.status === 403 && errorData.code === "EXECUTION_REQUIRED") {
    setIsUnlocked(false);
    setRunError("Execution permission expired. Unlock execution and run again.");
    return false;
  }
  setRunError("Unable to start the test run.");
  return false;
}
```

Clear `runError` on a successful unlock and before a new submission. Preserve the existing `409 ACTIVE_JOB_EXISTS` reattachment behavior.

- [x] **Step 4: Render the safe error adjacent to Execution Unlock**

Use an accessible `role="alert"`; do not render the raw server response.

- [x] **Step 5: Run focused route and component tests**

```powershell
npx vitest run tests/components/playwright-runner/PlaywrightWorkspace.test.tsx tests/integration/playwright-runner-browser-routes.test.ts --reporter=verbose
```

Expected: expired execution permission returns the UI to Locked while a valid execute cookie still creates a `queued` job.

---

### Task 3: Publish a safe run summary before process output

**Files:**
- Modify: `agent/src/runner.ts`
- Modify: `agent/src/playwright-executor.ts`
- Modify: `tests/unit/test-agent/runner.test.ts`
- Modify: `tests/unit/test-agent/playwright-runner.test.ts`

**Interfaces:**
- Create: `buildSafeRunSummary(job, project, testLabels): string[]`
- Produces ordered `system` log lines before stdout/stderr

- [x] **Step 1: Add failing tests for summary content and secret exclusion**

Assert that the first Agent batch contains:

```text
[RUN] Project: sts-playwright
[RUN] Source: Project tests
[RUN] Tests: 2 selected
[RUN] Browsers: chromium
[RUN] Mode: headless
```

Also assert that the serialized lines contain none of `workspaceRoot`, `cwd`, `C:\`, `E:\`, `agentToken`, or the executable command.

- [x] **Step 2: Run focused Agent tests and confirm the summary assertions fail**

```powershell
npx vitest run tests/unit/test-agent/runner.test.ts tests/unit/test-agent/playwright-runner.test.ts --reporter=verbose
```

- [x] **Step 3: Implement and emit the summary**

Build summary values from catalog-safe job metadata only. For project-test jobs show the selected test count and, when catalog labels are available, relative test titles. For workspace jobs show `Workspace draft`; never include the generated temporary filename.

```ts
logBatcher.push("system", buildSafeRunSummary(job, project, selectedTestLabels));
```

Emit the summary before spawning the child process and before forwarding stdout/stderr.

- [x] **Step 4: Run Agent tests and build**

```powershell
npx vitest run tests/unit/test-agent/runner.test.ts tests/unit/test-agent/playwright-runner.test.ts --reporter=verbose
npm run agent:build
```

Expected: summary ordering and secret-exclusion assertions pass; Agent TypeScript build exits 0.

---

### Task 4: Reconcile terminal logs after completion

**Files:**
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Modify: `tests/components/playwright-runner/PlaywrightWorkspace.test.tsx`
- Modify: `tests/integration/playwright-runner-e2e-flow.test.ts`

**Interfaces:**
- Consumes: `nextSequence` as the next unread cursor
- Produces: bounded final reconciliation with no duplicate terminal lines

- [x] **Step 1: Add a failing test where terminal status arrives before the final log batch**

Return a terminal job with `hasMore: true`, then return the final lines on the next request. Assert that polling does not stop after the first terminal response and all lines appear once.

- [x] **Step 2: Run the focused test and confirm the final batch is missing**

```powershell
npx vitest run tests/components/playwright-runner/PlaywrightWorkspace.test.tsx tests/integration/playwright-runner-e2e-flow.test.ts --reporter=verbose
```

- [x] **Step 3: Implement bounded terminal reconciliation**

After observing a terminal status, continue immediately while `hasMore` is true, then allow up to three empty reconciliation polls separated by 250 ms. Stop when the cursor does not advance across the bounded attempts. Keep the existing one-second interval only for active jobs.

- [x] **Step 4: Verify no duplicate lines and no request loop**

Assert a maximum of four post-terminal requests, stable sequence ordering, and one rendered row per sequence.

---

### Task 5: Browser acceptance and release verification

**Files:**
- Modify: `e2e/playwright-workspace-layout.spec.ts`
- Modify: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Verifies the complete operator flow through `/monitor/tests`

- [x] **Step 1: Add an authenticated E2E case**

The test must exercise: unlocked UI → first Run returns 403 → unlock panel appears → unlock succeeds → second Run returns 201 → Terminal shows Project, Tests, Browser, Mode → two simulated log batches appear without gaps → final status renders.

- [x] **Step 2: Run all automated gates**

```powershell
npm run typecheck
npm run lint
npm test
npm run agent:build
npm run build
npx playwright test --reporter=line
```

Expected: every command exits 0; Playwright has no unexpected skips or failures.

- [x] **Step 3: Run one real ProjectSTS smoke test**

Start the local Agent with `test-runner.config.local.json`, unlock execution, select one read-only ProjectSTS Playwright test, and verify the Terminal shows the safe summary before incremental stdout/stderr and retains the final result.

- [x] **Step 4: Update team status**

Record automated counts, real smoke-test result, and any remaining production-only verification in `docs/superpowers/plans/STATUS.md`. Do not mark production ready until the deployed Vercel application and Local Agent pairing pass the same flow.

