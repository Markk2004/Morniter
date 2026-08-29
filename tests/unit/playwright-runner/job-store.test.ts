import { describe, expect, it, beforeEach } from "vitest";
import {
  enqueuePlaywrightJob,
  claimNextPlaywrightJob,
  heartbeatPlaywrightJob,
  appendPlaywrightLogBatch,
  readPlaywrightLogPage,
  completePlaywrightJob,
  requestCancelPlaywrightJob,
  listPlaywrightJobs,
  getPlaywrightJob,
  reapStalePlaywrightJobs,
  publishPlaywrightCatalog,
  getPlaywrightCatalog,
  getPlaywrightAgentPresence,
} from "@/lib/playwright-runner/job-store";
import {
  PlaywrightActiveJobExistsError,
  PlaywrightQueueFullError,
  PlaywrightInvalidTransitionError,
} from "@/lib/playwright-runner/job-store-logic";
import type { Redis } from "@upstash/redis";

class FakeRedis {
  private kv = new Map<string, any>();
  private lists = new Map<string, string[]>();
  private sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  async get<T>(key: string): Promise<T | null> {
    const val = this.kv.get(key);
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: any, options?: { nx?: boolean; ex?: number }): Promise<string | null> {
    if (options?.nx && this.kv.has(key)) {
      return null;
    }
    this.kv.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.kv.delete(key);
    return existed ? 1 : 0;
  }

  async rpush(key: string, ...elements: string[]): Promise<number> {
    const list = this.lists.get(key) || [];
    list.push(...elements);
    this.lists.set(key, list);
    return list.length;
  }

  async lpop<T>(key: string): Promise<T | null> {
    const list = this.lists.get(key) || [];
    const item = list.shift();
    return (item as T) ?? null;
  }

  async llen(key: string): Promise<number> {
    const list = this.lists.get(key) || [];
    return list.length;
  }

  async zadd(key: string, entry: { score: number; member: string }): Promise<number> {
    const set = this.sortedSets.get(key) || [];
    set.push(entry);
    set.sort((a, b) => a.score - b.score);
    this.sortedSets.set(key, set);
    return 1;
  }

  async zrange<T>(
    key: string,
    min: number | string,
    max: number | string,
    options?: { rev?: boolean; byScore?: boolean },
  ): Promise<T> {
    const set = this.sortedSets.get(key) || [];
    if (options?.byScore) {
      const minNum = typeof min === "number" ? min : parseFloat(min);
      const filtered = set.filter((item) => item.score >= minNum).map((item) => item.member);
      return filtered as unknown as T;
    }
    const items = set.map((item) => item.member);
    if (options?.rev) {
      items.reverse();
    }
    const start = typeof min === "number" ? min : 0;
    const end = typeof max === "number" ? (max === -1 ? items.length : max + 1) : items.length;
    return items.slice(start, end) as unknown as T;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }
}

describe("Playwright Job Store Persistence", () => {
  let fakeRedis: Redis;

  beforeEach(() => {
    fakeRedis = new FakeRedis() as unknown as Redis;
  });

  it("publishes and retrieves catalog and presence", async () => {
    await publishPlaywrightCatalog(
      {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        projects: [{ id: "projectsts", name: "ProjectSTS" }],
      },
      { browsers: { chromium: true, firefox: true }, headed: true },
      "agent-1",
      new Date(),
      fakeRedis,
    );

    const catalog = await getPlaywrightCatalog("agent-1", fakeRedis);
    expect(catalog?.version).toBe("2.0.0");
    expect(catalog?.projects).toHaveLength(1);

    const presence = await getPlaywrightAgentPresence("agent-1", new Date(), fakeRedis);
    expect(presence?.state).toBe("online");
    expect(presence?.capabilities?.browsers?.chromium).toBe(true);
  });

  it("enqueues a job and claims it atomically", async () => {
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium", "firefox"],
        mode: "headless",
      },
      "agent-1",
      "idemp-12345",
      new Date(),
      fakeRedis,
    );

    expect(job.status).toBe("queued");
    expect(job.browsers).toEqual(["chromium", "firefox"]);
    expect(job.browserResults).toHaveLength(2);

    const claimed = await claimNextPlaywrightJob("agent-1", new Date(), fakeRedis);
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe("claimed");
  });

  it("supports idempotent job creation", async () => {
    const job1 = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
      "idemp-same-key",
      new Date(),
      fakeRedis,
    );

    const job2 = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
      "idemp-same-key",
      new Date(),
      fakeRedis,
    );

    expect(job1.id).toBe(job2.id);
  });

  it("rejects enqueue when an active job is already claimed and running", async () => {
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
      undefined,
      new Date(),
      fakeRedis,
    );

    await claimNextPlaywrightJob("agent-1", new Date(), fakeRedis);

    await expect(
      enqueuePlaywrightJob(
        {
          projectId: "projectsts",
          source: "project-test",
          testIds: ["auth-logout"],
          browsers: ["chromium"],
          mode: "headless",
        },
        "agent-1",
        undefined,
        new Date(),
        fakeRedis,
      ),
    ).rejects.toThrow(PlaywrightActiveJobExistsError);
  });

  it("enforces maximum queue length of 10", async () => {
    for (let i = 0; i < 10; i++) {
      await enqueuePlaywrightJob(
        {
          projectId: "projectsts",
          source: "project-test",
          testIds: [`test-${i}`],
          browsers: ["chromium"],
          mode: "headless",
        },
        "agent-queue-test",
        undefined,
        new Date(),
        fakeRedis,
      );
    }

    await expect(
      enqueuePlaywrightJob(
        {
          projectId: "projectsts",
          source: "project-test",
          testIds: ["test-overflow"],
          browsers: ["chromium"],
          mode: "headless",
        },
        "agent-queue-test",
        undefined,
        new Date(),
        fakeRedis,
      ),
    ).rejects.toThrow(PlaywrightQueueFullError);
  });

  it("appends and reads log pages with redacting secrets", async () => {
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "workspace",
        code: "test()",
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
      undefined,
      new Date(),
      fakeRedis,
    );

    await claimNextPlaywrightJob("agent-1", new Date(), fakeRedis);

    const appendRes = await appendPlaywrightLogBatch(
      job.id,
      0,
      [
        {
          stream: "stdout",
          message: "Connecting to postgresql://user:secret123@db.example.com:5432/main",
          browser: "chromium",
        },
        {
          stream: "stdout",
          message: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.secret",
          browser: "chromium",
        },
      ],
      undefined,
      new Date(),
      fakeRedis,
    );

    expect(appendRes.nextSequence).toBe(2);

    const logPage = await readPlaywrightLogPage(job.id, -1, 100, fakeRedis);
    expect(logPage.lines).toHaveLength(2);
    expect(logPage.lines[0].text).not.toContain("secret123");
    expect(logPage.lines[0].text).toContain("[REDACTED_DATABASE_URL]");
    expect(logPage.lines[1].text).not.toContain("secret");
    expect(logPage.lines[1].text).toContain("Authorization: [REDACTED]");
  });

  it("handles heartbeat, cancellation request and final completion", async () => {
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
      undefined,
      new Date(),
      fakeRedis,
    );

    await claimNextPlaywrightJob("agent-1", new Date(), fakeRedis);

    // Heartbeat updates to running
    const hb = await heartbeatPlaywrightJob(job.id, "agent-1", undefined, new Date(), fakeRedis);
    expect(hb.cancelRequested).toBe(false);

    const runningJob = await getPlaywrightJob(job.id, fakeRedis);
    expect(runningJob?.status).toBe("running");

    // Request cancel
    const cancelRes = await requestCancelPlaywrightJob(job.id, fakeRedis);
    expect(cancelRes.status).toBe("cancel_requested");

    // Heartbeat now sees cancelRequested = true
    const hbAfterCancel = await heartbeatPlaywrightJob(job.id, "agent-1", undefined, new Date(), fakeRedis);
    expect(hbAfterCancel.cancelRequested).toBe(true);

    // Complete job as cancelled
    const completed = await completePlaywrightJob(
      job.id,
      {
        status: "cancelled",
        artifacts: [
          {
            id: "art-1",
            jobId: job.id,
            type: "trace",
            filename: "trace.zip",
            size: 2048,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      fakeRedis,
    );

    expect(completed.status).toBe("cancelled");
    expect(completed.artifacts).toHaveLength(1);

    // Cannot transition from terminal cancelled to running
    await expect(
      completePlaywrightJob(job.id, { status: "running" as any }, fakeRedis),
    ).rejects.toThrow(PlaywrightInvalidTransitionError);
  });

  it("lists bounded job history and reaps stale jobs", async () => {
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-stale",
      undefined,
      new Date(Date.now() - 150000),
      fakeRedis,
    );

    const history = await listPlaywrightJobs(20, fakeRedis);
    expect(history.length).toBeGreaterThanOrEqual(1);

    // Claim and set heartbeat in past
    await claimNextPlaywrightJob("agent-stale", new Date(Date.now() - 150000), fakeRedis);

    const reaped = await reapStalePlaywrightJobs(new Date(), fakeRedis);
    expect(reaped).toContain(job.id);

    const staleJob = await getPlaywrightJob(job.id, fakeRedis);
    expect(staleJob?.status).toBe("failed");
    expect(staleJob?.error).toContain("expired");
  });
});
