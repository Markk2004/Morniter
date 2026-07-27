// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { POST as agentPost } from "@/app/api/monitor/agent/events/route";
import { NextRequest } from "next/server";
import { resetServerEnvCache } from "@/lib/env/server";

describe("POST /api/monitor/agent/events route handler", () => {
  it("returns 401 when Authorization header is invalid or missing", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "x".repeat(48));
    vi.stubEnv("MONITOR_AGENT_INGEST_TOKEN", "valid-agent-token");

    const req = new NextRequest("http://localhost:3000/api/monitor/agent/events", {
      method: "POST",
      body: JSON.stringify([{ projectId: "test", level: "info", message: "hi" }]),
    });
    const res = await agentPost(req);
    expect(res.status).toBe(401);

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("accepts valid batch and returns 202", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "x".repeat(48));
    vi.stubEnv("MONITOR_AGENT_INGEST_TOKEN", "valid-agent-token");
    vi.stubEnv("MONITOR_AGENT_PROJECT_ID", "test-project");

    const req = new NextRequest("http://localhost:3000/api/monitor/agent/events", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-agent-token",
      },
      body: JSON.stringify([
        {
          projectId: "test-project",
          service: "dev-api",
          level: "info",
          message: "Server started",
          timestamp: new Date().toISOString(),
        },
      ]),
    });
    const res = await agentPost(req);
    expect(res.status).toBe(202);

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
