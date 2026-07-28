// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST as pollPost } from "@/app/api/test-runner/agent/poll/route";
import { POST as logsPost } from "@/app/api/test-runner/agent/jobs/[jobId]/logs/route";
import { POST as completePost } from "@/app/api/test-runner/agent/jobs/[jobId]/complete/route";
import { NextRequest } from "next/server";
import { resetServerEnvCache } from "@/lib/env/server";
import { publishCatalog, enqueueJob, getJob, readLogPage } from "@/lib/test-runner/store";
import type { TestProjectCatalog } from "@/lib/test-runner/types";

const fakeStore = new Map<string, unknown>();
const fakeLists = new Map<string, string[]>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    get: vi.fn(async (key: string) => fakeStore.get(key) ?? null),
    set: vi.fn(async (key: string, val: unknown) => {
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
    eval: vi.fn(async (script: string, keys: string[], args: string[]) => {
      // RESERVE_SCRIPT
      if (script.includes("ACQUIRED")) {
        const [idemKey, activeKey, queueKey] = keys;
        const [, jobId, , , maxQueue] = args;

        const existing = fakeStore.get(idemKey);
        if (existing) return ["IDEMPOTENT", existing];

        const active = fakeStore.get(activeKey);
        if (active) return ["ACTIVE", active];

        const queue = fakeLists.get(queueKey) || [];
        if (queue.length >= Number(maxQueue || 10)) return ["QUEUE_FULL", ""];

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
      const [activeKey] = keys;
      const [jobId] = args;
      const current = fakeStore.get(activeKey);
      if (current === jobId) {
        fakeStore.delete(activeKey);
        return 1;
      }
      return 0;
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

        const sorted = [...set].sort((a, b) => (opts?.rev ? b.score - a.score : a.score - b.score));
        const start = typeof min === "number" ? min : 0;
        const stop = typeof max === "number" ? max : -1;
        const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
        return sorted.slice(start, end).map((item) => item.member);
      },
    ),
    zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
      const set = (fakeStore.get(key) as Array<{ score: number; member: string }>) || [];
      const sorted = [...set].sort((a, b) => b.score - a.score);
      const slice = sorted.slice(start, stop < 0 ? sorted.length : stop + 1);
      return slice.map((item) => item.member);
    }),
  }),
  TestRunnerConfigError: class extends Error {},
}));

describe("Agent API Authentication & Flow", () => {
  const secretToken = "a".repeat(32);
  const authHeader = `Bearer ${secretToken}`;

  beforeEach(async () => {
    fakeStore.clear();
    fakeLists.clear();
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(48));
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", secretToken);

    await publishCatalog({
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "sys",
          name: "System Tests",
          presets: [
            {
              id: "unit",
              name: "Unit Suite",
              description: "Run unit",
              commandPreview: "npm test",
              timeoutSeconds: 60,
              category: "automated",
              srsIds: [],
              risk: "safe",
              databaseTarget: "none",
            },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("returns 401 when Agent token is missing or invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/agent/poll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-1" }),
    });

    const res = await pollPost(req);
    expect(res.status).toBe(401);
  });

  it("returns 204 when polling empty queue", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: authHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-1", catalogVersion: "1.0.0" }),
    });

    const res = await pollPost(req);
    expect(res.status).toBe(204);
  });

  it("claims job on poll, appends logs, and completes job", async () => {
    const catalog: TestProjectCatalog = {
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "sys",
          name: "System Tests",
          presets: [
            {
              id: "unit",
              name: "Unit Suite",
              description: "Run unit",
              commandPreview: "npm test",
              timeoutSeconds: 60,
              category: "automated",
              srsIds: [],
              risk: "safe",
              databaseTarget: "none",
            },
          ],
        },
      ],
    };

    const enqueued = await enqueueJob(
      { projectId: "sys", presetId: "unit" },
      "req",
      "run-test-idempotency-123",
      catalog,
    );

    // Poll
    const pollReq = new NextRequest("http://localhost:3000/api/test-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: authHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "windows-local-agent-1", catalogVersion: "1.0.0" }),
    });

    const pollRes = await pollPost(pollReq);
    expect(pollRes.status).toBe(200);
    const { job } = await pollRes.json();
    expect(job.id).toBe(enqueued.id);
    expect(job.status).toBe("claimed");
    expect(job.category).toBe("automated");
    expect(job.srsIds).toEqual([]);

    // Append log batch
    const logReq = new NextRequest(
      `http://localhost:3000/api/test-runner/agent/jobs/${job.id}/logs`,
      {
        method: "POST",
        headers: {
          authorization: authHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sequenceStart: 0,
          entries: [
            { stream: "stdout", message: "Running tests..." },
            { stream: "stdout", message: "PASS test/1.js" },
          ],
        }),
      },
    );

    const logRes = await logsPost(logReq, { params: Promise.resolve({ jobId: job.id }) });
    expect(logRes.status).toBe(200);

    // Complete job
    const completeReq = new NextRequest(
      `http://localhost:3000/api/test-runner/agent/jobs/${job.id}/complete`,
      {
        method: "POST",
        headers: {
          authorization: authHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jobId: job.id,
          status: "passed",
          exitCode: 0,
        }),
      },
    );

    const completeRes = await completePost(completeReq, {
      params: Promise.resolve({ jobId: job.id }),
    });
    expect(completeRes.status).toBe(200);

    // Verify stored job details & logs
    const jobDetail = await getJob(job.id);
    const logPage = await readLogPage(job.id);
    expect(jobDetail?.status).toBe("passed");
    expect(logPage.lines).toHaveLength(2);
  });
});
