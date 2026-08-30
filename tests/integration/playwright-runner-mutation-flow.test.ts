// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { POST as mutationPost } from "@/app/api/playwright-runner/mutations/route";
import { GET as mutationGet } from "@/app/api/playwright-runner/mutations/[mutationId]/route";
import { POST as agentMutationPollPost } from "@/app/api/playwright-runner/agent/mutations/poll/route";
import { POST as agentMutationCompletePost } from "@/app/api/playwright-runner/agent/mutations/[mutationId]/complete/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { createExecuteSessionToken } from "@/lib/auth/execute-session";
import { resetServerEnvCache } from "@/lib/env/server";
import { renderRecipeToPlaywrightCode } from "@/lib/playwright-runner/recipe-renderer";
import type { RecipeDraft } from "@/lib/playwright-runner/recipe-types";

const fakeStore = new Map<string, unknown>();
const fakeLists = new Map<string, string[]>();

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
    lpush: vi.fn(async (key: string, val: string) => {
      const list = fakeLists.get(key) || [];
      list.unshift(val);
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
  }),
}));

describe("Playwright Runner Mutation Queue API & Flow", () => {
  const secret = "s".repeat(48);
  const agentToken = "t".repeat(32);
  let monitorCookie = "";
  let executeCookie = "";

  beforeEach(async () => {
    fakeStore.clear();
    fakeLists.clear();
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

  it("handles full recipe save mutation flow from operator request to agent execution", async () => {
    const recipe: RecipeDraft = {
      id: "recipe-login-01",
      title: "Login check",
      functionId: "FN-STS-01",
      output: "frontend/e2e/generated/fn-sts-01/login.spec.ts",
      risk: "read-only",
      actions: [{ kind: "goto", url: "/login" }],
    };

    const renderedCode = renderRecipeToPlaywrightCode(recipe);
    const renderedCodeHash = crypto.createHash("sha256").update(renderedCode).digest("hex");

    // Seed verified passing job in redis store
    const verifiedJobId = "job-verified-pass-01";
    fakeStore.set(`monitor:playwright:v1:job:${verifiedJobId}`, {
      id: verifiedJobId,
      projectId: "sts-playwright",
      source: "workspace",
      code: renderedCode,
      status: "passed",
      browsers: ["chromium"],
      mode: "headless",
      browserResults: [{ browser: "chromium", status: "passed", passed: 1, failed: 0, skipped: 0, durationMs: 1200 }],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Operator submits recipe save mutation
    const req = new NextRequest("http://localhost:3000/api/playwright-runner/mutations", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "sts-playwright",
        agentId: "agent-win-1",
        baseRevision: "rev-hash-1234",
        recipe,
        verifiedJobId,
        renderedCodeHash,
      }),
    });

    const res = await mutationPost(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.mutation.id).toMatch(/^mut-/);
    expect(data.mutation.status).toBe("queued");

    const mutationId = data.mutation.id;

    // 2. Local Agent polls mutation queue
    const pollReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/mutations/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-win-1" }),
    });
    const pollRes = await agentMutationPollPost(pollReq);
    expect(pollRes.status).toBe(200);
    const pollData = await pollRes.json();
    expect(pollData.mutation?.id).toBe(mutationId);
    expect(pollData.mutation?.status).toBe("claimed");

    // Concurrency check: agent cannot claim second mutation while active lease is held
    fakeLists.set("monitor:playwright:v1:mutation-queue:agent-win-1", ["mut-other-02"]);
    const secondPollReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/mutations/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-win-1" }),
    });
    const secondPollRes = await agentMutationPollPost(secondPollReq);
    expect(secondPollRes.status).toBe(204);

    // 3. Operator checks mutation status -> claimed
    const statusReq = new NextRequest(`http://localhost:3000/api/playwright-runner/mutations/${mutationId}`, {
      headers: { cookie: monitorCookie },
    });
    const statusRes = await mutationGet(statusReq, { params: Promise.resolve({ mutationId }) });
    expect(statusRes.status).toBe(200);
    const statusData = await statusRes.json();
    expect(statusData.mutation.status).toBe("claimed");

    // 4. Agent completes mutation with success
    const completeReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/mutations/${mutationId}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        leaseToken: pollData.mutation.leaseToken,
        status: "succeeded",
        newRevision: "rev-hash-5678",
        writtenFiles: ["frontend/e2e/generated/fn-sts-01/login.spec.ts"],
      }),
    });
    const completeRes = await agentMutationCompletePost(completeReq, { params: Promise.resolve({ mutationId }) });
    expect(completeRes.status).toBe(200);

    // 5. Operator checks final status -> succeeded
    const finalStatusRes = await mutationGet(statusReq, { params: Promise.resolve({ mutationId }) });
    const finalData = await finalStatusRes.json();
    expect(finalData.mutation.status).toBe("succeeded");
    expect(finalData.mutation.newRevision).toBe("rev-hash-5678");
  });

  it("rejects recipe save mutation if verified job is missing or failed", async () => {
    const recipe: RecipeDraft = {
      id: "recipe-login-02",
      title: "Login check 2",
      functionId: "FN-STS-01",
      output: "frontend/e2e/generated/fn-sts-01/login2.spec.ts",
      risk: "read-only",
      actions: [{ kind: "goto", url: "/login" }],
    };

    const renderedCode = renderRecipeToPlaywrightCode(recipe);
    const renderedCodeHash = crypto.createHash("sha256").update(renderedCode).digest("hex");

    // Seed failed job in redis store
    fakeStore.set("monitor:playwright:v1:job:job-failed-01", {
      id: "job-failed-01",
      projectId: "sts-playwright",
      source: "workspace",
      code: renderedCode,
      status: "failed",
      browsers: ["chromium"],
      mode: "headless",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/playwright-runner/mutations", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "sts-playwright",
        agentId: "agent-win-1",
        baseRevision: "rev-hash-1234",
        recipe,
        verifiedJobId: "job-failed-01",
        renderedCodeHash,
      }),
    });

    const res = await mutationPost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("DRAFT_NOT_PASSED");
  });

  it("recovers and fails stale mutation when active lease expires", async () => {
    // Seed a claimed mutation that was claimed 65 seconds ago
    const staleMutationId = "mut-stale-01";
    const staleTime = new Date(Date.now() - 65 * 1000).toISOString();
    fakeStore.set(`monitor:playwright:v1:mutation:${staleMutationId}`, {
      id: staleMutationId,
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      baseRevision: "rev-123",
      recipe: { id: "rec-1", title: "Rec 1", functionId: "FN-STS-01", output: "test.spec.ts", risk: "read-only", actions: [] },
      status: "claimed",
      createdAt: staleTime,
      updatedAt: staleTime,
    });
    fakeStore.set("monitor:playwright:v1:mutation-active:agent-win-1", staleMutationId);

    // Queue a fresh mutation
    const nextMutationId = "mut-next-02";
    fakeStore.set(`monitor:playwright:v1:mutation:${nextMutationId}`, {
      id: nextMutationId,
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      baseRevision: "rev-123",
      recipe: { id: "rec-2", title: "Rec 2", functionId: "FN-STS-01", output: "test2.spec.ts", risk: "read-only", actions: [] },
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    fakeLists.set("monitor:playwright:v1:mutation-queue:agent-win-1", [nextMutationId]);

    // Agent polls
    const pollReq = new NextRequest("http://localhost:3000/api/playwright-runner/agent/mutations/poll", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentId: "agent-win-1" }),
    });
    const pollRes = await agentMutationPollPost(pollReq);
    expect(pollRes.status).toBe(200);
    const pollData = await pollRes.json();
    expect(pollData.mutation?.id).toBe(nextMutationId);

    // Assert that the stale mutation was marked failed with lease expired error
    const staleRecord = fakeStore.get(`monitor:playwright:v1:mutation:${staleMutationId}`) as { status: string; error: string };
    expect(staleRecord.status).toBe("failed");
    expect(staleRecord.error).toMatch(/lease expired/i);
  });

  it("rejects completion when leaseToken does not match", async () => {
    const mutationId = "mut-token-check";
    fakeStore.set(`monitor:playwright:v1:mutation:${mutationId}`, {
      id: mutationId,
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      baseRevision: "rev-123",
      recipe: { id: "rec-1", title: "Rec 1", functionId: "FN-STS-01", output: "test.spec.ts", risk: "read-only", actions: [] },
      leaseToken: "valid-lease-token-123",
      status: "claimed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    fakeStore.set("monitor:playwright:v1:mutation-active:agent-win-1", JSON.stringify({
      mutationId,
      leaseToken: "valid-lease-token-123",
    }));

    const completeReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/mutations/${mutationId}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        leaseToken: "wrong-stale-token",
        status: "succeeded",
      }),
    });

    const completeRes = await agentMutationCompletePost(completeReq, { params: Promise.resolve({ mutationId }) });
    expect(completeRes.status).toBe(409);
    const data = await completeRes.json();
    expect(data.code).toBe("LEASE_LOST");
  });

  it("rejects completion when active lease has expired and disappeared", async () => {
    const mutationId = "mut-expired-active";
    fakeStore.set(`monitor:playwright:v1:mutation:${mutationId}`, {
      id: mutationId,
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      baseRevision: "rev-123",
      recipe: { id: "rec-1", title: "Rec 1", functionId: "FN-STS-01", output: "test.spec.ts", risk: "read-only", actions: [] },
      leaseToken: "valid-lease-token-123",
      status: "claimed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // Active lease key has expired / was removed from Redis!
    fakeStore.delete("monitor:playwright:v1:mutation-active:agent-win-1");

    const completeReq = new NextRequest(`http://localhost:3000/api/playwright-runner/agent/mutations/${mutationId}/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        leaseToken: "valid-lease-token-123",
        status: "succeeded",
      }),
    });

    const completeRes = await agentMutationCompletePost(completeReq, { params: Promise.resolve({ mutationId }) });
    expect(completeRes.status).toBe(409);
    const data = await completeRes.json();
    expect(data.code).toBe("LEASE_LOST");
  });
});
