// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST as pollPost } from "@/app/api/playwright-runner/agent/poll/route";
import { POST as heartbeatPost } from "@/app/api/playwright-runner/agent/jobs/[jobId]/heartbeat/route";
import { POST as logsPost } from "@/app/api/playwright-runner/agent/jobs/[jobId]/logs/route";
import { POST as completePost } from "@/app/api/playwright-runner/agent/jobs/[jobId]/complete/route";
import { NextRequest } from "next/server";
import { resetServerEnvCache } from "@/lib/env/server";
import { enqueuePlaywrightJob } from "@/lib/playwright-runner/job-store";

const fakeStore = new Map<string, unknown>();
const fakeLists = new Map<string, string[]>();
const fakeSortedSets = new Map<string, Array<{ score: number; member: string }>>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    get: vi.fn(async (key: string) => fakeStore.get(key) ?? null),
    set: vi.fn(async (key: string, val: unknown, options?: { nx?: boolean }) => {
      if (options?.nx && fakeStore.has(key)) {
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
    zadd: vi.fn(async (key: string, member: { score: number; member: string }) => {
      const set = fakeSortedSets.get(key) || [];
      set.push(member);
      set.sort((a, b) => a.score - b.score);
      fakeSortedSets.set(key, set);
      return 1;
    }),
    zrange: vi.fn(async (key: string, min: number | string, max: number | string, options?: { rev?: boolean; byScore?: boolean }) => {
      const set = fakeSortedSets.get(key) || [];
      if (options?.byScore) {
        const minNum = typeof min === "number" ? min : parseFloat(min);
        const filtered = set.filter((item) => item.score >= minNum).map((item) => item.member);
        return filtered;
      }
      const items = set.map((item) => item.member);
      if (options?.rev) {
        items.reverse();
      }
      const start = typeof min === "number" ? min : 0;
      const end = typeof max === "number" ? (max === -1 ? items.length : max + 1) : items.length;
      return items.slice(start, end);
    }),
  }),
}));

describe("Playwright Runner Agent Routes", () => {
  const agentToken = "t".repeat(32);

  beforeEach(() => {
    fakeStore.clear();
    fakeLists.clear();
    fakeSortedSets.clear();
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(48));
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", agentToken);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("POST /api/playwright-runner/agent/poll rejects missing or invalid agent token", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      body: JSON.stringify({ agentId: "agent-1", catalogVersion: "1.0" }),
    });
    const unauthRes = await pollPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    const wrongTokenReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token" },
      body: JSON.stringify({ agentId: "agent-1", catalogVersion: "1.0" }),
    });
    const wrongTokenRes = await pollPost(wrongTokenReq);
    expect(wrongTokenRes.status).toBe(401);
  });

  it("POST /api/playwright-runner/agent/poll returns 204 when queue is empty, or claims job", async () => {
    const emptyReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-1", catalogVersion: "1.0" }),
    });
    const emptyRes = await pollPost(emptyReq);
    expect(emptyRes.status).toBe(204);

    // Enqueue a job
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
    );

    const pollWithJobReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-1", catalogVersion: "1.0" }),
    });
    const pollRes = await pollPost(pollWithJobReq);
    expect(pollRes.status).toBe(200);
    const data = await pollRes.json();
    expect(data.job.id).toBe(job.id);
    expect(data.job.status).toBe("claimed");
  });

  it("POST /api/playwright-runner/agent/jobs/[jobId]/heartbeat, logs, and complete", async () => {
    const job = await enqueuePlaywrightJob(
      {
        projectId: "projectsts",
        source: "workspace",
        code: "test()",
        browsers: ["chromium"],
        mode: "headless",
      },
      "agent-1",
    );

    // Claim the job first via poll
    const claimReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-1", catalogVersion: "1.0" }),
    });
    const claimRes = await pollPost(claimReq);
    expect(claimRes.status).toBe(200);

    // Heartbeat
    const hbReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${job.id}/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "x-agent-id": "agent-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        observedAt: new Date().toISOString(),
      }),
    });
    const hbRes = await heartbeatPost(hbReq, { params: Promise.resolve({ jobId: job.id }) });
    expect(hbRes.status).toBe(200);
    const hbData = await hbRes.json();
    expect(hbData.cancelRequested).toBe(false);

    // Logs
    const logsReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${job.id}/logs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sequenceStart: 0,
        entries: [{ stream: "stdout", message: "Starting Playwright...", browser: "chromium" }],
      }),
    });
    const logsRes = await logsPost(logsReq, { params: Promise.resolve({ jobId: job.id }) });
    expect(logsRes.status).toBe(200);
    const logsData = await logsRes.json();
    expect(logsData.nextSequence).toBe(1);

    // Complete
    const completeReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${job.id}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "passed",
        browserResults: [
          { browser: "chromium", status: "passed", passed: 1, failed: 0, skipped: 0, durationMs: 1500 },
        ],
      }),
    });
    const completeRes = await completePost(completeReq, { params: Promise.resolve({ jobId: job.id }) });
    expect(completeRes.status).toBe(200);
    const completeData = await completeRes.json();
    expect(completeData.job.status).toBe("passed");
  });
});
