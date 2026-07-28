// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET as snapshotGet } from "@/app/api/monitor/snapshot/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { resetServerEnvCache } from "@/lib/env/server";

describe("GET /api/monitor/snapshot route handler", () => {
  const secret = "a".repeat(48);

  it("returns 401 when no session cookie is provided", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const req = new NextRequest("http://localhost:3000/api/monitor/snapshot");
    const res = await snapshotGet(req);
    expect(res.status).toBe(401);

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("returns 200 and snapshot JSON when authenticated and a provider succeeds", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);
    vi.stubEnv("MONITORED_HEALTH_ENDPOINTS", "https://api.example.com/health:health");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const token = await createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/monitor/snapshot", {
      headers: {
        cookie: `project_monitor_session=${token}`,
      },
    });

    const res = await snapshotGet(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.refreshAfterSeconds).toBe(20);
    expect(Array.isArray(data.providers)).toBe(true);

    const forceReq = new NextRequest("http://localhost:3000/api/monitor/snapshot?force=1", {
      headers: {
        cookie: `project_monitor_session=${token}`,
      },
    });
    const forceRes = await snapshotGet(forceReq);
    expect(forceRes.status).toBe(200);
    const forceData = await forceRes.json();
    expect(forceData.refreshAfterSeconds).toBe(20);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
