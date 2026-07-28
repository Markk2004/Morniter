# Production Test Runner Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Morniter into a Logs-first monitor and a production-safe Test Runner with preset shortcuts, live framework progress, bounded logs, recoverable Agent execution, and future runner portability.

**Architecture:** A shared `/monitor` layout owns authentication and navigation while `/monitor` and `/monitor/tests` load independent data. Redis owns the canonical Agent presence, job state, idempotency, lease, progress, cursor-paged logs, and seven-day retention. The Local Agent executes one allowlisted preset at a time, reports heartbeat/progress/logs through a runner-neutral protocol, and uses a Windows-safe process adapter.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Upstash Redis REST, Zod 4, Vitest 4, Testing Library, Playwright, Node.js Local Agent, cross-spawn.

## Global Constraints

- `/monitor` is the default Logs route and `/monitor/tests` is the Test Runner route.
- Each Agent may have only one active job.
- Browser payloads never contain executable paths, environment variables, or editable commands.
- Presets come only from `test-runner.config.local.json`.
- Execution unlock lasts 30 minutes and remains separate from the monitor read session.
- Active-job heartbeat is five seconds; lagging is 15 seconds; Agent loss is 45 seconds.
- Idle presence is 30 seconds; offline is 75 seconds.
- Log batches are at most 100 lines, 32 KiB, or 250 ms old.
- Agent pending log memory is capped at 512 KiB.
- Stored logs are capped at 1 MiB and 5,000 lines per job and expire after seven days.
- Browser log pages contain at most 200 lines and the terminal renders at most 1,000 lines.
- Unknown frameworks never show a fabricated percentage.
- The first runner is Windows Local Agent; the browser/API contract must remain runner-neutral.
- Git staging, commits, and pushes are performed manually by the user.

---

## File structure

### New domain and Agent files

- `src/lib/test-runner/lifecycle.ts`: canonical job transition and active/terminal guards.
- `src/lib/test-runner/errors.ts`: stable API error codes and typed domain errors.
- `src/lib/test-runner/keys.ts`: Redis key construction and retention constants.
- `agent/src/log-batcher.ts`: bounded, sequential log batching.
- `agent/src/process-adapter.ts`: cross-platform executable launch and process-tree termination.
- `agent/src/progress/types.ts`: parser contract and progress result types.
- `agent/src/progress/jest.ts`: Jest summary parser.
- `agent/src/progress/cypress.ts`: Cypress summary parser.
- `agent/src/progress/vitest.ts`: Vitest summary parser.
- `agent/src/progress/index.ts`: parser selection and fallback.

### New route and UI files

- `src/app/monitor/layout.tsx`: authenticated shared monitor layout.
- `src/app/monitor/tests/page.tsx`: Tests route entry point.
- `src/components/monitor/MonitorShell.tsx`: shared header, navigation, and logout.
- `src/components/monitor/MonitorLogsPage.tsx`: provider-only Logs workspace.
- `src/components/test-runner/TestRunnerWorkspace.tsx`: Test Runner coordinator.
- `src/components/test-runner/AgentStatusBanner.tsx`: presence and availability state.
- `src/components/test-runner/PresetLauncher.tsx`: project selector and preset shortcut cards.
- `src/components/test-runner/RunConfirmation.tsx`: safe confirmation dialog.
- `src/components/test-runner/RunProgress.tsx`: stage rail, count, percentage, and elapsed time.
- `src/components/test-runner/LiveTestTerminal.tsx`: cursor-paged bounded terminal.
- `src/components/test-runner/useTestRunner.ts`: non-overlapping visibility-aware polling.

### Existing files with focused changes

- `src/lib/test-runner/types.ts`
- `src/lib/test-runner/schemas.ts`
- `src/lib/test-runner/store.ts`
- `src/app/api/test-runner/**/route.ts`
- `src/lib/auth/execute-session.ts`
- `agent/src/types.ts`
- `agent/src/client.ts`
- `agent/src/executor.ts`
- `agent/src/runner.ts`
- `src/app/monitor/page.tsx`
- `src/components/monitor/MonitorDashboard.tsx`
- `src/components/test-runner/JobHistory.tsx`
- `package.json`
- `.env.example`
- `README.md`
- `ARCHITECTURE.md`

---

### Task 1: Canonical job lifecycle and protocol types

**Files:**

- Create: `src/lib/test-runner/lifecycle.ts`
- Create: `src/lib/test-runner/errors.ts`
- Modify: `src/lib/test-runner/types.ts`
- Modify: `agent/src/types.ts`
- Modify: `src/lib/test-runner/schemas.ts`
- Test: `tests/unit/test-runner/lifecycle.test.ts`
- Test: `tests/unit/test-runner/schemas.test.ts`

**Interfaces:**

- Produces: `TestJobStatus`, `TestProgress`, `AgentPresence`, `isActiveStatus()`, `isTerminalStatus()`, `assertTransition()`.
- Produces schemas for catalog, heartbeat, progress, batch logs, completion, and cursor queries.
- Consumed by all later store, API, Agent, and UI tasks.

- [ ] **Step 1: Write lifecycle tests that define every allowed transition**

```ts
import { describe, expect, it } from "vitest";
import {
  assertTransition,
  isActiveStatus,
  isTerminalStatus,
  InvalidJobTransitionError,
} from "@/lib/test-runner/lifecycle";

describe("test job lifecycle", () => {
  it.each(["queued", "claimed", "running", "cancel_requested"])(
    "treats %s as active",
    (status) => expect(isActiveStatus(status)).toBe(true),
  );

  it.each(["passed", "failed", "cancelled", "timed_out", "agent_lost"])(
    "treats %s as terminal",
    (status) => expect(isTerminalStatus(status)).toBe(true),
  );

  it.each([
    ["queued", "claimed"],
    ["queued", "cancelled"],
    ["claimed", "running"],
    ["claimed", "agent_lost"],
    ["running", "passed"],
    ["running", "failed"],
    ["running", "cancel_requested"],
    ["running", "timed_out"],
    ["running", "agent_lost"],
    ["cancel_requested", "cancelled"],
    ["cancel_requested", "agent_lost"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it("rejects a terminal job returning to running", () => {
    expect(() => assertTransition("passed", "running")).toThrow(
      InvalidJobTransitionError,
    );
  });
});
```

- [ ] **Step 2: Run the lifecycle test and verify it fails**

Run:

```powershell
npx vitest run tests/unit/test-runner/lifecycle.test.ts
```

Expected: FAIL because `lifecycle.ts` and the expanded status union do not exist.

- [ ] **Step 3: Implement the lifecycle and shared protocol types**

```ts
export type TestJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "passed"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out"
  | "agent_lost";

export type TestFramework = "jest" | "cypress" | "vitest" | "unknown";

export interface TestProgress {
  framework: TestFramework;
  completed: number | null;
  total: number | null;
  percentage: number | null;
  currentLabel?: string;
  updatedAt: string;
}

export interface AgentPresence {
  agentId: string;
  state: "online" | "lagging" | "offline";
  lastHeartbeatAt: string;
  activeJobId?: string;
}

export interface TestJob {
  id: string;
  idempotencyKey: string;
  agentId: string;
  projectId: string;
  presetId: string;
  presetName: string;
  status: TestJobStatus;
  queuedAt: string;
  claimedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  leaseExpiresAt?: string;
  lastHeartbeatAt?: string;
  progress?: TestProgress;
  exitCode?: number | null;
  cancelRequested?: boolean;
  truncated?: boolean;
  logBytes?: number;
  logLines?: number;
  error?: string;
}
```

```ts
const ACTIVE = new Set<TestJobStatus>([
  "queued",
  "claimed",
  "running",
  "cancel_requested",
]);
const TERMINAL = new Set<TestJobStatus>([
  "passed",
  "failed",
  "cancelled",
  "timed_out",
  "agent_lost",
]);

export function isActiveStatus(status: TestJobStatus): boolean {
  return ACTIVE.has(status);
}

export function isTerminalStatus(status: TestJobStatus): boolean {
  return TERMINAL.has(status);
}
```

- [ ] **Step 4: Replace `z.unknown()` catalog validation with exact schemas**

```ts
export const TestProgressSchema = z.object({
  framework: z.enum(["jest", "cypress", "vitest", "unknown"]),
  completed: z.number().int().nonnegative().nullable(),
  total: z.number().int().positive().nullable(),
  percentage: z.number().min(0).max(100).nullable(),
  currentLabel: z.string().max(300).optional(),
  updatedAt: z.string().datetime(),
});

export const PollRequestSchema = z.object({
  agentId: z.string().min(1).max(128),
  catalogVersion: z.string().min(1),
  catalog: TestProjectCatalogSchema.optional(),
}).strict();

export const AppendLogBatchSchema = z.object({
  sequenceStart: z.number().int().nonnegative(),
  entries: z.array(z.object({
    stream: z.enum(["stdout", "stderr", "system"]),
    message: z.string().max(32_768),
  })).min(1).max(100),
  progress: TestProgressSchema.optional(),
}).strict();
```

- [ ] **Step 5: Run lifecycle and schema tests**

Run:

```powershell
npx vitest run tests/unit/test-runner/lifecycle.test.ts tests/unit/test-runner/schemas.test.ts
npm run typecheck
```

Expected: both test files PASS and typecheck exits 0.

- [ ] **Step 6: User-owned commit checkpoint**

Suggested message: `refactor: define production test runner lifecycle`

---

### Task 2: Redis invariants, idempotency, leases, and bounded logs

**Files:**

- Create: `src/lib/test-runner/keys.ts`
- Modify: `src/lib/test-runner/store.ts`
- Modify: `tests/unit/test-runner/store.test.ts`

**Interfaces:**

- Consumes: lifecycle and protocol types from Task 1.
- Produces:

```ts
enqueueJob(input, requesterHash, idempotencyKey): Promise<TestJob>
claimNextJob(agentId, now): Promise<TestJob | null>
heartbeatJob(jobId, agentId, progress, now): Promise<HeartbeatResult>
appendLogBatch(jobId, sequenceStart, entries, now): Promise<AppendLogResult>
readLogPage(jobId, afterSequence, limit): Promise<TestLogPage>
requestCancel(jobId): Promise<TestJob>
completeJob(jobId, result): Promise<TestJob>
reapStaleJobs(now): Promise<string[]>
```

- [ ] **Step 1: Add failing tests for single active job and idempotent enqueue**

```ts
it("returns the same job for a repeated idempotency key", async () => {
  await publishCatalog(sampleCatalog);
  const first = await enqueueJob(input, "requester", "run-123", sampleCatalog);
  const repeated = await enqueueJob(input, "requester", "run-123", sampleCatalog);
  expect(repeated.id).toBe(first.id);
});

it("rejects a second active job for the same agent", async () => {
  await publishCatalog(sampleCatalog);
  await enqueueJob(input, "requester", "run-1", sampleCatalog);
  await expect(
    enqueueJob(input, "requester", "run-2", sampleCatalog),
  ).rejects.toMatchObject({ code: "ACTIVE_JOB_EXISTS" });
});
```

- [ ] **Step 2: Add failing tests for lease expiry and Agent loss**

```ts
it("marks a running job agent_lost after its lease expires", async () => {
  const job = await createAndClaimJob();
  await heartbeatJob(job.id, "agent-win-1", undefined, new Date("2026-07-28T10:00:00Z"));
  const reaped = await reapStaleJobs(new Date("2026-07-28T10:00:46Z"));
  expect(reaped).toContain(job.id);
  expect((await getJob(job.id))?.status).toBe("agent_lost");
});
```

- [ ] **Step 3: Add failing tests for duplicate sequences and storage limits**

```ts
it("does not duplicate retried log sequences", async () => {
  await appendLogBatch(job.id, 0, entries, now);
  await appendLogBatch(job.id, 0, entries, now);
  const page = await readLogPage(job.id, -1, 200);
  expect(page.lines).toHaveLength(entries.length);
});

it("truncates at 1 MiB or 5000 lines and appends one marker", async () => {
  const result = await appendLogBatch(job.id, 0, oversizedEntries, now);
  expect(result.truncated).toBe(true);
  const page = await readLogPage(job.id, -1, 200);
  expect(page.lines.at(-1)?.message).toContain("Log truncated");
});
```

- [ ] **Step 4: Run store tests and verify the new cases fail**

Run:

```powershell
npx vitest run tests/unit/test-runner/store.test.ts
```

Expected: FAIL on missing idempotency, lease, cursor, and truncation behavior.

- [ ] **Step 5: Implement Redis keys and constants**

```ts
export const JOB_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LEASE_SECONDS = 45;
export const MAX_LOG_LINES = 5_000;
export const MAX_LOG_BYTES = 1_048_576;

export const runnerKeys = {
  catalog: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:catalog`,
  presence: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:presence`,
  queue: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:queue`,
  active: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:active`,
  job: (jobId: string) => `morniter:test-runner:v2:job:${jobId}`,
  logs: (jobId: string) => `morniter:test-runner:v2:job:${jobId}:logs`,
  logSequences: (jobId: string) => `morniter:test-runner:v2:job:${jobId}:sequences`,
  idempotency: (key: string) => `morniter:test-runner:v2:idempotency:${key}`,
  history: "morniter:test-runner:v2:history",
};
```

- [ ] **Step 6: Implement atomic active-job reservation and idempotency**

Use Redis `SET NX EX` for both idempotency and active-job keys. If active reservation fails, load the active job and throw `ActiveJobExistsError`. If an idempotency key already maps to a job, return that job instead of creating another.

```ts
const reserved = await redis.set(activeKey, jobId, {
  nx: true,
  ex: JOB_TTL_SECONDS,
});
if (reserved !== "OK") {
  const activeJobId = await redis.get<string>(activeKey);
  throw new ActiveJobExistsError(activeJobId);
}
```

- [ ] **Step 7: Implement lease heartbeat and stale-job reaping**

Heartbeat must verify both `job.agentId` and an active state, refresh `leaseExpiresAt`, store progress, and return `cancelRequested`. `reapStaleJobs()` transitions only expired `claimed`, `running`, and `cancel_requested` jobs to `agent_lost` and releases their active key.

- [ ] **Step 8: Implement pipelined idempotent log writes and cursor reads**

Store each serialized line in a sorted set scored by sequence. Before append, remove sequences already present. Pipeline the new entries, byte/line metadata, expiry, and job update. Read with `ZRANGEBYSCORE afterSequence +inf LIMIT 0 limit`, returning `nextSequence` and `hasMore`.

- [ ] **Step 9: Run store tests**

Run:

```powershell
npx vitest run tests/unit/test-runner/store.test.ts
npm run typecheck
```

Expected: store tests PASS and typecheck exits 0.

- [ ] **Step 10: User-owned commit checkpoint**

Suggested message: `feat: harden test runner Redis state`

---

### Task 3: Production API contract and execution security

**Files:**

- Modify: `src/lib/auth/execute-session.ts`
- Modify: `src/app/api/test-runner/auth/route.ts`
- Modify: `src/app/api/test-runner/catalog/route.ts`
- Modify: `src/app/api/test-runner/jobs/route.ts`
- Modify: `src/app/api/test-runner/jobs/[jobId]/route.ts`
- Modify: `src/app/api/test-runner/jobs/[jobId]/cancel/route.ts`
- Modify: `src/app/api/test-runner/agent/poll/route.ts`
- Modify: `src/app/api/test-runner/agent/jobs/[jobId]/logs/route.ts`
- Modify: `src/app/api/test-runner/agent/jobs/[jobId]/complete/route.ts`
- Create: `src/app/api/test-runner/agent/jobs/[jobId]/heartbeat/route.ts`
- Modify: `tests/integration/test-runner-auth-route.test.ts`
- Modify: `tests/integration/test-runner-browser-routes.test.ts`
- Modify: `tests/integration/test-runner-agent-routes.test.ts`

**Interfaces:**

- Browser mutation errors return `{ error: string, code: TestRunnerErrorCode }`.
- `POST /api/test-runner/jobs` requires `Idempotency-Key`.
- `GET /api/test-runner/jobs/:id?afterSequence=N&limit=200` returns job plus one log page.
- Agent heartbeat returns `{ cancelRequested: boolean }`.

- [ ] **Step 1: Write failing browser API tests**

```ts
function authorizedJobRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/test-runner/jobs", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      cookie: validReadAndExecuteCookies,
      ...headers,
    },
    body: JSON.stringify({
      projectId: "student-tracking",
      presetId: "cypress-e2e",
    }),
  });
}

it("rejects missing Idempotency-Key with 400", async () => {
  const response = await POST(authorizedJobRequest());
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "INVALID_IDEMPOTENCY_KEY",
  });
});

it("returns the existing job for a repeated Idempotency-Key", async () => {
  const request = () => authorizedJobRequest({ "Idempotency-Key": "run-123456789012" });
  const first = await POST(request());
  const repeated = await POST(request());
  expect(first.status).toBe(201);
  expect(repeated.status).toBe(200);
  expect((await repeated.json()).id).toBe((await first.json()).id);
});

it("returns ACTIVE_JOB_EXISTS with the active job on conflict", async () => {
  await POST(authorizedJobRequest({ "Idempotency-Key": "run-aaaaaaaaaaaa" }));
  const response = await POST(
    authorizedJobRequest({ "Idempotency-Key": "run-bbbbbbbbbbbb" }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    code: "ACTIVE_JOB_EXISTS",
    activeJob: expect.objectContaining({ status: "queued" }),
  });
});
```

In the same file, request `limit=500` and assert the store receives `200`. Mock the Redis timeout helper to reject and assert HTTP 503 with `REDIS_UNAVAILABLE`, while the monitor session remains authenticated.

- [ ] **Step 2: Write failing Agent API tests**

```ts
it("validates the full catalog instead of accepting unknown payloads", async () => {
  const response = await pollPOST(agentRequest({
    agentId: "agent-win-1",
    catalogVersion: "2",
    catalog: { projects: "invalid" },
  }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVALID_AGENT_PAYLOAD" });
});

it("refreshes a running lease and returns cancelRequested", async () => {
  vi.mocked(heartbeatJob).mockResolvedValue({
    cancelRequested: true,
    leaseExpiresAt: "2026-07-28T10:00:45.000Z",
  });
  const response = await heartbeatPOST(agentJobRequest("job-1", {
    observedAt: "2026-07-28T10:00:00.000Z",
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    cancelRequested: true,
    leaseExpiresAt: "2026-07-28T10:00:45.000Z",
  });
});

it("rejects completion from a different agent", async () => {
  vi.mocked(completeJob).mockRejectedValue(new AgentJobOwnershipError());
  const response = await completePOST(agentJobRequest("job-1", {
    status: "passed",
    exitCode: 0,
  }, "agent-win-2"));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "AGENT_JOB_MISMATCH" });
});
```

For the retried log case, POST the same `sequenceStart` and entries twice, then assert `readLogPage()` returns each sequence once.

- [ ] **Step 3: Run integration tests and verify failure**

Run:

```powershell
npx vitest run tests/integration/test-runner-auth-route.test.ts tests/integration/test-runner-browser-routes.test.ts tests/integration/test-runner-agent-routes.test.ts
```

Expected: FAIL on the new contract.

- [ ] **Step 4: Extend execution session lifetime to 30 minutes**

```ts
export const EXECUTE_SESSION_TTL_SECONDS = 30 * 60;
```

Keep `HttpOnly`, `SameSite=Strict`, path `/`, and `Secure` when `NODE_ENV === "production"`.

- [ ] **Step 5: Implement stable error mapping**

```ts
return NextResponse.json(
  { error: err.message, code: err.code, activeJob: err.activeJob ?? undefined },
  { status: err.status },
);
```

Do not return Redis credentials, executable paths, preset environment, or raw stack traces.

- [ ] **Step 6: Implement idempotent job creation and one-active-job response**

Read and validate `Idempotency-Key` as 16–128 URL-safe characters. Pass it to `enqueueJob()`. Return 201 for a new job, 200 for an idempotent replay, and 409 for a different active job.

- [ ] **Step 7: Implement Agent heartbeat and cursor log APIs**

Heartbeat body:

```ts
{
  progress?: TestProgress;
  observedAt: string;
}
```

Heartbeat response:

```ts
{
  cancelRequested: boolean;
  leaseExpiresAt: string;
}
```

- [ ] **Step 8: Add bounded timeouts around Redis-backed route work**

Use one helper that rejects after five seconds with `REDIS_UNAVAILABLE`. Do not retry inside Vercel requests; retries belong to the Agent or browser polling policy.

- [ ] **Step 9: Run integration and auth tests**

Run:

```powershell
npx vitest run tests/integration/test-runner-auth-route.test.ts tests/integration/test-runner-browser-routes.test.ts tests/integration/test-runner-agent-routes.test.ts
```

Expected: all targeted integration tests PASS.

- [ ] **Step 10: User-owned commit checkpoint**

Suggested message: `feat: add resilient test runner API contract`

---

### Task 4: Windows-safe executor and real cancellation

**Files:**

- Modify: `package.json`
- Create: `agent/src/process-adapter.ts`
- Modify: `agent/src/executor.ts`
- Modify: `tests/unit/test-agent/executor.test.ts`
- Create: `tests/unit/test-agent/process-adapter.test.ts`

**Interfaces:**

- Produces:

```ts
spawnPresetProcess(preset: ResolvedPreset): ChildProcessWithoutNullStreams
terminateProcessTree(pid: number, platform?: NodeJS.Platform): void
```

- Consumed by Agent runner and cancellation in Task 5.

- [ ] **Step 1: Add `cross-spawn`**

Run:

```powershell
npm install cross-spawn
npm install --save-dev @types/cross-spawn
```

Expected: `package.json` and lockfile include both packages.

- [ ] **Step 2: Write a failing Windows npm smoke test**

```ts
it.runIf(process.platform === "win32")(
  "runs npm.cmd without spawn EINVAL",
  async () => {
    const result = await runPreset({
      projectId: "morniter",
      presetId: "npm-version",
      name: "npm version",
      description: "",
      command: "npm",
      args: ["--version"],
      cwd: process.cwd(),
      env: {},
      timeoutSeconds: 20,
    }, { onLines: () => {} });

    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
  },
);
```

- [ ] **Step 3: Write failing timeout and AbortSignal tests**

```ts
it("kills a running process when aborted", async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);
  const result = await runPreset(longRunningPreset, { onLines: () => {} }, controller.signal);
  expect(result.status).toBe("cancelled");
});

it("kills a running process after preset timeout", async () => {
  const result = await runPreset(timeoutPreset, { onLines: () => {} });
  expect(result.status).toBe("timed_out");
});
```

- [ ] **Step 4: Run executor tests and verify the npm case fails with `spawn EINVAL`**

Run:

```powershell
npx vitest run tests/unit/test-agent/executor.test.ts tests/unit/test-agent/process-adapter.test.ts
```

Expected before implementation: Windows npm smoke test FAILS with `spawn EINVAL`.

- [ ] **Step 5: Implement the process adapter with `cross-spawn`**

```ts
import spawn from "cross-spawn";

export function spawnPresetProcess(preset: ResolvedPreset) {
  return spawn(resolveExecutable(preset.command), preset.args, {
    cwd: preset.cwd,
    env: { ...process.env, ...preset.env },
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
```

Terminate Windows trees without interpolated shell strings:

```ts
childProcess.spawnSync(
  "taskkill.exe",
  ["/PID", String(pid), "/T", "/F"],
  { shell: false, windowsHide: true, stdio: "ignore" },
);
```

- [ ] **Step 6: Make executor finalization single-shot**

Use one `finish()` function guarded by a boolean. It must clear timers and abort listeners, flush buffers, and resolve exactly once for error, close, timeout, or cancellation.

- [ ] **Step 7: Run executor tests and build the Agent**

Run:

```powershell
npx vitest run tests/unit/test-agent/executor.test.ts tests/unit/test-agent/process-adapter.test.ts
npm run test-agent:build
```

Expected: tests PASS, Agent TypeScript build exits 0, and `npm --version` no longer raises `spawn EINVAL`.

- [ ] **Step 8: User-owned commit checkpoint**

Suggested message: `fix: execute npm presets safely on Windows`

---

### Task 5: Agent heartbeat, cancellation, backpressure, and progress parsing

**Files:**

- Create: `agent/src/log-batcher.ts`
- Create: `agent/src/progress/types.ts`
- Create: `agent/src/progress/jest.ts`
- Create: `agent/src/progress/cypress.ts`
- Create: `agent/src/progress/vitest.ts`
- Create: `agent/src/progress/index.ts`
- Modify: `agent/src/client.ts`
- Modify: `agent/src/runner.ts`
- Modify: `agent/src/types.ts`
- Create: `tests/unit/test-agent/log-batcher.test.ts`
- Create: `tests/unit/test-agent/progress.test.ts`
- Modify: `tests/unit/test-agent/runner.test.ts`

**Interfaces:**

- `LogBatcher.push(stream, lines)` buffers output.
- `LogBatcher.flush()` uploads sequentially.
- `LogBatcher.drain()` resolves when all pending output is uploaded.
- `createProgressParser(commandPreview)` selects Jest, Cypress, Vitest, or fallback.
- `AgentClient.heartbeat()` returns cancellation state.

- [ ] **Step 1: Write parser tests from real framework summary lines**

```ts
it("parses Jest test counts", () => {
  const parser = createProgressParser("npm run test");
  const progress = parser.consume("stdout", [
    "Tests: 2 failed, 258 passed, 260 total",
  ]);
  expect(progress).toMatchObject({
    framework: "jest",
    completed: 260,
    total: 260,
    percentage: 100,
  });
});

it("falls back without inventing percentage", () => {
  const parser = createProgressParser("node custom-test.js");
  expect(parser.consume("stdout", ["running phase two"])).toMatchObject({
    framework: "unknown",
    percentage: null,
  });
});
```

- [ ] **Step 2: Write bounded batcher tests**

```ts
it("flushes at 100 lines and serializes uploads", async () => {
  const uploads: number[][] = [];
  let concurrent = 0;
  let maxConcurrent = 0;
  const batcher = new LogBatcher(async (batch) => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    uploads.push(batch.entries.map((entry) => entry.sequence));
    await Promise.resolve();
    concurrent -= 1;
  });

  batcher.push("stdout", Array.from({ length: 200 }, (_, index) => `line-${index}`));
  await batcher.drain();

  expect(uploads).toHaveLength(2);
  expect(uploads[0]).toHaveLength(100);
  expect(maxConcurrent).toBe(1);
});

it("flushes after 250 ms", async () => {
  vi.useFakeTimers();
  const upload = vi.fn().mockResolvedValue(undefined);
  const batcher = new LogBatcher(upload);
  batcher.push("stdout", ["one line"]);
  await vi.advanceTimersByTimeAsync(249);
  expect(upload).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(upload).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

it("truncates after 512 KiB pending data", async () => {
  const neverResolvingUpload = vi.fn(() => new Promise<void>(() => undefined));
  const batcher = new LogBatcher(neverResolvingUpload);
  batcher.push("stdout", Array.from({ length: 600 }, () => "x".repeat(1024)));
  expect(batcher.isTruncated()).toBe(true);
  expect(batcher.pendingBytes()).toBeLessThanOrEqual(512 * 1024);
});
```

Add one 32 KiB boundary case using multibyte UTF-8 text and assert every uploaded batch reports `byteLength <= 32 * 1024`.

- [ ] **Step 3: Write runner tests for heartbeat cancellation and final log drain**

```ts
it("aborts the executor when heartbeat returns cancelRequested", async () => {
  vi.mocked(client.heartbeat).mockResolvedValue({
    cancelRequested: true,
    leaseExpiresAt: new Date(Date.now() + 45_000).toISOString(),
  });
  await executeClaimedJob(config, job, client);
  expect(runPreset).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({ aborted: true }),
  );
});

it("does not complete before pending logs drain", async () => {
  const order: string[] = [];
  vi.mocked(logBatcher.drain).mockImplementation(async () => {
    order.push("drain");
  });
  vi.mocked(client.complete).mockImplementation(async () => {
    order.push("complete");
  });
  await executeClaimedJob(config, job, client);
  expect(order).toEqual(["drain", "complete"]);
});
```

Use fake timers for a delayed log upload, advance by five seconds, and assert `client.heartbeat` runs before the upload resolves. Assert the Agent never writes `agent_lost`; that transition is owned by `reapStaleJobs()` on the server.

- [ ] **Step 4: Run the new Agent tests and verify failure**

Run:

```powershell
npx vitest run tests/unit/test-agent/log-batcher.test.ts tests/unit/test-agent/progress.test.ts tests/unit/test-agent/runner.test.ts
```

Expected: FAIL because batching, parser, and heartbeat behavior do not exist.

- [ ] **Step 5: Implement progress parsers**

Each parser consumes lines independently and returns the newest complete progress snapshot. Clamp percentage to 0–100. Parsing exceptions return `null` and never escape into execution.

- [ ] **Step 6: Implement sequential bounded batching**

Use a promise chain for upload order, a 250 ms timer, and explicit byte accounting with `Buffer.byteLength(message, "utf8")`. When pending bytes exceed 512 KiB, emit one system truncation message and ignore later output.

- [ ] **Step 7: Implement five-second heartbeat and cancellation**

Start heartbeat immediately after claim. Store the latest parser progress in the heartbeat. When the response has `cancelRequested: true`, abort the executor. Clear heartbeat in a `finally` block.

- [ ] **Step 8: Await log drain before completion**

Runner order must be:

```ts
const result = await runPreset(...);
await logBatcher.drain();
await client.complete(job.id, result);
```

If drain retries are exhausted, complete the job with its process result plus `logsIncomplete: true` rather than hanging forever.

- [ ] **Step 9: Run all Agent tests and build**

Run:

```powershell
npx vitest run tests/unit/test-agent
npm run test-agent:build
```

Expected: all Agent unit tests PASS and the Agent build exits 0.

- [ ] **Step 10: User-owned commit checkpoint**

Suggested message: `feat: stream bounded test progress from local agent`

---

### Task 6: Shared monitor shell and separate Logs/Tests routes

**Files:**

- Create: `src/app/monitor/layout.tsx`
- Create: `src/app/monitor/tests/page.tsx`
- Create: `src/components/monitor/MonitorShell.tsx`
- Create: `src/components/monitor/MonitorLogsPage.tsx`
- Modify: `src/app/monitor/page.tsx`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Create: `tests/components/MonitorShell.test.tsx`
- Modify: `e2e/monitor.spec.ts`
- Modify: `e2e/test-runner.spec.ts`

**Interfaces:**

- `MonitorShell` accepts `displayName` and `children`.
- Logs route owns provider snapshot polling.
- Tests route owns only Test Runner APIs.

- [ ] **Step 1: Write failing navigation component tests**

```tsx
it("marks Logs active on /monitor", () => {
  vi.mocked(usePathname).mockReturnValue("/monitor");
  render(<MonitorShell displayName="Morniter"><div>content</div></MonitorShell>);
  expect(screen.getByRole("link", { name: "Logs" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Tests" })).not.toHaveAttribute(
    "aria-current",
  );
});

it("marks Tests active and keeps logout visible", () => {
  vi.mocked(usePathname).mockReturnValue("/monitor/tests");
  render(<MonitorShell displayName="Morniter"><div>content</div></MonitorShell>);
  expect(screen.getByRole("link", { name: "Tests" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: "Logout" })).toBeVisible();
});
```

- [ ] **Step 2: Write failing E2E route tests**

```ts
test("Logs is the default route and Tests has a stable URL", async ({ page }) => {
  await page.goto("/monitor");
  await expect(page.getByRole("link", { name: "Logs" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Tests" }).click();
  await expect(page).toHaveURL(/\/monitor\/tests$/);
  await expect(page.getByRole("link", { name: "Tests" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
npx vitest run tests/components/MonitorShell.test.tsx
npx playwright test e2e/monitor.spec.ts e2e/test-runner.spec.ts
```

Expected: FAIL because the shared layout and Tests route do not exist.

- [ ] **Step 4: Move session protection into the route layout**

`src/app/monitor/layout.tsx` calls `requireMonitorSession()`, redirects only for invalid monitor sessions, reads `MONITOR_DISPLAY_NAME`, and wraps children in `MonitorShell`.

- [ ] **Step 5: Implement route-aware navigation**

Use `usePathname()` and exact route matching. Links must have `aria-current="page"` when active and remain keyboard accessible.

- [ ] **Step 6: Extract provider-only Logs page**

Move provider snapshot polling, filters, incidents, service cards, and `TerminalPanel` into `MonitorLogsPage`. Remove `TestRunnerPanel` from the Logs component entirely.

- [ ] **Step 7: Add Tests route**

`src/app/monitor/tests/page.tsx` renders `TestRunnerWorkspace` without requesting provider snapshot data.

- [ ] **Step 8: Run component and E2E navigation tests**

Run:

```powershell
npx vitest run tests/components/MonitorShell.test.tsx
npx playwright test e2e/monitor.spec.ts e2e/test-runner.spec.ts
```

Expected: navigation tests PASS; `/monitor` loads Logs and `/monitor/tests` loads Tests.

- [ ] **Step 9: User-owned commit checkpoint**

Suggested message: `feat: split monitor logs and tests routes`

---

### Task 7: Production Test Runner workspace UI

**Files:**

- Create: `src/components/test-runner/TestRunnerWorkspace.tsx`
- Create: `src/components/test-runner/AgentStatusBanner.tsx`
- Create: `src/components/test-runner/PresetLauncher.tsx`
- Create: `src/components/test-runner/RunConfirmation.tsx`
- Create: `src/components/test-runner/RunProgress.tsx`
- Create: `src/components/test-runner/LiveTestTerminal.tsx`
- Create: `src/components/test-runner/useTestRunner.ts`
- Modify: `src/components/test-runner/ExecutionUnlock.tsx`
- Modify: `src/components/test-runner/JobHistory.tsx`
- Remove after migration: `src/components/test-runner/TestRunnerPanel.tsx`
- Remove after migration: `src/components/test-runner/JobTerminal.tsx`
- Modify: `tests/components/TestRunnerPanel.test.tsx`
- Create: `tests/components/TestRunnerWorkspace.test.tsx`
- Create: `tests/components/LiveTestTerminal.test.tsx`

**Interfaces:**

- `useTestRunner()` returns availability, lock state, catalog, selected preset, active job, log page state, history, and action methods.
- `LiveTestTerminal` consumes cursor pages and keeps at most 1,000 rendered lines.

- [ ] **Step 1: Write failing workspace tests**

```tsx
it("disables Run while locked and never renders private config", async () => {
  mockCatalog({ state: "online", cwd: "E:\\secret", env: { API_KEY: "hidden" } });
  render(<TestRunnerWorkspace />);
  expect(await screen.findByRole("button", { name: "Run Frontend Tests" }))
    .toBeDisabled();
  expect(screen.queryByText(/E:\\secret/)).not.toBeInTheDocument();
  expect(screen.queryByText("hidden")).not.toBeInTheDocument();
});

it("shows confirmation before creating a job", async () => {
  const user = userEvent.setup();
  const createJob = mockCreateJob();
  render(<TestRunnerWorkspace />);
  await unlockExecution(user);
  await user.click(await screen.findByRole("button", { name: "Run Frontend Tests" }));
  expect(screen.getByRole("dialog", { name: "Confirm test run" })).toBeVisible();
  expect(createJob).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm Run" }));
  expect(createJob).toHaveBeenCalledTimes(1);
});

it("shows parsed and indeterminate progress honestly", async () => {
  mockActiveJob({ completed: 129, total: 258, percentage: 50 });
  const { rerender } = render(<TestRunnerWorkspace />);
  expect(await screen.findByText("129 / 258")).toBeVisible();
  expect(screen.getByText("50%")).toBeVisible();
  mockActiveJob({ completed: null, total: null, percentage: null });
  rerender(<TestRunnerWorkspace />);
  expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  expect(screen.getByText("Running")).toBeVisible();
});
```

Add an active-job fixture and assert every preset Run button is disabled. Add a lagging-presence fixture and assert `Agent lagging` appears while `Agent offline` does not.

- [ ] **Step 2: Write failing polling tests**

Use fake timers and mocked fetch:

```ts
it("polls every two seconds without overlapping requests", async () => {
  vi.useFakeTimers();
  const deferred = createDeferred<Response>();
  const fetchJob = vi.fn().mockReturnValueOnce(deferred.promise);
  renderHook(() => useTestRunner({ fetchJob }));
  await vi.advanceTimersByTimeAsync(4_000);
  expect(fetchJob).toHaveBeenCalledTimes(1);
  deferred.resolve(jobResponse({ status: "running" }));
  await deferred.promise;
  await vi.advanceTimersByTimeAsync(2_000);
  expect(fetchJob).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});

it("pauses while hidden and resumes from the last sequence", async () => {
  setDocumentVisibility("hidden");
  const fetchJob = vi.fn();
  const { result } = renderHook(() => useTestRunner({ fetchJob }));
  result.current.setLastSequence(431);
  await advanceActivePoll();
  expect(fetchJob).not.toHaveBeenCalled();
  setDocumentVisibility("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(fetchJob).toHaveBeenCalledWith(expect.objectContaining({
    afterSequence: 431,
  }));
});
```

Add an idle fixture, advance 59,999 ms and assert no refresh, then advance one millisecond and assert one refresh. Change the selected history job and assert the previous request’s `AbortSignal.aborted` becomes true.

- [ ] **Step 3: Write failing terminal-bound tests**

```tsx
it("renders at most 1000 tagged lines", () => {
  const lines = Array.from({ length: 1_200 }, (_, sequence) => ({
    sequence,
    stream: sequence % 2 ? "stdout" : "stderr",
    message: `line-${sequence}`,
    timestamp: "2026-07-28T10:00:00.000Z",
  }));
  render(<LiveTestTerminal lines={lines} hasOlder={false} onLoadOlder={vi.fn()} />);
  expect(screen.getAllByTestId("terminal-line")).toHaveLength(1_000);
  expect(screen.getAllByText(/stdout|stderr/)).toHaveLength(1_000);
});

it("loads older lines and disables auto-scroll after manual scroll", async () => {
  const user = userEvent.setup();
  const onLoadOlder = vi.fn();
  render(<LiveTestTerminal lines={smallLog} hasOlder onLoadOlder={onLoadOlder} />);
  await user.click(screen.getByRole("button", { name: "Load older logs" }));
  expect(onLoadOlder).toHaveBeenCalledTimes(1);
  fireEvent.scroll(screen.getByRole("log"), { target: { scrollTop: 0 } });
  expect(screen.getByText("Auto-scroll paused")).toBeVisible();
});
```

- [ ] **Step 4: Run component tests and verify failure**

Run:

```powershell
npx vitest run tests/components/TestRunnerWorkspace.test.tsx tests/components/LiveTestTerminal.test.tsx
```

Expected: FAIL because the workspace components do not exist.

- [ ] **Step 5: Implement `useTestRunner()` as the single coordinator**

Generate idempotency keys with `crypto.randomUUID()`. Keep one `AbortController` per request type. Do not start another poll while the previous request is pending. On visibility resume, fetch presence, active job, and logs after the last sequence.

- [ ] **Step 6: Implement preset shortcut cards and confirmation**

Cards show preset name, description, framework label, command preview, and timeout. Confirmation repeats safe metadata only. The Run action remains disabled when locked, unavailable, lagging, or active.

- [ ] **Step 7: Implement stage and framework progress**

Render the approved stage rail:

```text
Queued → Claimed → Running → Result
```

Show percentage only when both `completed` and `total` are non-null. Always show elapsed time from server timestamps.

- [ ] **Step 8: Implement the bounded terminal and failure summary**

Keep the newest 1,000 lines, allow older cursor pages on demand, tag every line by stream, and preserve text labels independent of color. On failure, show status, exit code, duration, error, and the newest stderr line above the terminal.

- [ ] **Step 9: Implement history filters**

Filter the 20 most recent jobs by project and status in the browser. Selecting a historical job loads its first cursor page and does not change the active running job state.

- [ ] **Step 10: Remove migrated monolithic components**

Delete `TestRunnerPanel.tsx` and `JobTerminal.tsx` only after no imports remain:

```powershell
rg -n "TestRunnerPanel|JobTerminal" src tests e2e
```

Expected before deletion: only migration targets. Expected after deletion: no stale imports.

- [ ] **Step 11: Run component tests and typecheck**

Run:

```powershell
npx vitest run tests/components
npm run typecheck
```

Expected: all component tests PASS and typecheck exits 0.

- [ ] **Step 12: User-owned commit checkpoint**

Suggested message: `feat: add production test runner workspace`

---

### Task 8: End-to-end recovery, overload, and security verification

**Files:**

- Modify: `e2e/test-runner.spec.ts`
- Create: `e2e/test-runner-recovery.spec.ts`
- Create: `e2e/test-runner-overload.spec.ts`
- Modify: `tests/integration/test-runner-agent-routes.test.ts`
- Modify: `tests/integration/test-runner-browser-routes.test.ts`

**Interfaces:**

- Exercises the complete public browser contract and mocked runner protocol.

- [ ] **Step 1: Add E2E success and framework progress**

Mock the Agent lifecycle and verify:

```text
Login → Tests → Unlock → Select preset → Confirm → Queued
→ Claimed → Running 129/258 → Passed 258/258 → History
```

Assert that the terminal retains stdout/stderr/system tags and the page URL remains `/monitor/tests`.

- [ ] **Step 2: Add E2E cancellation and timeout**

Verify `cancel_requested` appears before `cancelled`, Run remains disabled during cancellation, and timeout shows the configured duration.

- [ ] **Step 3: Add E2E refresh and Agent-loss recovery**

Start a running job, reload the route, return the same active job and cursor, then simulate heartbeat expiry and verify `agent_lost` with a concrete recovery message.

- [ ] **Step 4: Add overload tests**

Verify:

- double-click submits one idempotency key and creates one job;
- a second distinct Run receives `ACTIVE_JOB_EXISTS`;
- hidden tabs stop active polling;
- log responses are capped at 200 lines;
- rendered terminal lines never exceed 1,000;
- `Log truncated` appears exactly once.

- [ ] **Step 5: Add security assertions**

Inspect catalog, job, log, and error responses. Assert they do not contain `cwd`, `env`, `agentToken`, `UPSTASH_REDIS_REST_TOKEN`, or configured secret values.

- [ ] **Step 6: Run focused E2E**

Run:

```powershell
npx playwright test e2e/test-runner.spec.ts e2e/test-runner-recovery.spec.ts e2e/test-runner-overload.spec.ts
```

Expected: all focused Test Runner E2E tests PASS.

- [ ] **Step 7: User-owned commit checkpoint**

Suggested message: `test: cover test runner recovery and overload`

---

### Task 9: Documentation, production smoke, and release gate

**Files:**

- Modify: `agent/test-runner.config.example.json`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/superpowers/specs/2026-07-28-production-test-runner-navigation-design.md` only if implementation reveals a reviewed design correction.

**Interfaces:**

- Produces the operator runbook and release evidence.

- [ ] **Step 1: Add safe example presets**

The example config must include a harmless smoke preset and representative project tests:

```json
{
  "id": "morniter-smoke",
  "name": "Morniter Agent Smoke",
  "description": "Verify the Local Agent can launch Node",
  "command": "node",
  "args": ["--version"],
  "cwd": "E:\\project-monitor",
  "timeoutSeconds": 30
}
```

Keep all secrets as documented environment variable names, never literal values.

- [ ] **Step 2: Document startup and recovery**

Document:

```powershell
npm install
npm run test-agent:build
npm run test-agent
```

Include Agent Offline, Agent Lagging, Redis unavailable, token mismatch, `spawn EINVAL`, cancellation, and log truncation recovery steps.

- [ ] **Step 3: Run the full local quality gate**

Run:

```powershell
npm run test
npm run typecheck
npm run lint
npm run test-agent:build
npm run build
npm run test:e2e
```

Expected: every command exits 0. Record any warning separately; no failing test or build warning involving secrets, route errors, or hydration is acceptable.

- [ ] **Step 4: Run the direct STS frontend baseline**

Run:

```powershell
npm run test
```

Working directory:

```text
E:\ProjectSTS\frontend
```

Expected:

```text
tests 258
pass 258
fail 0
```

- [ ] **Step 5: Run deployed Morniter smoke through the UI**

Prerequisites:

- Vercel production has the four Test Runner environment values.
- `UPSTASH_REDIS_REST_URL` begins with `https://`.
- Local Agent token matches Vercel.
- Agent is running with the production server URL.

Execute `Morniter Agent Smoke` from `/monitor/tests`. Expected:

```text
queued → claimed → running → passed
exit code 0
```

- [ ] **Step 6: Run STS frontend through deployed Morniter**

Select `STS Frontend Tests`. Expected final state:

```text
passed
258 / 258 tests
100%
exit code 0
```

Refresh the browser during execution and verify logs resume without duplication.

- [ ] **Step 7: Validate resource bounds**

In Upstash metrics and browser network inspection, verify:

- one active Agent heartbeat every five seconds;
- no provider polling on `/monitor/tests`;
- no Test Runner polling on `/monitor`;
- log pages never exceed 200 lines;
- idle polling backs off;
- expired seven-day job data is removed.

- [ ] **Step 8: User-owned final commit checkpoint**

Suggested message: `docs: add production test runner runbook`

---

## Plan self-review checklist

- [ ] Every approved design decision maps to a task.
- [ ] Windows `spawn EINVAL` has an executable smoke test and implementation task.
- [ ] Cancel reaches the process tree rather than changing only Redis state.
- [ ] Agent heartbeat is independent from log upload.
- [ ] Log upload is sequential, bounded, idempotent, and drained before completion.
- [ ] Redis storage enforces both byte and line limits.
- [ ] The browser uses cursor paging and bounded rendering.
- [ ] Logs and Tests routes do not load each other’s polling workload.
- [ ] Jest, Cypress, Vitest, and unknown progress are covered.
- [ ] No browser response exposes command paths, environment, or Agent token.
- [ ] Git operations remain user-owned.
