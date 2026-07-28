// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST as authPost } from "@/app/api/test-runner/auth/route";
import { POST as lockPost } from "@/app/api/test-runner/lock/route";
import { NextRequest } from "next/server";
import { resetServerEnvCache } from "@/lib/env/server";
import { createSessionToken } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

describe("Test Runner Execution Auth APIs", () => {
  const secret = "a".repeat(48);
  let validPasswordHash = "";
  let validMonitorToken = "";

  beforeEach(async () => {
    resetServerEnvCache();
    validPasswordHash = await bcrypt.hash("execute-secret-123", 10);
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);
    vi.stubEnv("TEST_RUNNER_PASSWORD_HASH", validPasswordHash);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token");
    validMonitorToken = await createSessionToken();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("returns 503 when TEST_RUNNER_PASSWORD_HASH is missing", async () => {
    vi.stubEnv("TEST_RUNNER_PASSWORD_HASH", "");
    resetServerEnvCache();

    const req = new NextRequest("http://localhost:3000/api/test-runner/auth", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `project_monitor_session=${validMonitorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "execute-secret-123" }),
    });

    const res = await authPost(req);
    expect(res.status).toBe(503);
  });

  it("returns 403 when origin header mismatches request origin", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/auth", {
      method: "POST",
      headers: {
        origin: "http://attacker.com",
        cookie: `project_monitor_session=${validMonitorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "execute-secret-123" }),
    });

    const res = await authPost(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 on wrong password", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/auth", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `project_monitor_session=${validMonitorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "wrong-password" }),
    });

    const res = await authPost(req);
    expect(res.status).toBe(401);
  });

  it("returns 204 and sets HttpOnly cookie on correct password", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/auth", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `project_monitor_session=${validMonitorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "execute-secret-123" }),
    });

    const res = await authPost(req);
    expect(res.status).toBe(204);

    const cookieHeader = res.headers.get("set-cookie");
    expect(cookieHeader).toContain("project_monitor_execute=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toMatch(/SameSite=strict/i);
  });

  it("clears execution cookie on DELETE auth or POST lock", async () => {
    const req = new NextRequest("http://localhost:3000/api/test-runner/lock", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    const res = await lockPost(req);
    expect(res.status).toBe(204);

    const cookieHeader = res.headers.get("set-cookie");
    expect(cookieHeader).toContain("project_monitor_execute=;");
  });
});
