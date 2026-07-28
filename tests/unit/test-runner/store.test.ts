import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  enqueueJob,
  claimNextJob,
  completeJob,
  requestCancel,
  publishCatalog,
  getCatalog,
  QueueFullError,
  UnknownPresetError,
} from "@/lib/test-runner/store";
import type { TestProjectCatalog } from "@/lib/test-runner/types";

// In-memory fake Redis mock
const fakeRedisStore = new Map<string, unknown>();
const fakeRedisLists = new Map<string, string[]>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    get: vi.fn(async (key: string) => fakeRedisStore.get(key) ?? null),
    set: vi.fn(async (key: string, val: unknown) => {
      fakeRedisStore.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      fakeRedisStore.delete(key);
      fakeRedisLists.delete(key);
      return 1;
    }),
    rpush: vi.fn(async (key: string, val: string) => {
      const list = fakeRedisLists.get(key) || [];
      list.push(val);
      fakeRedisLists.set(key, list);
      return list.length;
    }),
    lpop: vi.fn(async (key: string) => {
      const list = fakeRedisLists.get(key) || [];
      const item = list.shift();
      fakeRedisLists.set(key, list);
      return item ?? null;
    }),
    llen: vi.fn(async (key: string) => {
      const list = fakeRedisLists.get(key) || [];
      return list.length;
    }),
    expire: vi.fn(async () => 1),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = fakeRedisLists.get(key) || [];
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      return list.slice(start, end);
    }),
    zadd: vi.fn(async (key: string, member: { score: number; member: string }) => {
      const set = (fakeRedisStore.get(key) as Array<{ score: number; member: string }>) || [];
      set.push(member);
      fakeRedisStore.set(key, set);
      return 1;
    }),
    zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
      const set = (fakeRedisStore.get(key) as Array<{ score: number; member: string }>) || [];
      const sorted = [...set].sort((a, b) => b.score - a.score);
      const slice = sorted.slice(start, stop < 0 ? sorted.length : stop + 1);
      return slice.map((item) => item.member);
    }),
  }),
  TestRunnerConfigError: class extends Error {},
}));

describe("Test Runner Redis Store", () => {
  const sampleCatalog: TestProjectCatalog = {
    version: "1.0.0",
    updatedAt: "2026-07-28T10:00:00Z",
    projects: [
      {
        id: "student-tracking",
        name: "Student Tracking System",
        presets: [
          {
            id: "cypress-e2e",
            name: "Cypress E2E Tests",
            description: "Runs Cypress end-to-end suite",
            commandPreview: "npx cypress run",
            timeoutSeconds: 300,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    fakeRedisStore.clear();
    fakeRedisLists.clear();
  });

  it("publishes and retrieves catalog", async () => {
    await publishCatalog(sampleCatalog);
    const catalog = await getCatalog();
    expect(catalog).toEqual(sampleCatalog);
  });

  it("enqueues a valid job and claims FIFO queue for active agent", async () => {
    await publishCatalog(sampleCatalog);

    const job = await enqueueJob(
      { projectId: "student-tracking", presetId: "cypress-e2e" },
      "requester-1",
      sampleCatalog,
    );

    expect(job.status).toBe("queued");
    expect(job.presetName).toBe("Cypress E2E Tests");

    const claimed = await claimNextJob("agent-win-1");
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.agentId).toBe("agent-win-1");
  });

  it("rejects unknown presetId", async () => {
    await expect(
      enqueueJob(
        { projectId: "student-tracking", presetId: "non-existent" },
        "req",
        sampleCatalog,
      ),
    ).rejects.toThrow(UnknownPresetError);
  });

  it("rejects when queue limit 10 is reached", async () => {
    await publishCatalog(sampleCatalog);

    for (let i = 0; i < 10; i++) {
      await enqueueJob(
        { projectId: "student-tracking", presetId: "cypress-e2e" },
        "req",
        sampleCatalog,
      );
    }

    await expect(
      enqueueJob(
        { projectId: "student-tracking", presetId: "cypress-e2e" },
        "req",
        sampleCatalog,
      ),
    ).rejects.toThrow(QueueFullError);
  });

  it("handles job completion and status update", async () => {
    await publishCatalog(sampleCatalog);
    const job = await enqueueJob(
      { projectId: "student-tracking", presetId: "cypress-e2e" },
      "req",
      sampleCatalog,
    );
    await claimNextJob("agent-win-1");

    const completed = await completeJob(job.id, {
      status: "passed",
      exitCode: 0,
      finishedAt: new Date().toISOString(),
    });

    expect(completed.status).toBe("passed");
    expect(completed.exitCode).toBe(0);
  });

  it("handles cancel request on queued and running jobs", async () => {
    await publishCatalog(sampleCatalog);
    const job = await enqueueJob(
      { projectId: "student-tracking", presetId: "cypress-e2e" },
      "req",
      sampleCatalog,
    );

    const cancelled = await requestCancel(job.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelRequested).toBe(true);
  });
});
