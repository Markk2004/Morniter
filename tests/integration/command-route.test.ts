// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { POST as commandPost } from "@/app/api/monitor/command/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { resetServerEnvCache } from "@/lib/env/server";

describe("POST /api/monitor/command route handler", () => {
  const secret = "a".repeat(48);

  it("returns 401 when no session cookie is provided", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const req = new NextRequest("http://localhost:3000/api/monitor/command", {
      method: "POST",
      body: JSON.stringify({ command: "health all" }),
    });
    const res = await commandPost(req);
    expect(res.status).toBe(401);

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("returns 400 for invalid command grammar", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const token = await createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/monitor/command", {
      method: "POST",
      headers: {
        cookie: `project_monitor_session=${token}`,
      },
      body: JSON.stringify({ command: "rm -rf /" }),
    });

    const res = await commandPost(req);
    expect(res.status).toBe(400);

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
