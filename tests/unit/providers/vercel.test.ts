import { describe, expect, it, vi } from "vitest";
import { VercelProvider, normalizeVercelState } from "@/lib/providers/vercel";
import type { ServerEnv } from "@/lib/env/server";

describe("VercelProvider", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [{ id: "prj_1", label: "frontend" }],
    RENDER_SERVICE_IDS: [],
    AIVEN_SERVICE_NAMES: [],
    AIVEN_DATABASE_NAME: "student_tracking",
    CRONJOB_JOB_IDS: [],
    MONITORED_HEALTH_ENDPOINTS: [],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it.each([
    ["READY", "healthy", "info"],
    ["BUILDING", "degraded", "warning"],
    ["INITIALIZING", "degraded", "warning"],
    ["QUEUED", "degraded", "warning"],
    ["ERROR", "failed", "error"],
    ["CANCELED", "failed", "error"],
    ["UNKNOWN_NEW_STATE", "unknown", "warning"],
  ] as const)("maps Vercel state %s", (raw, status, severity) => {
    expect(normalizeVercelState(raw)).toMatchObject({ status, severity });
  });

  it("returns configuration_error when token is missing", async () => {
    const provider = new VercelProvider(baseEnv);
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.error?.code).toBe("configuration_error");
  });

  it("normalizes deployment data cleanly and includes Git metadata and limit=20", async () => {
    const envWithToken: ServerEnv = {
      ...baseEnv,
      VERCEL_API_TOKEN: "vcl_token_123",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        deployments: [
          {
            uid: "dep_123",
            name: "my-app",
            url: "my-app.vercel.app",
            state: "READY",
            created: 1785000000000,
            meta: {
              githubCommitSha: "abc123456789",
              githubCommitMessage: "Merge branch main",
              githubCommitRef: "main",
              githubCommitAuthorName: "Developer",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new VercelProvider(envWithToken);
    const snapshot = await provider.fetchSnapshot();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v6/deployments?projectId=prj_1&limit=20"),
      expect.anything(),
    );
    expect(snapshot.error).toBeUndefined();
    expect(snapshot.services).toHaveLength(1);
    expect(snapshot.services[0].status).toBe("healthy");
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({
      status: "READY",
      commitSha: "abc123456789",
      commitMessage: "Merge branch main",
      branch: "main",
      commitAuthor: "Developer",
      diagnosticAvailable: true,
    });

    vi.unstubAllGlobals();
  });

  it("fetches and classifies deployment events only on demand", async () => {
    const envWithToken: ServerEnv = {
      ...baseEnv,
      VERCEL_API_TOKEN: "vcl_token_123",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          type: "stderr",
          created: 1785000001000,
          payload: { text: "Module not found: package-x" },
        },
        {
          type: "exit",
          created: 1785000002000,
          payload: { text: "Command exited with code 1" },
        },
      ],
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new VercelProvider(envWithToken);
    const result = await provider.fetchDiagnostics({
      id: "vercel-dep_123",
      source: "vercel",
      service: "frontend",
      type: "deployment",
      severity: "error",
      status: "ERROR",
      message: "Deployment failed",
      occurredAt: "2026-07-28T03:00:00Z",
      resourceId: "prj_1",
      deploymentId: "dep_123",
      diagnosticAvailable: true,
    });

    expect(result.summary).toContain("Module not found");
    expect(result.lines[0]).toMatchObject({
      stage: "build",
      level: "error",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v3/deployments/dep_123/events"),
      expect.any(Object),
    );
    expect(mockFetch.mock.calls[0][0]).toContain("builds=1");
    expect(mockFetch.mock.calls[0][0]).toContain("limit=-1");

    vi.unstubAllGlobals();
  });

  it("returns a visible fallback when Vercel has no build log entries", async () => {
    const envWithToken: ServerEnv = {
      ...baseEnv,
      VERCEL_API_TOKEN: "vcl_token_123",
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    }));

    const provider = new VercelProvider(envWithToken);
    const result = await provider.fetchDiagnostics({
      id: "vercel-dep_456",
      source: "vercel",
      service: "frontend",
      type: "deployment",
      severity: "error",
      status: "ERROR",
      message: "Deployment failed",
      occurredAt: "2026-07-28T03:00:00Z",
      resourceId: "prj_1",
      deploymentId: "dep_456",
      diagnosticAvailable: true,
    });

    expect(result.lines[0]).toMatchObject({
      level: "warning",
      stage: "build",
    });
    expect(result.summary).toContain("no build log entries");

    vi.unstubAllGlobals();
  });

  it("describes empty Vercel error events instead of rendering an empty object", async () => {
    const envWithToken: ServerEnv = {
      ...baseEnv,
      VERCEL_API_TOKEN: "vcl_token_123",
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { type: "exit", created: 1785000002000, payload: {} },
      ],
    }));

    const provider = new VercelProvider(envWithToken);
    const result = await provider.fetchDiagnostics({
      id: "vercel-dep_789",
      source: "vercel",
      service: "frontend",
      type: "deployment",
      severity: "error",
      status: "ERROR",
      message: "Deployment failed",
      occurredAt: "2026-07-28T03:00:00Z",
      resourceId: "prj_1",
      deploymentId: "dep_789",
      diagnosticAvailable: true,
    });

    expect(result.lines[0].message).toContain("Vercel build error (exit)");
    expect(result.lines[0].message).not.toBe("{}");

    vi.unstubAllGlobals();
  });
});
