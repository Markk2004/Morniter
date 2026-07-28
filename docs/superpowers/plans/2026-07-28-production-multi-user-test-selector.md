# Production Multi-User Test Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ป้องกันผู้ใช้หลายคนสร้าง test job ซ้อนบน local agent เดียว และเปลี่ยน preset shortcut cards เป็น Project dropdown + Test dropdown + Run button ที่ต้องยืนยันก่อนรัน

**Architecture:** Upstash Redis ใช้ Lua reservation operation เดียวเพื่อตรวจ idempotency, active lease และ queue capacity ก่อนจอง job ID จากนั้น heartbeat ต่ออายุ lease และ terminal lifecycle ปลด lease ผ่าน compare-and-delete หน้า Tests อ่าน shared active job เดียวกัน ใช้ dropdown state เฉพาะ browser tab และปิด selector ทุกเครื่องเมื่อมีงาน active แผนนี้ทำงานร่วมกับ cache/loading plan ที่ `docs/superpowers/plans/2026-07-28-production-cache-loading-readiness.md`

**Tech Stack:** Next.js App Router, React 19, TypeScript, Upstash Redis, Vitest, Playwright, local Node agent

## Implementation Status (2026-07-28)

- [x] Atomic active lease, idempotency reservation, lifecycle renewal/release, and requester label are implemented.
- [x] Project/Test dropdown selector, confirmation details, shared active-job lock, and guarded agent heartbeat are implemented.
- [x] Test Runner uses `no-store` requests, adaptive non-overlapping polling, visibility cleanup, sequence deduplication, and a 300-line terminal render cap.
- [x] Local verification passed: `npm run test` (48 files, 198 tests), `npm run lint`, `npm run typecheck`, `npm run test-agent:build`, `npm run build`, and Playwright E2E (9 tests).
- [ ] External production verification remains: deployed multi-user smoke test, 20-request concurrency stress test against the configured Redis, and real lease recovery after stopping the local agent.

## Global Constraints

- หนึ่ง `agentId` มี active job ได้ไม่เกินหนึ่งงาน
- Active lease มีอายุ 45 วินาทีและต่ออายุจาก heartbeat ทุก 5 วินาที
- Dropdown ต้องเริ่มจาก project แรกและ test ว่างเสมอ
- เปลี่ยน project ต้องล้าง selected test และปิด confirmation
- ยืนยันทุก run พร้อม project, command, timeout, risk และ database target
- เมื่อมี active job ให้ปิด Project dropdown, Test dropdown และ Run button ทุก browser
- ห้ามเพิ่ม arbitrary command input หรือรันคำสั่งที่ไม่อยู่ใน agent catalog
- ห้ามแสดง IP; แสดงเฉพาะ `requesterLabel` แบบ salted hash 8 ตัวอักษร
- ไม่เพิ่มระบบ queue หลายงานและไม่รัน test ขนาน
- งาน Git เป็นของผู้ใช้ ทุก task จบด้วย user-managed Git checkpoint และไม่มีคำสั่ง Git ในแผนนี้

---

## File Map

- Create `src/lib/test-runner/active-lease.ts`: acquire, renew และ release active lease แบบ atomic
- Create `tests/unit/test-runner/active-lease.test.ts`: ทดสอบ NX lock และ compare-and-delete/expire
- Modify `src/lib/test-runner/keys.ts`: เพิ่ม reservation TTL constant หากต้องใช้ระหว่าง create
- Modify `src/lib/test-runner/types.ts`: เพิ่ม `requesterLabel` ใน `TestJob`
- Modify `src/lib/test-runner/store.ts`: ใช้ active lease ใน enqueue, heartbeat, complete, cancel และ reconciliation
- Modify `src/app/api/test-runner/jobs/route.ts`: สร้าง requester label และ map active conflict เป็น 409
- Modify `agent/src/runner.ts`: เปลี่ยน heartbeat เป็น non-overlapping loop
- Modify `src/components/test-runner/PresetLauncher.tsx`: dropdown selector และ details panel
- Modify `src/components/test-runner/RunConfirmation.tsx`: แสดงรายละเอียดที่อนุมัติครบ
- Modify `src/components/test-runner/TestRunnerWorkspace.tsx`: ส่ง active job และ shared lock state เข้า selector
- Modify `src/components/test-runner/useTestRunner.ts`: sync active job จาก shared catalog/job responses
- Modify `src/components/test-runner/RunProgress.tsx`: แสดง project และ requester label
- Modify `tests/unit/test-runner/store.test.ts`: concurrent enqueue และ lease lifecycle
- Modify `tests/unit/test-agent/runner.test.ts`: heartbeat request ไม่ซ้อน
- Modify `tests/components/TestRunnerWorkspace.test.tsx`: selector disabled ตาม shared active state
- Replace assertions in `tests/components/TestRunnerPanel.test.tsx`: ทดสอบ dropdown แทน preset cards
- Create `e2e/multi-user-test-runner.spec.ts`: สอง browser contexts เห็น active job เดียวกัน

---

### Task 1: Atomic Active Lease Primitives

**Files:**
- Create: `src/lib/test-runner/active-lease.ts`
- Create: `tests/unit/test-runner/active-lease.test.ts`
- Modify: `src/lib/test-runner/keys.ts`

**Interfaces:**
- Produces: `reserveJobCreation(agentId: string, idempotencyKey: string, jobId: string): Promise<JobReservationResult>`
- Produces: `renewActiveLease(agentId: string, jobId: string): Promise<boolean>`
- Produces: `releaseActiveLease(agentId: string, jobId: string): Promise<boolean>`
- Produces: `commitIdempotencyReservation(idempotencyKey: string, jobId: string): Promise<boolean>`
- Produces: `releaseIdempotencyReservation(idempotencyKey: string, jobId: string): Promise<boolean>`
- Produces: `readActiveLease(agentId: string): Promise<string | null>`
- Consumes: `getRunnerRedis()`, `runnerKeys.active(agentId)`, `LEASE_SECONDS`

- [ ] **Step 1: Write failing lease tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reserveJobCreation,
  readActiveLease,
  releaseActiveLease,
  renewActiveLease,
} from "@/lib/test-runner/active-lease";

describe("active lease", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reserves idempotency and active lease atomically", async () => {
    await expect(reserveJobCreation("agent-1", "idem-1", "job-1")).resolves.toEqual({
      kind: "acquired",
      jobId: "job-1",
    });
    await expect(reserveJobCreation("agent-1", "idem-2", "job-2")).resolves.toEqual({
      kind: "active",
      jobId: "job-1",
    });
    await expect(readActiveLease("agent-1")).resolves.toBe("job-1");
  });

  it("returns the reserved job for concurrent idempotency replay", async () => {
    await reserveJobCreation("agent-1", "idem-1", "job-1");
    await expect(reserveJobCreation("agent-1", "idem-1", "job-2")).resolves.toEqual({
      kind: "idempotent",
      jobId: "job-1",
    });
  });

  it("renews and releases only the owning job", async () => {
    await reserveJobCreation("agent-1", "idem-1", "job-1");
    await expect(renewActiveLease("agent-1", "job-2")).resolves.toBe(false);
    await expect(releaseActiveLease("agent-1", "job-2")).resolves.toBe(false);
    await expect(renewActiveLease("agent-1", "job-1")).resolves.toBe(true);
    await expect(releaseActiveLease("agent-1", "job-1")).resolves.toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and verify missing module failure**

Run: `npx vitest run tests/unit/test-runner/active-lease.test.ts`

Expected: FAIL because `active-lease.ts` does not exist

- [ ] **Step 3: Implement atomic reservation and read**

```ts
import "server-only";
import { getRunnerRedis } from "./redis";
import { LEASE_SECONDS, runnerKeys } from "./keys";

export type JobReservationResult =
  | { kind: "acquired"; jobId: string }
  | { kind: "idempotent"; jobId: string }
  | { kind: "active"; jobId: string }
  | { kind: "queue_full"; jobId: null };

const RESERVE_SCRIPT = `
local existing = redis.call("GET", KEYS[1])
if existing then return {"IDEMPOTENT", existing} end
local active = redis.call("GET", KEYS[2])
if active then return {"ACTIVE", active} end
if tonumber(redis.call("LLEN", KEYS[3])) >= tonumber(ARGV[2]) then
  return {"QUEUE_FULL", ""}
end
redis.call("SET", KEYS[1], ARGV[1], "EX", 30)
redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[3])
return {"ACQUIRED", ARGV[1]}
`;

export async function reserveJobCreation(
  agentId: string,
  idempotencyKey: string,
  jobId: string,
): Promise<JobReservationResult> {
  const [status, reservedJobId] = await getRunnerRedis().eval<[string, string]>(
    RESERVE_SCRIPT,
    [runnerKeys.idempotency(idempotencyKey), runnerKeys.active(agentId), runnerKeys.queue(agentId)],
    [jobId, "1", String(LEASE_SECONDS)],
  );
  if (status === "ACQUIRED") return { kind: "acquired", jobId: reservedJobId };
  if (status === "IDEMPOTENT") return { kind: "idempotent", jobId: reservedJobId };
  if (status === "ACTIVE") return { kind: "active", jobId: reservedJobId };
  return { kind: "queue_full", jobId: null };
}

export async function readActiveLease(agentId: string): Promise<string | null> {
  return (await getRunnerRedis().get<string>(runnerKeys.active(agentId))) ?? null;
}
```

- [ ] **Step 4: Implement compare-and-expire and compare-and-delete**

Reservation keys are written inside Lua as raw job ID strings จึงให้ renew/release scripts เปรียบเทียบกับ raw `jobId` โดยตรง

```ts
const RENEW_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
  return redis.call("EXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export async function renewActiveLease(agentId: string, jobId: string): Promise<boolean> {
  const result = await getRunnerRedis().eval<number>(
    RENEW_SCRIPT,
    [runnerKeys.active(agentId)],
    [jobId, String(LEASE_SECONDS)],
  );
  return result === 1;
}

export async function releaseActiveLease(agentId: string, jobId: string): Promise<boolean> {
  const result = await getRunnerRedis().eval<number>(
    RELEASE_SCRIPT,
    [runnerKeys.active(agentId)],
    [jobId],
  );
  return result === 1;
}
```

Add `commitIdempotencyReservation` as compare-and-expire to extend the reservation from 30 seconds to 3,600 seconds after the job record and queue write succeed. Add `releaseIdempotencyReservation` as compare-and-delete for failed creation cleanup.

```ts
export async function commitIdempotencyReservation(
  idempotencyKey: string,
  jobId: string,
): Promise<boolean> {
  const result = await getRunnerRedis().eval<number>(
    RENEW_SCRIPT,
    [runnerKeys.idempotency(idempotencyKey)],
    [jobId, "3600"],
  );
  return result === 1;
}

export async function releaseIdempotencyReservation(
  idempotencyKey: string,
  jobId: string,
): Promise<boolean> {
  const result = await getRunnerRedis().eval<number>(
    RELEASE_SCRIPT,
    [runnerKeys.idempotency(idempotencyKey)],
    [jobId],
  );
  return result === 1;
}
```

- [ ] **Step 5: Run lease tests**

Run: `npx vitest run tests/unit/test-runner/active-lease.test.ts`

Expected: PASS; concurrent idempotency returns one job ID, another key sees active conflict, and wrong owner cannot renew or release

- [ ] **Step 6: User-managed Git checkpoint**

Review only lease helpers, Redis serialization assumptions and tests before the user commits manually.

### Task 2: Make Job Creation and Lifecycle Lease-Aware

**Files:**
- Modify: `src/lib/test-runner/types.ts`
- Modify: `src/lib/test-runner/store.ts`
- Modify: `src/app/api/test-runner/jobs/route.ts`
- Modify: `tests/unit/test-runner/store.test.ts`
- Modify: `tests/integration/test-runner-browser-routes.test.ts`

**Interfaces:**
- Consumes: lease helpers from Task 1
- Produces: `TestJob.requesterLabel: string`
- Produces: atomic conflict response `{ error, code: "ACTIVE_JOB_EXISTS", activeJob }`

- [ ] **Step 1: Add a concurrent enqueue test**

```ts
it("creates one job when two users enqueue concurrently", async () => {
  const attempts = await Promise.allSettled([
    enqueueJob(input, "operator-a", "idem-concurrent-a", catalog, "agent-1", now),
    enqueueJob(input, "operator-b", "idem-concurrent-b", catalog, "agent-1", now),
  ]);

  expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  const rejected = attempts.find((item) => item.status === "rejected");
  expect(rejected).toMatchObject({ reason: expect.any(ActiveJobExistsError) });
});
```

Add tests proving a completed job cannot release a newer job's lease and idempotency replay returns the original job.

- [ ] **Step 2: Run the store test and observe the race**

Run: `npx vitest run tests/unit/test-runner/store.test.ts`

Expected: FAIL because both concurrent calls can pass the current read-then-write check

- [ ] **Step 3: Add requester label to the job type**

```ts
export interface TestJob {
  id: string;
  requesterLabel: string;
  // keep the existing fields unchanged
}
```

Update fixtures with deterministic values such as `Operator ab12cd34`.

- [ ] **Step 4: Reserve creation before writing the job**

Resolve catalog/project/preset first, generate `jobId`, then call `reserveJobCreation(agentId, idempotencyKey, jobId)`.

- `idempotent`: retry `getJob(result.jobId)` every 25ms for at most 250ms, then return the original job
- `active`: load that job and throw `ActiveJobExistsError`
- `queue_full`: throw `QueueFullError`
- `acquired`: continue creating the new job

Use this bounded wait for an idempotent request that arrives while the first request is still writing the job record:

```ts
async function waitForReservedJob(jobId: string): Promise<TestJob | null> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const job = await getJob(jobId);
    if (job) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}
```

If the bounded wait returns `null`, release only the matching stale idempotency reservation and return a 503 `JOB_CREATION_IN_PROGRESS` error with `Retry-After: 1` rather than creating a second job.

After reservation, wrap Redis job/queue/history writes in `try/catch`. On success call `commitIdempotencyReservation(idempotencyKey, jobId)`. On failure call both `releaseActiveLease(agentId, jobId)` and `releaseIdempotencyReservation(idempotencyKey, jobId)` before rethrowing.

Remove the old read-then-set block:

```ts
const currentActiveJobId = await redis.get<string>(activeKey);
if (currentActiveJobId) {
  // old non-atomic check
}
```

Remove the existing standalone idempotency `set` and active key `set`; reservation owns both keys.

- [ ] **Step 5: Renew/release in lifecycle operations**

- `heartbeatJob`: require `renewActiveLease(agentId, jobId)` to return true before updating running state
- `completeJob`: call `releaseActiveLease(agentId, jobId)` after terminal state is persisted
- cancel completion: release after terminal state is persisted
- lease reconciliation: mark `agent_lost`, then compare-and-delete the same job ID

If heartbeat cannot renew, throw `AgentJobOwnershipError` and let the agent stop that process.

- [ ] **Step 6: Create salted requester label in the route**

```ts
import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";

function createRequesterLabel(ip: string): string {
  const secret = getServerEnv().SESSION_SIGNING_SECRET;
  const digest = createHash("sha256").update(`${secret}:${ip}`).digest("hex").slice(0, 8);
  return `Operator ${digest}`;
}
```

Pass the label to `enqueueJob`; never store the raw IP in `TestJob`.

- [ ] **Step 7: Run store and route tests**

Run: `npx vitest run tests/unit/test-runner/store.test.ts tests/integration/test-runner-browser-routes.test.ts`

Expected: PASS; one concurrent request succeeds, one receives active conflict, lifecycle releases only its own lease

- [ ] **Step 8: User-managed Git checkpoint**

Review job type migration, atomic acquire and every terminal release path before the user commits manually.

### Task 3: Prevent Agent Heartbeat Overlap

**Files:**
- Modify: `agent/src/runner.ts`
- Modify: `tests/unit/test-agent/runner.test.ts`

**Interfaces:**
- Produces: one heartbeat request at a time
- Consumes: `client.heartbeat(jobId, progress)` and 5,000ms interval

- [ ] **Step 1: Write a slow-heartbeat test**

Use fake timers and a heartbeat promise that remains pending for 7 seconds. Advance time by 10 seconds and assert the client was called once until the first promise resolves.

```ts
expect(client.heartbeat).toHaveBeenCalledTimes(1);
resolveHeartbeat({ cancelRequested: false });
await vi.advanceTimersByTimeAsync(5_000);
expect(client.heartbeat).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: Run and verify overlap failure**

Run: `npx vitest run tests/unit/test-agent/runner.test.ts`

Expected: FAIL because async `setInterval` starts a second request before the first finishes

- [ ] **Step 3: Replace interval with guarded recursive timeout**

```ts
let heartbeatTimer: NodeJS.Timeout | null = null;
let heartbeatStopped = false;

const scheduleHeartbeat = () => {
  if (heartbeatStopped) return;
  heartbeatTimer = setTimeout(async () => {
    try {
      const heartbeat = await client.heartbeat(job.id, parser.consume("stdout", []));
      if (heartbeat.cancelRequested) controller.abort();
    } catch {
      // the lease determines final ownership after transient failures
    } finally {
      scheduleHeartbeat();
    }
  }, 5_000);
};

scheduleHeartbeat();
```

In cleanup set `heartbeatStopped = true` and clear the current timeout.

- [ ] **Step 4: Run agent tests and build**

Run: `npx vitest run tests/unit/test-agent/runner.test.ts`

Run: `npm run test-agent:build`

Expected: PASS; heartbeat never overlaps and agent TypeScript build exits 0

- [ ] **Step 5: User-managed Git checkpoint**

Review heartbeat stop behavior during completion, cancellation and thrown execution errors before the user commits manually.

### Task 4: Replace Preset Cards with Two Dropdowns

**Files:**
- Modify: `src/components/test-runner/PresetLauncher.tsx`
- Modify: `src/components/test-runner/RunConfirmation.tsx`
- Modify: `src/components/test-runner/TestRunnerWorkspace.tsx`
- Modify: `src/components/test-runner/RunProgress.tsx`
- Modify: `tests/components/TestRunnerPanel.test.tsx`
- Modify: `tests/components/TestRunnerWorkspace.test.tsx`

**Interfaces:**
- `PresetLauncher` consumes `activeJob: TestJob | null`
- `PresetLauncher` produces `onRunPreset(projectId, presetId)` only after confirmation
- Selection state remains internal and is not persisted

- [ ] **Step 1: Replace card assertions with dropdown behavior tests**

```tsx
it("requires an explicit test selection", () => {
  render(<PresetLauncher {...readyProps} catalog={catalog} activeJob={null} />);
  expect(screen.getByLabelText("Project")).toHaveValue("project-a");
  expect(screen.getByLabelText("Test command")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Run selected test" })).toBeDisabled();
});

it("clears the selected test when project changes", async () => {
  render(<PresetLauncher {...readyProps} catalog={twoProjectCatalog} activeJob={null} />);
  await user.selectOptions(screen.getByLabelText("Test command"), "e2e");
  await user.selectOptions(screen.getByLabelText("Project"), "project-b");
  expect(screen.getByLabelText("Test command")).toHaveValue("");
});
```

Add a test that active job disables both selects and Run.

- [ ] **Step 2: Run tests and verify current card UI fails**

Run: `npx vitest run tests/components/TestRunnerPanel.test.tsx tests/components/TestRunnerWorkspace.test.tsx`

Expected: FAIL because the current component renders one Run button per preset

- [ ] **Step 3: Implement selector state**

```ts
const projects = catalog?.projects ?? [];
const [selectedProjectId, setSelectedProjectId] = useState(() => projects[0]?.id ?? "");
const [selectedPresetId, setSelectedPresetId] = useState("");

const currentProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
const selectedPreset = currentProject?.presets.find((preset) => preset.id === selectedPresetId) ?? null;

function handleProjectChange(projectId: string) {
  setSelectedProjectId(projectId);
  setSelectedPresetId("");
  setConfirmPreset(null);
}
```

Add an effect that selects the first project only when the catalog initially arrives or the selected project disappears. Never select a preset automatically.

- [ ] **Step 4: Render approved dropdown UI**

Project select label: `Project`

Test select label: `Test command`

First test option: `Select a test`

Single button label: `Run selected test`

Disable both selects when `activeJob` is active, agent is offline or request is submitting. Disable Run for those states plus locked execution or missing selected preset.

- [ ] **Step 5: Render selected test details**

Display these fields from `TestPreset` without parsing `commandPreview`:

- name
- commandPreview
- category
- timeoutSeconds
- risk
- databaseTarget
- srsIds joined with comma when non-empty

- [ ] **Step 6: Expand confirmation and progress**

`RunConfirmation` must show Project, Command, Timeout, Risk and Database. `RunProgress` must show `activeJob.projectId` and `activeJob.requesterLabel`.

Keep confirmation open when create returns false so the user can read the error; close it only after successful create.

- [ ] **Step 7: Run component tests**

Run: `npx vitest run tests/components/TestRunnerPanel.test.tsx tests/components/TestRunnerWorkspace.test.tsx`

Expected: PASS; no preset cards, explicit selection required and active job disables all controls

- [ ] **Step 8: User-managed Git checkpoint**

Review selector reset behavior, disabled states and confirmation copy before the user commits manually.

### Task 5: Sync Shared Active Job Across Browsers

**Files:**
- Modify: `src/components/test-runner/useTestRunner.ts`
- Modify: `src/components/test-runner/TestRunnerWorkspace.tsx`
- Modify: `tests/components/TestRunnerWorkspace.test.tsx`
- Create: `e2e/multi-user-test-runner.spec.ts`

**Interfaces:**
- Consumes: adaptive polling and `fetchNoStore` from `2026-07-28-production-cache-loading-readiness.md`
- Produces: every browser receives the same `activeJob`

- [ ] **Step 1: Add active conflict recovery test**

Mock create job response as HTTP 409:

```json
{
  "error": "Agent already has an active job",
  "code": "ACTIVE_JOB_EXISTS",
  "activeJob": {
    "id": "job-existing",
    "projectId": "project-a",
    "presetId": "e2e",
    "presetName": "E2E",
    "requesterLabel": "Operator ab12cd34",
    "status": "running"
  }
}
```

Assert the workspace renders the existing job and disables selector controls.

- [ ] **Step 2: Run and verify the incomplete shared-state behavior**

Run: `npx vitest run tests/components/TestRunnerWorkspace.test.tsx`

Expected: FAIL until active conflict and catalog active job synchronize selection lock state

- [ ] **Step 3: Implement shared active state rules**

- Catalog response active job replaces local active job when its `updatedAt`/status is newer
- HTTP 409 response immediately sets `activeJob`
- Terminal job status refresh remains the source of progress/log sequence
- Terminal status triggers catalog refresh once so other browsers unlock within the next polling cycle
- A browser never clears active job solely because one request failed

- [ ] **Step 4: Write two-context E2E test**

Create two authenticated browser contexts. Context A selects a preset and confirms Run. Context B opens `/monitor/tests`, receives the active job and verifies both selects and Run are disabled. Mock or use the existing deterministic agent route harness so the job completes; then verify both contexts become enabled after refresh.

- [ ] **Step 5: Run component and E2E tests**

Run: `npx vitest run tests/components/TestRunnerWorkspace.test.tsx`

Run: `npx playwright test e2e/multi-user-test-runner.spec.ts`

Expected: PASS; two browsers cannot create two active jobs and unlock after terminal status

- [ ] **Step 6: User-managed Git checkpoint**

Review multi-browser synchronization and avoid storing dropdown selection outside the current tab.

### Task 6: Release Gate and Production Smoke Test

**Files:**
- Modify: `README.md`
- Verify: `docs/superpowers/specs/2026-07-28-production-concurrency-cache-test-selector-design.md`
- Verify: `docs/superpowers/plans/2026-07-28-production-cache-loading-readiness.md`

**Interfaces:**
- Consumes all tasks in this plan and the cache/loading plan
- Produces production-ready operating instructions

- [ ] **Step 1: Document the single-run behavior**

Add README instructions stating that one local agent runs one test at a time, all users see the shared active job, dropdowns lock globally while active, and agent lease expires after 45 seconds without heartbeat.

- [ ] **Step 2: Run full local verification**

Run in order:

```powershell
npm run test
npm run lint
npm run typecheck
npm run test-agent:build
npm run build
npm run test:e2e
```

Expected: every command exits 0; lint has 0 errors and 0 warnings

- [ ] **Step 3: Run concurrency stress check**

Send 20 create requests with different idempotency keys against the same agent in the integration harness. Expected result: one `201`, nineteen `409 ACTIVE_JOB_EXISTS`, one queue entry and one active key.

- [ ] **Step 4: Verify lease recovery**

Start a safe preset, stop the local agent process, wait longer than 45 seconds and run lifecycle reconciliation. Expected: job becomes `agent_lost`, active key disappears and selector becomes available again.

- [ ] **Step 5: Verify production UI**

On deployed `/monitor/tests`, confirm explicit dropdown selection, complete confirmation details, active job visibility in a second browser, terminal recovery after tab hide/show and no duplicate jobs.

- [ ] **Step 6: User-managed Git checkpoint**

The user reviews test output and production evidence before committing and deploying manually.

## Self-Review

- [ ] Spec coverage: atomic execution, requester label, dropdown behavior, confirmation, shared active state, heartbeat overlap and multi-browser testing each map to a task
- [ ] Placeholder scan: no deferred implementation language or missing function signature remains
- [ ] Type consistency: `requesterLabel`, active lease helper names and `activeJob` use the same names in store, route, UI and tests
- [ ] Concurrency consistency: reservation checks idempotency, active lease and queue capacity in one Lua operation; renew/release compare the owning job ID; no read-then-write active lock remains
- [ ] UI consistency: project defaults first, test defaults empty, project change clears test, all controls disable for active job
- [ ] Scope consistency: no arbitrary commands, parallel execution, multi-agent routing or persistent test selection was added
- [ ] Plan dependency: execute cache/loading plan Tasks 1-7 before this plan Task 5 production verification
- [ ] Workspace rule: no automatic Git operation is included

## Execution Handoff

Execute Tasks 1-4 first to make job ownership and selector behavior correct, then Task 5 after adaptive polling/no-store from the cache/loading plan is available, and finish with Task 6 release verification.
