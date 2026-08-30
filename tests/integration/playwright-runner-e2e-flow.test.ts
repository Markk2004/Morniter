// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST as pollPost } from "@/app/api/playwright-runner/agent/poll/route";
import { POST as jobsPost, GET as jobsGet } from "@/app/api/playwright-runner/jobs/route";
import { GET as jobDetailGet } from "@/app/api/playwright-runner/jobs/[jobId]/route";
import { POST as heartbeatPost } from "@/app/api/playwright-runner/agent/jobs/[jobId]/heartbeat/route";
import { POST as logsPost } from "@/app/api/playwright-runner/agent/jobs/[jobId]/logs/route";
import { POST as completePost } from "@/app/api/playwright-runner/agent/jobs/[jobId]/complete/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { createExecuteSessionToken } from "@/lib/auth/execute-session";
import { resetServerEnvCache } from "@/lib/env/server";
import { reapStalePlaywrightJobs, getPlaywrightJob } from "@/lib/playwright-runner/job-store";

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

describe("Playwright Runner Full E2E Flow & Agent Reconnection", () => {
  const secret = "s".repeat(48);
  const agentToken = "t".repeat(32);
  let monitorCookie = "";
  let executeCookie = "";

  beforeEach(async () => {
    fakeStore.clear();
    fakeLists.clear();
    fakeSortedSets.clear();
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", agentToken);

    monitorCookie = `project_monitor_session=${await createSessionToken()}`;
    executeCookie = `project_monitor_execute=${await createExecuteSessionToken()}`;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("completes full lifecycle: submit -> agent poll -> stream logs -> per-browser completion", async () => {
    // 1. Agent starts up and polls, publishing its initial catalog
    const initialPollReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentId: "agent-win-1",
        catalogVersion: "2.0.0",
        catalog: {
          version: "2.0.0",
          updatedAt: new Date().toISOString(),
          projects: [
            {
              id: "projectsts",
              name: "ProjectSTS",
              tests: [
                { id: "test-auth-1", title: "Login spec", group: "Auth", relativePath: "e2e/auth.spec.ts" },
              ],
            },
          ],
        },
        capabilities: {
          browsers: { chromium: true, firefox: true, webkit: false },
          headed: true,
          workspaceExecution: true,
        },
      }),
    });
    const initialPollRes = await pollPost(initialPollReq);
    expect(initialPollRes.status).toBe(204);

    // 2. Operator submits a Playwright run for Chromium + Firefox
    const submitReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
        "idempotency-key": "e2e-flow-test-idempotency-key-01",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "project-test",
        testIds: ["test-auth-1"],
        browsers: ["chromium", "firefox"],
        mode: "headless",
        agentId: "agent-win-1",
      }),
    });
    const submitRes = await jobsPost(submitReq);
    expect(submitRes.status).toBe(201);
    const createdJob = await submitRes.json();
    expect(createdJob.status).toBe("queued");
    expect(createdJob.browsers).toEqual(["chromium", "firefox"]);

    // 3. Agent polls and claims the queued job
    const claimPollReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-win-1", catalogVersion: "2.0.0" }),
    });
    const claimPollRes = await pollPost(claimPollReq);
    expect(claimPollRes.status).toBe(200);
    const claimData = await claimPollRes.json();
    expect(claimData.job.id).toBe(createdJob.id);
    expect(claimData.job.status).toBe("claimed");

    // 4. Agent sends heartbeat
    const hbReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${createdJob.id}/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "x-agent-id": "agent-win-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ observedAt: new Date().toISOString() }),
    });
    const hbRes = await heartbeatPost(hbReq, { params: Promise.resolve({ jobId: createdJob.id }) });
    expect(hbRes.status).toBe(200);

    // 5. Agent streams log batch for chromium and firefox
    const logBatchReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${createdJob.id}/logs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sequenceStart: 0,
        entries: [
          { stream: "stdout", message: "[chromium] Running Login spec...", browser: "chromium" },
          { stream: "stdout", message: "[chromium] ✓ Passed (1.2s)", browser: "chromium" },
          { stream: "stdout", message: "[firefox] Running Login spec...", browser: "firefox" },
          { stream: "stdout", message: "[firefox] ✓ Passed (1.8s)", browser: "firefox" },
        ],
        browserResults: [
          { browser: "chromium", status: "passed", passed: 1, failed: 0, skipped: 0, durationMs: 1200 },
          { browser: "firefox", status: "passed", passed: 1, failed: 0, skipped: 0, durationMs: 1800 },
        ],
      }),
    });
    const logBatchRes = await logsPost(logBatchReq, { params: Promise.resolve({ jobId: createdJob.id }) });
    expect(logBatchRes.status).toBe(200);

    // 6. Operator polls job detail and receives incremental logs without duplication
    const detailReq = new NextRequest(`http://localhost:3000/api/playwright-runner/jobs/${createdJob.id}?afterSequence=-1&limit=100`, {
      headers: { cookie: monitorCookie },
    });
    const detailRes = await jobDetailGet(detailReq, { params: Promise.resolve({ jobId: createdJob.id }) });
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.logs).toHaveLength(4);
    expect(detailData.nextSequence).toBe(4);

    // 7. Agent completes job
    const completeReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${createdJob.id}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "passed",
        browserResults: [
          { browser: "chromium", status: "passed", passed: 1, failed: 0, skipped: 0, durationMs: 1200 },
          { browser: "firefox", status: "passed", passed: 1, failed: 0, skipped: 0, durationMs: 1800 },
        ],
        artifacts: [
          {
            id: "art-1",
            jobId: createdJob.id,
            type: "report",
            filename: "playwright-report.zip",
            size: 15400,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    const completeRes = await completePost(completeReq, { params: Promise.resolve({ jobId: createdJob.id }) });
    expect(completeRes.status).toBe(200);
    const completedJob = await completeRes.json();
    expect(completedJob.job.status).toBe("passed");
    expect(completedJob.job.artifacts).toHaveLength(1);

    // 8. History reflects completed job
    const historyReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      headers: { cookie: monitorCookie },
    });
    const historyRes = await jobsGet(historyReq);
    expect(historyRes.status).toBe(200);
    const historyData = await historyRes.json();
    expect(historyData.jobs.some((j: { id: string }) => j.id === createdJob.id)).toBe(true);
  });

  it("handles agent disconnect / stale lease reaping and subsequent agent reconnection", async () => {
    // 1. Submit a job
    const submitReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "workspace",
        code: "test('stale test', () => {})",
        browsers: ["chromium"],
        mode: "headless",
        agentId: "agent-disconnect-test",
      }),
    });
    const submitRes = await jobsPost(submitReq);
    const job = await submitRes.json();

    // 2. Agent claims the job
    const claimReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-disconnect-test", catalogVersion: "2.0.0" }),
    });
    await pollPost(claimReq);

    // 3. Heartbeat lost: Simulate time advancing past lease window (3 minutes later)
    const futureDate = new Date(Date.now() + 180000);
    const reaped = await reapStalePlaywrightJobs(futureDate);
    expect(reaped).toContain(job.id);

    const reapedJob = await getPlaywrightJob(job.id);
    expect(reapedJob?.status).toBe("failed");
    expect(reapedJob?.error).toContain("expired");

    // 4. Agent reconnects: Queue and active lease are unblocked so agent can claim new jobs
    const newSubmitReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "workspace",
        code: "test('recovery test', () => {})",
        browsers: ["chromium"],
        mode: "headless",
        agentId: "agent-disconnect-test",
      }),
    });
    const newSubmitRes = await jobsPost(newSubmitReq);
    expect(newSubmitRes.status).toBe(201);
    const newJob = await newSubmitRes.json();

    // Reconnected agent polls and successfully claims new job
    const reconnectPollReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-disconnect-test", catalogVersion: "2.0.0" }),
    });
    const reconnectPollRes = await pollPost(reconnectPollReq);
    expect(reconnectPollRes.status).toBe(200);
    const pollData = await reconnectPollRes.json();
    expect(pollData.job.id).toBe(newJob.id);
  });

  it("handles mixed runner job completion with sequential runnerResults", async () => {
    // 1. Operator submits mixed runner job
    const submitReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
        "idempotency-key": "mixed-runner-job-01",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "project-test",
        testIds: ["jest-test-1", "node-test-1"],
        browsers: ["chromium"],
        mode: "headless",
        agentId: "agent-mixed-1",
      }),
    });
    const submitRes = await jobsPost(submitReq);
    expect(submitRes.status).toBe(201);
    const job = await submitRes.json();

    // 2. Agent claims job
    const claimReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-mixed-1", catalogVersion: "2.0.0" }),
    });
    const claimRes = await pollPost(claimReq);
    expect(claimRes.status).toBe(200);

    // 3. Agent streams mixed runner logs
    const logReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${job.id}/logs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sequenceStart: 0,
        entries: [
          { stream: "system", message: "[NODE] Running node tests..." },
          { stream: "stdout", message: "[NODE] ✓ auth contract passed" },
          { stream: "system", message: "[JEST] Running jest tests..." },
          { stream: "stdout", message: "[JEST] ✓ auth service passed" },
        ],
      }),
    });
    const logRes = await logsPost(logReq, { params: Promise.resolve({ jobId: job.id }) });
    expect(logRes.status).toBe(200);

    // 4. Agent completes with runnerResults
    const completeReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/jobs/${job.id}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "passed",
        runnerResults: [
          {
            runner: "node-test",
            executionProfileId: "frontend-node",
            status: "passed",
            testIds: ["node-test-1"],
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 400,
            exitCode: 0,
          },
          {
            runner: "jest",
            executionProfileId: "backend-jest",
            status: "passed",
            testIds: ["jest-test-1"],
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 800,
            exitCode: 0,
          },
        ],
      }),
    });
    const completeRes = await completePost(completeReq, { params: Promise.resolve({ jobId: job.id }) });
    expect(completeRes.status).toBe(200);
    const completeData = await completeRes.json();
    expect(completeData.job.status).toBe("passed");
    expect(completeData.job.runnerResults).toHaveLength(2);
    expect(completeData.job.runnerResults[0].runner).toBe("node-test");
    expect(completeData.job.runnerResults[1].runner).toBe("jest");
  });
});
