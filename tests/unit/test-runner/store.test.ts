import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  enqueueJob,
  claimNextJob,
  heartbeatJob,
  appendLogBatch,
  readLogPage,
  requestCancel,
  reapStaleJobs,
  publishCatalog,
  getCatalog,
  getJob,
  getAgentPresence,
  completeJob,
} from "@/lib/test-runner/store";
import {
  ActiveJobExistsError,
} from "@/lib/test-runner/errors";
import type { TestProjectCatalog } from "@/lib/test-runner/types";

// In-memory fake Redis mock for v2 key structures
const fakeStore = new Map<string, unknown>();
const fakeLists = new Map<string, string[]>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    eval: vi.fn(async (script: string, keys: string[], args: string[]) => {
      // RESERVE_SCRIPT
      if (script.includes("ACQUIRED")) {
        const [idemKey, activeKey, queueKey] = keys;
        const [jobId, maxQueue] = args;

        const existing = fakeStore.get(idemKey);
        if (existing) return ["IDEMPOTENT", existing];

        const active = fakeStore.get(activeKey);
        if (active) return ["ACTIVE", active];

        const queue = fakeLists.get(queueKey) || [];
        if (queue.length >= Number(maxQueue)) return ["QUEUE_FULL", ""];

        fakeStore.set(idemKey, jobId);
        fakeStore.set(activeKey, jobId);
        return ["ACQUIRED", jobId];
      }

      // RENEW_SCRIPT
      if (script.includes("EXPIRE")) {
        const [activeKey] = keys;
        const [jobId] = args;
        const current = fakeStore.get(activeKey);
        if (current === jobId) return 1;
        return 0;
      }

      // RELEASE_SCRIPT
      if (script.includes("DEL")) {
        const [activeKey] = keys;
        const [jobId] = args;
        const current = fakeStore.get(activeKey);
        if (current === jobId) {
          fakeStore.delete(activeKey);
          return 1;
        }
        return 0;
      }

      return 0;
    }),
    get: vi.fn(async (key: string) => fakeStore.get(key) ?? null),
    set: vi.fn(async (key: string, val: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && fakeStore.has(key)) {
        return null;
      }
      fakeStore.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      fakeStore.delete(key);
      fakeLists.delete(key);
      return 1;
    }),
    rpush: vi.fn(async (key: string, val: string) => {
      const list = fakeLists.get(key) || [];
      list.push(val);
      fakeLists.set(key, list);
      return list.length;
    }),
    lpop: vi.fn(async (key: string) => {
      const list = fakeLists.get(key) || [];
      const item = list.shift();
      fakeLists.set(key, list);
      return item ?? null;
    }),
    llen: vi.fn(async (key: string) => {
      const list = fakeLists.get(key) || [];
      return list.length;
    }),
    expire: vi.fn(async () => 1),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = fakeLists.get(key) || [];
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      return list.slice(start, end);
    }),
    zadd: vi.fn(async (key: string, member: { score: number; member: string }) => {
      const set = (fakeStore.get(key) as Array<{ score: number; member: string }>) || [];
      set.push(member);
      fakeStore.set(key, set);
      return 1;
    }),
    zrange: vi.fn(
      async (
        key: string,
        min: number | string,
        max: number | string,
        opts?: { rev?: boolean; byScore?: boolean },
      ) => {
        const set = (fakeStore.get(key) as Array<{ score: number; member: string }>) || [];
        if (opts?.byScore) {
          const minScore = typeof min === "number" ? min : -Infinity;
          const maxScore = typeof max === "number" ? max : Infinity;
          const filtered = set.filter((item) => item.score >= minScore && item.score <= maxScore);
          const sorted = [...filtered].sort((a, b) => (opts?.rev ? b.score - a.score : a.score - b.score));
          return sorted.map((item) => item.member);
        }

        // Index range (e.g. 0 to -1)
        const sorted = [...set].sort((a, b) => (opts?.rev ? b.score - a.score : a.score - b.score));
        const start = typeof min === "number" ? min : 0;
        const stop = typeof max === "number" ? max : -1;
        const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
        return sorted.slice(start, end).map((item) => item.member);
      },
    ),
  }),
  TestRunnerConfigError: class extends Error {},
}));

describe("Test Runner Redis Store (v2)", () => {
  const sampleCatalog: TestProjectCatalog = {
    version: "1.0.0",
    updatedAt: "2026-07-28T10:00:00.000Z",
    projects: [
      {
        id: "student-tracking",
        name: "Student Tracking System",
        presets: [
          {
            id: "cypress-e2e",
            name: "Cypress E2E Tests",
            description: "Runs Cypress suite",
            commandPreview: "npx cypress run",
            timeoutSeconds: 300,
            category: "automated",
            srsIds: [],
            risk: "safe",
            databaseTarget: "none",
          },
        ],
      },
    ],
  };

  const jobInput = { projectId: "student-tracking", presetId: "cypress-e2e" };

  beforeEach(() => {
    fakeStore.clear();
    fakeLists.clear();
  });

  it("publishes and retrieves catalog and agent presence", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const catalog = await getCatalog("agent-win-1");
    expect(catalog).toEqual(sampleCatalog);

    const presence = await getAgentPresence("agent-win-1");
    expect(presence?.state).toBe("online");
  });

  it("returns the same job for a repeated idempotency key", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const first = await enqueueJob(jobInput, "requester-1", "run-123", sampleCatalog, "agent-win-1");
    const repeated = await enqueueJob(jobInput, "requester-1", "run-123", sampleCatalog, "agent-win-1");
    expect(repeated.id).toBe(first.id);
    expect(repeated.category).toBe("automated");
    expect(repeated.databaseTarget).toBe("none");
  });

  it("rejects a second active job for the same agent", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    await enqueueJob(jobInput, "requester-1", "run-1", sampleCatalog, "agent-win-1");
    await expect(
      enqueueJob(jobInput, "requester-1", "run-2", sampleCatalog, "agent-win-1"),
    ).rejects.toThrow(ActiveJobExistsError);
  });

  it("claims job FIFO and updates lease and heartbeat", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const enqueued = await enqueueJob(jobInput, "requester-1", "run-1", sampleCatalog, "agent-win-1");

    const claimed = await claimNextJob("agent-win-1");
    expect(claimed?.id).toBe(enqueued.id);
    expect(claimed?.status).toBe("claimed");

    const hbResult = await heartbeatJob(claimed!.id, "agent-win-1");
    expect(hbResult.cancelRequested).toBe(false);
  });

  it("marks a running job agent_lost after its lease expires", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const enqueued = await enqueueJob(jobInput, "requester-1", "run-1", sampleCatalog, "agent-win-1");
    await claimNextJob("agent-win-1");

    // Advance 46 seconds past lease
    const future = new Date(Date.now() + 46 * 1000);
    const reaped = await reapStaleJobs(future);

    expect(reaped).toContain(enqueued.id);
    const job = await getJob(enqueued.id);
    expect(job?.status).toBe("agent_lost");
  });

  it("appends log batches sequentially and reads cursor pages", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const enqueued = await enqueueJob(jobInput, "requester-1", "run-1", sampleCatalog, "agent-win-1");

    await appendLogBatch(enqueued.id, 0, [
      { stream: "stdout", message: "Step 1" },
      { stream: "stdout", message: "Step 2" },
    ]);

    const page = await readLogPage(enqueued.id, -1, 10);
    expect(page.lines).toHaveLength(2);
    expect(page.lines[0].message).toBe("Step 1");
    expect(page.nextSequence).toBe(2);
  });

  it("persists a rules-based failure analysis when a job fails", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const enqueued = await enqueueJob(jobInput, "requester-1", "run-failure-analysis", sampleCatalog, "agent-win-1");
    const claimed = await claimNextJob("agent-win-1");
    await heartbeatJob(claimed!.id, "agent-win-1");

    await appendLogBatch(enqueued.id, 0, [
      { stream: "stderr", message: "Redis connection error: ECONNREFUSED" },
    ]);

    const completed = await completeJob(enqueued.id, {
      status: "failed",
      exitCode: 1,
      error: "Command exited with code 1",
    });

    expect(completed.failureAnalysis).toMatchObject({
      category: "connection",
      confidence: "high",
    });
    expect(completed.failureAnalysis?.evidence.join(" ")).toContain("ECONNREFUSED");
  });

  it("does not add failure analysis to a passed job", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const enqueued = await enqueueJob(jobInput, "requester-1", "run-passed-analysis", sampleCatalog, "agent-win-1");
    const claimed = await claimNextJob("agent-win-1");
    await heartbeatJob(claimed!.id, "agent-win-1");

    const completed = await completeJob(enqueued.id, {
      status: "passed",
      exitCode: 0,
    });

    expect(completed.failureAnalysis).toBeUndefined();
  });

  it("creates one job when two users enqueue concurrently", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const attempts = await Promise.allSettled([
      enqueueJob(jobInput, "Operator a1b2c3d4", "idem-concurrent-a", sampleCatalog, "agent-win-1"),
      enqueueJob(jobInput, "Operator e5f6g7h8", "idem-concurrent-b", sampleCatalog, "agent-win-1"),
    ]);

    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((item) => item.status === "rejected");
    expect(rejected).toMatchObject({ reason: expect.any(ActiveJobExistsError) });
  });

  it("handles job cancellation and completion", async () => {
    await publishCatalog(sampleCatalog, "agent-win-1");
    const enqueued = await enqueueJob(jobInput, "requester-1", "run-1", sampleCatalog, "agent-win-1");

    const cancelled = await requestCancel(enqueued.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelRequested).toBe(true);
  });
});
