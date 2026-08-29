// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET as catalogGet } from "@/app/api/playwright-runner/catalog/route";
import { GET as jobsGet, POST as jobsPost } from "@/app/api/playwright-runner/jobs/route";
import { GET as jobDetailGet } from "@/app/api/playwright-runner/jobs/[jobId]/route";
import { POST as jobCancelPost } from "@/app/api/playwright-runner/jobs/[jobId]/cancel/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { createExecuteSessionToken } from "@/lib/auth/execute-session";
import { resetServerEnvCache } from "@/lib/env/server";
import { publishPlaywrightCatalog } from "@/lib/playwright-runner/job-store";

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

describe("Playwright Runner Browser Routes", () => {
  const secret = "s".repeat(48);
  let monitorCookie = "";
  let executeCookie = "";

  beforeEach(async () => {
    fakeStore.clear();
    fakeLists.clear();
    fakeSortedSets.clear();
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    monitorCookie = `project_monitor_session=${await createSessionToken()}`;
    executeCookie = `project_monitor_execute=${await createExecuteSessionToken()}`;

    await publishPlaywrightCatalog(
      {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        projects: [
          {
            id: "projectsts",
            name: "ProjectSTS",
            testGroups: [
              {
                name: "Auth",
                tests: [
                  {
                    id: "auth-login",
                    title: "Login",
                    group: "Auth",
                    relativePath: "e2e/auth.spec.ts",
                  },
                ],
              },
            ],
            sourceByPath: {
              "e2e/auth.spec.ts": 'import { test } from "@playwright/test"; test("Login", () => {});',
            },
          },
        ],
      },
      { browsers: { chromium: true, firefox: true }, headed: true },
      "windows-local-agent-1",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("GET /api/playwright-runner/catalog requires monitor read session", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/playwright-runner/catalog");
    const unauthRes = await catalogGet(unauthReq);
    expect(unauthRes.status).toBe(401);

    const authReq = new NextRequest("http://localhost:3000/api/playwright-runner/catalog", {
      headers: { cookie: monitorCookie },
    });
    const authRes = await catalogGet(authReq);
    expect(authRes.status).toBe(200);
    const data = await authRes.json();
    expect(data.catalog.projects).toHaveLength(1);
    expect(data.presence.state).toBe("online");
    expect(data.catalog.projects[0].testGroups[0].tests[0].relativePath).toBe("e2e/auth.spec.ts");
    expect(JSON.stringify(data.catalog)).not.toContain("sourceByPath");
    expect(JSON.stringify(data.catalog)).not.toContain("E:\\ProjectSTS");
  });

  it("POST /api/playwright-runner/jobs requires execute step-up session", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: monitorCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
      }),
    });

    const unauthRes = await jobsPost(unauthReq);
    expect(unauthRes.status).toBe(403);

    const authReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
      }),
    });

    const authRes = await jobsPost(authReq);
    expect(authRes.status).toBe(201);
    const job = await authRes.json();
    expect(job.status).toBe("queued");
    expect(job.browsers).toEqual(["chromium"]);
  });

  it("GET /api/playwright-runner/jobs returns job list", async () => {
    const authReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      headers: { cookie: monitorCookie },
    });
    const res = await jobsGet(authReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.jobs)).toBe(true);
  });

  it("GET /api/playwright-runner/jobs/[jobId] and POST cancel", async () => {
    // Create a job first
    const createReq = new NextRequest("http://localhost:3000/api/playwright-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "projectsts",
        source: "workspace",
        code: "test('a', () => {})",
        browsers: ["chromium"],
        mode: "headless",
      }),
    });
    const createRes = await jobsPost(createReq);
    const createdJob = await createRes.json();

    // Get detail
    const detailReq = new NextRequest(`http://localhost:3000/api/playwright-runner/jobs/${createdJob.id}`, {
      headers: { cookie: monitorCookie },
    });
    const detailRes = await jobDetailGet(detailReq, { params: Promise.resolve({ jobId: createdJob.id }) });
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.job.id).toBe(createdJob.id);

    // Cancel job
    const cancelReq = new NextRequest(`http://localhost:3000/api/playwright-runner/jobs/${createdJob.id}/cancel`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
      },
    });
    const cancelRes = await jobCancelPost(cancelReq, { params: Promise.resolve({ jobId: createdJob.id }) });
    expect(cancelRes.status).toBe(200);
    const cancelData = await cancelRes.json();
    expect(cancelData.job.status).toBe("cancelled");
  });
});
