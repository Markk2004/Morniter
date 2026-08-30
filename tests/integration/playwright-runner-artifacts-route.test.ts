// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/playwright-runner/artifacts/[artifactId]/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/session";
import { resetServerEnvCache } from "@/lib/env/server";

describe("Playwright Artifact Download API Route", () => {
  const secret = "s".repeat(48);
  let sessionCookie = "";

  beforeEach(async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    sessionCookie = `project_monitor_session=${await createSessionToken()}`;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/playwright-runner/artifacts/art-123");
    const res = await GET(req, { params: Promise.resolve({ artifactId: "art-123" }) });
    expect(res.status).toBe(401);
  });

  it("downloads artifact content for authenticated operator", async () => {
    const req = new NextRequest("http://localhost:3000/api/playwright-runner/artifacts/art-123", {
      headers: { cookie: sessionCookie },
    });
    const res = await GET(req, { params: Promise.resolve({ artifactId: "art-123" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("art-123.txt");
  });
});
