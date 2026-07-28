// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET as catalogGet } from "@/app/api/test-runner/catalog/route";
import { POST as jobsPost } from "@/app/api/test-runner/jobs/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { createExecuteSessionToken } from "@/lib/auth/execute-session";
import { resetServerEnvCache } from "@/lib/env/server";
import { publishCatalog } from "@/lib/test-runner/store";

// Mock fake redis
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
    zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
      const set = (fakeStore.get(key) as Array<{ score: number; member: string }>) || [];
      const sorted = [...set].sort((a, b) => b.score - a.score);
      const slice = sorted.slice(start, stop < 0 ? sorted.length : stop + 1);
      return slice.map((item) => item.member);
    }),
  }),
  TestRunnerConfigError: class extends Error {},
}));

describe("Browser-Facing Test Runner APIs", () => {
  const secret = "s".repeat(48);
  let monitorCookie = "";
  let executeCookie = "";

  beforeEach(async () => {
    fakeStore.clear();
    fakeLists.clear();
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    monitorCookie = `project_monitor_session=${await createSessionToken()}`;
    executeCookie = `project_monitor_execute=${await createExecuteSessionToken()}`;

    await publishCatalog({
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "frontend",
          name: "Frontend UI",
          presets: [
            {
              id: "vitest-unit",
              name: "Vitest Unit",
              description: "Run vitest",
              commandPreview: "npx vitest run",
              timeoutSeconds: 120,
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

  it("GET /api/test-runner/catalog requires monitor read session", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/test-runner/catalog");
    const unauthRes = await catalogGet(unauthReq);
    expect(unauthRes.status).toBe(401);

    const authReq = new NextRequest("http://localhost:3000/api/test-runner/catalog", {
      headers: { cookie: monitorCookie },
    });
    const authRes = await catalogGet(authReq);
    expect(authRes.status).toBe(200);
    const data = await authRes.json();
    expect(data.catalog.projects).toHaveLength(1);
  });

  it("POST /api/test-runner/jobs requires execute session step-up", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/test-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: monitorCookie, // missing executeCookie
        "content-type": "application/json",
      },
      body: JSON.stringify({ projectId: "frontend", presetId: "vitest-unit" }),
    });

    const unauthRes = await jobsPost(unauthReq);
    expect(unauthRes.status).toBe(403);

    const authReq = new NextRequest("http://localhost:3000/api/test-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ projectId: "frontend", presetId: "vitest-unit" }),
    });

    const authRes = await jobsPost(authReq);
    expect(authRes.status).toBe(201);
    const job = await authRes.json();
    expect(job.status).toBe("queued");
  });

  it("POST /api/test-runner/jobs rejects unknown preset with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/jobs", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${monitorCookie}; ${executeCookie}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ projectId: "frontend", presetId: "unknown-preset" }),
    });

    const res = await jobsPost(req);
    expect(res.status).toBe(400);
  });
});
