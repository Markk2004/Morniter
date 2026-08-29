# Playwright Runner Deploy Readiness Implementation Plan

## Progress status (reviewed 2026-08-29)

Overall: core implementation is substantially present. The release is blocked by lint and outstanding live/E2E verification, not by the Next.js build.

- [x] Task 1: legacy schema boundary restored; typecheck and Next build pass.
- [x] Task 2: Playwright Redis store and unit tests are present.
- [x] Task 3: separate `/api/playwright-runner` browser and agent routes are present with integration tests.
- [x] Task 4: Agent Playwright catalog and executor modules are present; Agent TypeScript build passes.
- [x] Task 5: Playwright selector and browser selector are connected to the Test workspace at implementation level.
- [ ] Task 5 release quality: resolve current lint errors and warnings in the Test UI and tests.
- [ ] Task 6: run actual browser E2E and live recovery scenarios; integration-flow tests alone are insufficient.
- [ ] Task 7: update deploy documentation, run the clean release gate, deploy, and complete production smoke verification.

Latest local verification:

```text
lint: failed, 9 errors and 9 warnings
typecheck: passed
unit/integration tests: passed, 64 files and 274 tests
agent build: passed
Next production build: passed, 23 routes/pages generated
browser E2E: not run in this review
production smoke: not run in this review
```

> **For Codex:** Use the `writing-plans` skill and execute this plan task by task. Git operations are owned by the user; do not run `git add`, `git commit`, `git push`, or other Git commands.

**Goal:** Restore a deployable production build immediately, then complete the new Playwright test runner without breaking the existing local agent or `/api/test-runner` contract.

**Architecture:** Keep the existing preset runner and the new Playwright runner as separate modules during migration. The legacy system continues under `src/lib/test-runner` and `/api/test-runner`; the new system uses `src/lib/playwright-runner` and `/api/playwright-runner`. Cut the UI over only after the new persistence, API, agent execution, and recovery flow pass end-to-end tests. This prevents the two incompatible job schemas from sharing imports or Redis keys.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, React 19, Upstash Redis, Playwright, Vitest, Playwright E2E, local Node.js agent.

---

## Starting condition and current correction

The plan began after commit `8ef9a55` duplicated the Playwright schema over the legacy schema module. Existing `/api/test-runner` routes still depended on `PollRequestSchema` and the other legacy exports, causing the original Vercel build failure.

As of the 2026-08-29 review:

- the legacy schema exports are restored locally and the schema deploy blocker is closed;
- a complete first pass of the Playwright Redis store, API route family, Agent modules, and Test UI integration now exists;
- `npm run build` succeeds from the current workspace;
- the remaining release blockers are lint, browser E2E, real Local Agent execution, and deployed production smoke verification;
- release checks still need to run against the exact source revision the user pushes and deploys.

## Task 1: Restore the legacy module boundary and unblock Vercel

**Files:**

- Modify: `src/lib/test-runner/schemas.ts`
- Keep: `src/lib/playwright-runner/schemas.ts`
- Test: `tests/unit/test-runner/schemas.test.ts`
- Create: `tests/unit/playwright-runner/schemas.test.ts`

### Step 1: Add a failing module-boundary test

Extend the legacy schema test so it imports and exercises every symbol currently consumed by `/api/test-runner`:

```ts
import {
  AgentHeartbeatSchema,
  AppendLogBatchSchema,
  CompleteJobSchema,
  CreateJobSchema,
  PollRequestSchema,
} from "@/lib/test-runner/schemas";

it("keeps the preset-runner API contract available", () => {
  expect(PollRequestSchema.safeParse({ agentId: "windows-local-agent-1" }).success).toBe(true);
  expect(CreateJobSchema).toBeDefined();
  expect(AppendLogBatchSchema).toBeDefined();
  expect(AgentHeartbeatSchema).toBeDefined();
  expect(CompleteJobSchema).toBeDefined();
});
```

Add a separate new-runner test that imports `PlaywrightJobRequestSchema` only from `@/lib/playwright-runner/schemas`.

### Step 2: Confirm the regression

Run:

```powershell
npm test -- tests/unit/test-runner/schemas.test.ts tests/unit/playwright-runner/schemas.test.ts
```

Expected: the legacy test fails because the required exports are absent.

### Step 3: Restore the legacy schema file

Restore the preset-runner Zod schemas expected by the existing routes and agent. Do not re-export or merge `PlaywrightJobRequestSchema` into this file. Keep the two contracts independent:

```ts
// src/lib/test-runner/schemas.ts
export const PollRequestSchema = z.object({
  agentId: IdSchema,
  catalog: TestProjectCatalogSchema.optional(),
}).strict();

export const CreateJobSchema = z.object({
  projectId: IdSchema,
  presetId: IdSchema,
  idempotencyKey: z.string().min(8).max(128).optional(),
}).strict();
```

Use the existing `TestJob`, catalog, log, heartbeat, completion, and progress types as the source of truth for the remaining schema fields. Preserve current limits and error behavior verified by the integration tests.

### Step 4: Verify both schema families

Run:

```powershell
npm test -- tests/unit/test-runner/schemas.test.ts tests/unit/playwright-runner/schemas.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass and the import error in `agent/poll/route.ts` is gone.

### Step 5: User-managed Git checkpoint

Ask the user to review and commit the deploy-unblock changes. Do not run Git commands.

## Task 2: Complete the new Playwright persistence layer

**Files:**

- Create: `src/lib/playwright-runner/job-store.ts`
- Modify: `src/lib/playwright-runner/types.ts`
- Modify: `src/lib/playwright-runner/job-store-logic.ts`
- Create: `tests/unit/playwright-runner/job-store.test.ts`
- Modify: `src/lib/test-runner/redis.ts` only if a shared Redis client factory is needed

### Step 1: Write storage tests first

Cover:

- enqueue with a maximum queue length of 10;
- idempotent job creation;
- atomic claim by one agent;
- active lease and stale-job recovery;
- bounded history of 20 jobs;
- log batches capped at 100 lines and 32 KiB per upload;
- total logs capped at 5,000 lines and 1 MiB;
- cancellation from queued and running states;
- rejection of invalid state transitions.

Use an injected Redis interface or test double. Do not connect unit tests to the production Upstash database.

### Step 2: Add the persisted job fields needed by execution

Extend `PlaywrightJob` with server-controlled fields only:

```ts
export interface PlaywrightJob {
  id: string;
  agentId: string;
  projectId: string;
  source: "project-test" | "workspace";
  testIds?: string[];
  code?: string;
  browsers: BrowserName[];
  mode: BrowserMode;
  status: PlaywrightJobStatus;
  browserResults: BrowserExecutionResult[];
  lastHeartbeatAt?: string;
  cancelRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

Never add client-controlled `command`, `cwd`, `args`, absolute path, or arbitrary `env` fields.

### Step 3: Implement Redis operations

Use the existing `monitor:playwright:v1:*` keys from `job-store-logic.ts`. Implement explicit functions for enqueue, claim, heartbeat, append logs, complete, cancel, read job, list history, publish catalog, and presence. Apply TTLs so abandoned jobs and catalogs do not remain indefinitely.

Where claim or lock correctness depends on multiple writes, use an atomic Redis transaction or compare-and-set pattern. A read-then-write sequence is not acceptable for concurrent agents.

### Step 4: Verify persistence behavior

Run:

```powershell
npm test -- tests/unit/playwright-runner/job-store.test.ts
npm run typecheck
```

Expected: concurrent-claim and storage-bound tests pass.

### Step 5: User-managed Git checkpoint

Ask the user to review and commit. Do not run Git commands.

## Task 3: Add a separate Playwright API contract

**Files:**

- Create: `src/app/api/playwright-runner/catalog/route.ts`
- Create: `src/app/api/playwright-runner/jobs/route.ts`
- Create: `src/app/api/playwright-runner/jobs/[jobId]/route.ts`
- Create: `src/app/api/playwright-runner/jobs/[jobId]/cancel/route.ts`
- Create: `src/app/api/playwright-runner/agent/poll/route.ts`
- Create: `src/app/api/playwright-runner/agent/jobs/[jobId]/heartbeat/route.ts`
- Create: `src/app/api/playwright-runner/agent/jobs/[jobId]/logs/route.ts`
- Create: `src/app/api/playwright-runner/agent/jobs/[jobId]/complete/route.ts`
- Create: `tests/integration/playwright-runner-browser-routes.test.ts`
- Create: `tests/integration/playwright-runner-agent-routes.test.ts`

### Step 1: Write route contract tests

Test browser routes for session authorization, invalid payloads, queue limits, idempotency, job history, log pagination, and cancellation. Test agent routes for bearer-token authorization, catalog publishing, presence updates, claim exclusivity, ordered log batches, completion, and stale lease recovery.

### Step 2: Implement browser routes

Validate job creation with `PlaywrightJobRequestSchema.safeParse`. Generate `jobId`, `idempotencyKey`, timestamps, and target `agentId` on the server. Return sanitized errors; do not echo Redis errors or secrets to the browser.

### Step 3: Implement agent routes

Reuse `verifyAgentAuth` or move it to a neutral shared module without changing its behavior. The poll payload must carry catalog and capabilities, while the response returns either one claimed job or HTTP 204.

### Step 4: Prevent polling overload

Set bounded intervals and backoff rules:

- agent idle poll: 30 seconds;
- browser active-job poll: 2 seconds;
- browser idle/history refresh: manual or 30 seconds;
- exponential backoff after errors, capped at 60 seconds;
- one in-flight request per polling loop;
- pause browser polling when the tab is hidden, then refresh once on focus;
- return `Cache-Control: no-store` for live job, catalog, presence, and log endpoints.

### Step 5: Verify routes

Run:

```powershell
npm test -- tests/integration/playwright-runner-browser-routes.test.ts tests/integration/playwright-runner-agent-routes.test.ts
npm run typecheck
```

Expected: route contracts pass without touching `/api/test-runner`.

## Task 4: Wire Playwright into the local agent safely

**Files:**

- Modify: `agent/src/types.ts`
- Modify: `agent/src/config.ts`
- Modify: `agent/src/client.ts`
- Modify: `agent/src/runner.ts`
- Create: `agent/src/playwright-catalog.ts`
- Create: `agent/src/playwright-executor.ts`
- Move or adapt: `src/lib/playwright-runner/agent-security-config.ts`
- Move or adapt: `src/lib/playwright-runner/command-builder.ts`
- Modify: `agent/test-runner.config.example.json`
- Create: `tests/unit/test-agent/playwright-runner.test.ts`

### Step 1: Write agent tests first

Cover configuration validation, path traversal rejection, browser allowlisting, headed-mode rejection, environment allowlisting, catalog parse errors, safe argument arrays, process timeout, cancellation, workspace-file cleanup, and result upload.

### Step 2: Put machine-only code in the agent compilation unit

The filesystem and process modules do not belong in the Next.js server bundle. Move or duplicate the needed logic under `agent/src`, then share only pure types and schemas where compilation permits. Ensure the agent TypeScript build resolves every import.

### Step 3: Extend local configuration

Use a per-project section:

```json
{
  "projectId": "projectsts",
  "playwright": {
    "workspaceRoot": "E:/path/to/ststracking",
    "testRoot": "e2e",
    "allowedBrowsers": ["chromium"],
    "allowHeaded": false,
    "maxTimeoutSeconds": 300,
    "envAllowlist": ["STS_UAT_EMAIL", "STS_UAT_PASSWORD"]
  }
}
```

This path is configured only on the local agent. It must never be sent to or stored by Vercel.

### Step 4: Implement catalog discovery and execution

- Discover tests using Playwright's JSON list reporter.
- Publish opaque test IDs with relative paths only.
- Resolve selected IDs against the most recently published catalog.
- Spawn with an argument array and `shell: false`.
- For workspace code, write only to `testRoot/__workspace__/<jobId>.spec.ts` and remove it in `finally`.
- Stream ordered, redacted logs in bounded batches.
- Heartbeat while running and terminate the process tree on cancel or timeout.
- Report one result per browser and a final aggregate status.

### Step 5: Verify the agent

Run:

```powershell
npm run test-agent:build
npm test -- tests/unit/test-agent/playwright-runner.test.ts
```

Expected: build succeeds and no browser request can execute an arbitrary command or escape the configured workspace.

## Task 5: Migrate the Test page to the new API

**Files:**

- Modify: `src/app/monitor/tests/page.tsx`
- Modify: `src/components/test-runner/TestRunnerWorkspace.tsx`
- Modify: `src/components/test-runner/useTestRunner.ts`
- Modify: `src/components/test-runner/AgentStatusBanner.tsx`
- Modify: `src/components/test-runner/JobTerminal.tsx`
- Create: `src/components/test-runner/PlaywrightJobSelector.tsx`
- Create: `src/components/test-runner/BrowserSelector.tsx`
- Modify: `tests/components/TestRunnerWorkspace.test.tsx`
- Create: `tests/components/PlaywrightJobSelector.test.tsx`

### Step 1: Write component tests

Cover:

- dropdown selection for project test versus workspace test;
- loading, empty, unavailable-agent, and catalog-error states;
- browser and headed-mode controls based on agent capabilities;
- Run disabled until the request is valid;
- running progress per browser;
- terminal logs append without resetting scroll unnecessarily;
- cancel action and final pass/fail summary;
- no duplicate submission on repeated clicks.

### Step 2: Replace preset-only data loading

Point the new workspace UI at `/api/playwright-runner/*`. Keep the old preset UI behind a clearly named compatibility component until the new E2E path passes; do not mix both payload shapes in one hook.

### Step 3: Control rendering and network load

- cap terminal lines rendered in the DOM;
- request logs incrementally by cursor;
- debounce editor validation;
- abort stale fetches during navigation;
- retain current job state across transient refresh errors;
- show a retry button instead of creating an uncontrolled retry loop.

### Step 4: Verify UI behavior

Run:

```powershell
npm test -- tests/components/TestRunnerWorkspace.test.tsx tests/components/PlaywrightJobSelector.test.tsx
npm run lint
npm run typecheck
```

Expected: tests pass and there are no unbounded polling or terminal-render loops.

## Task 6: Add end-to-end migration and recovery coverage

**Files:**

- Create: `e2e/playwright-runner.spec.ts`
- Create: `e2e/playwright-runner-recovery.spec.ts`
- Keep: existing `e2e/test-runner*.spec.ts` until cutover is accepted

### Step 1: Test the complete happy path

Exercise login, Test navigation, catalog load, dropdown selection, Chromium selection, enqueue, agent claim, progress, live logs, completion, and history reload after closing and reopening the page.

### Step 2: Test failure and recovery

Cover agent offline, invalid Upstash configuration, failed Playwright test, timeout, cancel, stale heartbeat, duplicate Run click, page refresh while a job is active, and a job completed while Morniter was closed.

### Step 3: Run E2E with a disposable Redis namespace

Do not use production job keys in automated tests. Prefix the namespace with a test run ID or use a separate Upstash test database.

Run:

```powershell
npm run test:e2e -- e2e/playwright-runner.spec.ts e2e/playwright-runner-recovery.spec.ts
```

Expected: both happy-path and recovery scenarios pass.

## Task 7: Production release gate and Vercel verification

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md` if present
- Create: `docs/runbooks/playwright-runner-deploy.md`

### Step 1: Document required production variables

Morniter on Vercel requires:

```text
SESSION_SIGNING_SECRET
GROUP_ACCESS_PASSWORD_HASH
TEST_RUNNER_PASSWORD_HASH
TEST_RUNNER_AGENT_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Document that values in Vercel must not include accidental wrapping quotes and that the Redis URL must start with `https://`.

### Step 2: Run the clean release gate

After the user updates their checkout to the exact source intended for deployment, run:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run test-agent:build
npm run build
```

Expected: every command exits with code 0. `npm run build` must run from a clean dependency install, not from a stale `.next` directory.

### Step 3: Verify Vercel configuration

- project root directory is the repository root;
- production branch points at the intended branch;
- Node.js version is compatible with Next.js 16;
- all required variables are enabled for Production;
- no `NEXT_PUBLIC_*` variable contains secrets;
- deployment uses the source revision that passed the release gate.

### Step 4: Production smoke test

After deployment:

1. Open `/login` and sign in.
2. Open `/monitor` and confirm provider logs load.
3. Open `/monitor/tests` and confirm the agent presence and catalog appear.
4. Run one safe Chromium test against `projectsts`.
5. Confirm progress, logs, final status, history persistence, and page refresh recovery.
6. Stop the local agent and confirm the UI changes to offline without continuously retrying.
7. Start the agent again and confirm it reconnects without creating duplicate jobs.

### Step 5: Rollback rule

If the new Playwright route or UI fails in production, switch the Test page back to the legacy preset component while leaving Task 1's restored schemas in place. Do not roll back the schema fix, because existing `/api/test-runner` routes require it to build.

### Step 6: User-managed Git and deployment checkpoint

Ask the user to review, commit, push, and deploy. Do not run Git commands.

## Definition of done

- Vercel build succeeds from the latest intended source revision.
- Existing `/api/test-runner` routes and the current local agent remain functional during migration.
- New Playwright jobs use only `/api/playwright-runner` and `monitor:playwright:v1:*` storage.
- One job can be claimed by only one agent.
- No browser payload can select a raw command, working directory, absolute path, or arbitrary environment variable.
- UI shows offline, queued, running, passed, failed, timed out, cancelled, and recovery states correctly.
- Polling pauses or backs off appropriately and terminal rendering remains bounded.
- A safe production test completes from Morniter and remains visible after refresh or later login.
- All unit, integration, agent build, Next.js build, and E2E checks pass.
