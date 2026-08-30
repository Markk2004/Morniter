// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/playwright-runner/source/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { resetServerEnvCache } from "@/lib/env/server";

const fakeStore = new Map<string, unknown>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    get: vi.fn(async (key: string) => fakeStore.get(key) ?? null),
    set: vi.fn(async (key: string, val: unknown) => {
      fakeStore.set(key, val);
      return "OK";
    }),
  }),
}));

describe("Playwright Source Loading API Route", () => {
  const secret = "s".repeat(48);
  let sessionCookie = "";

  beforeEach(async () => {
    fakeStore.clear();
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    sessionCookie = `project_monitor_session=${await createSessionToken()}`;

    // Seed catalog in fake redis
    fakeStore.set("monitor:playwright:v1:agent:windows-local-agent-1:catalog", {
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "projectsts",
          name: "ProjectSTS",
          tests: [
            {
              id: "auth-spec-1",
              title: "Login spec",
              group: "Auth",
              relativePath: "e2e/auth.spec.ts",
            },
          ],
          sourceByPath: {
            "e2e/auth.spec.ts": 'import { test } from "@playwright/test"; test("Login spec", () => {});',
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/playwright-runner/source?projectId=projectsts&testId=auth-spec-1");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing query parameters", async () => {
    const req = new NextRequest("http://localhost:3000/api/playwright-runner/source", {
      headers: { cookie: sessionCookie },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("loads the source published by the Local Agent", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/playwright-runner/source?projectId=projectsts&testId=auth-spec-1",
      { headers: { cookie: sessionCookie } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.projectId).toBe("projectsts");
    expect(data.testId).toBe("auth-spec-1");
    expect(data.runner).toBe("playwright");
    expect(data.content).toContain('@playwright/test');
  });

  it("loads source for coverage group tests across runners", async () => {
    // Add coverage group with jest test
    fakeStore.set("monitor:playwright:v1:agent:windows-local-agent-1:catalog", {
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "projectsts",
          name: "ProjectSTS",
          coverageGroups: [
            {
              id: "FN-STS-01",
              name: "Authentication",
              tests: [
                {
                  id: "jest-auth-test-1",
                  title: "Auth Service Test",
                  relativePath: "backend/src/auth.service.spec.ts",
                  runner: "jest",
                  executionProfileId: "backend-jest",
                  executable: false,
                  origin: "manual",
                  confidence: "high",
                  matchedBy: ["path"],
                },
              ],
              gaps: [],
            },
          ],
          sourceByPath: {
            "backend/src/auth.service.spec.ts": 'describe("AuthService", () => { it("validates", () => {}); });',
          },
        },
      ],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/playwright-runner/source?projectId=projectsts&testId=jest-auth-test-1",
      { headers: { cookie: sessionCookie } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.projectId).toBe("projectsts");
    expect(data.testId).toBe("jest-auth-test-1");
    expect(data.runner).toBe("jest");
    expect(data.content).toContain('describe("AuthService"');
  });

  it("returns 404 for unknown test IDs", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/playwright-runner/source?projectId=projectsts&testId=non-existent-id",
      { headers: { cookie: sessionCookie } },
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
