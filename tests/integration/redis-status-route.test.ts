// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { resetServerEnvCache } from "@/lib/env/server";
import { GET as redisStatusGet } from "@/app/api/monitor/redis-status/route";

vi.mock("@/lib/test-runner/redis-status", () => ({
  readRedisStatus: vi.fn().mockResolvedValue({
    status: "HEALTHY",
    checkedAt: "2026-07-29T00:00:00.000Z",
    latencyMs: 12,
    metrics: {
      totalCommandsProcessed: 42,
      usedMemoryBytes: 2048,
      totalKeys: 12,
      uptimeSeconds: 120,
    },
    appCommands: {
      total: 3,
      byCommand: { GET: 2, SET: 1 },
      windowStartedAt: "2026-07-29T00:00:00.000Z",
      windowDurationSeconds: 30,
    },
    error: null,
  }),
}));

describe("GET /api/monitor/redis-status route handler", () => {
  const secret = "a".repeat(48);

  it("returns 401 when no session cookie is provided", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const response = await redisStatusGet(
      new NextRequest("http://localhost:3000/api/monitor/redis-status"),
    );

    expect(response.status).toBe(401);
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("returns the safe status payload for an authenticated session", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const token = await createSessionToken();
    const response = await redisStatusGet(
      new NextRequest("http://localhost:3000/api/monitor/redis-status", {
        headers: { cookie: `project_monitor_session=${token}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "HEALTHY" });
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
