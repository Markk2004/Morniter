import { describe, expect, it, vi } from "vitest";
import { RenderProvider, normalizeRenderState } from "@/lib/providers/render";
import type { ServerEnv } from "@/lib/env/server";

describe("RenderProvider", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [],
    RENDER_SERVICE_IDS: [{ id: "srv_123", label: "backend" }],
    AIVEN_SERVICE_NAMES: [],
    AIVEN_DATABASE_NAME: "student_tracking",
    CRONJOB_JOB_IDS: [],
    MONITORED_HEALTH_ENDPOINTS: [],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it.each([
    ["live", "healthy", "info"],
    ["build_succeeded", "healthy", "info"],
    ["building", "degraded", "warning"],
    ["deploying", "degraded", "warning"],
    ["build_failed", "failed", "error"],
    ["deploy_failed", "failed", "error"],
    ["deactivated", "failed", "error"],
    ["future_status", "unknown", "warning"],
  ] as const)("maps Render state %s", (raw, status, severity) => {
    expect(normalizeRenderState(raw)).toMatchObject({ status, severity });
  });

  it("returns configuration_error when key is missing", async () => {
    const provider = new RenderProvider(baseEnv);
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.error?.code).toBe("configuration_error");
  });

  it("normalizes Render service and deploys data", async () => {
    const envWithKey: ServerEnv = {
      ...baseEnv,
      RENDER_API_KEY: "rnd_key_123",
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/deploys")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            {
              deploy: {
                id: "dep_abc",
                status: "live",
                createdAt: "2026-07-25T10:00:00Z",
                commit: { id: "c1", message: "Initial release" },
              },
            },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          service: {
            id: "srv_123",
            name: "backend",
            ownerId: "tea_123",
            dashboardUrl: "https://dashboard.render.com/web/srv_123",
          },
        }),
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    const provider = new RenderProvider(envWithKey);
    const snapshot = await provider.fetchSnapshot();

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.services[0].status).toBe("healthy");
    expect(snapshot.events[0].status).toBe("live");
    expect(snapshot.events[0].externalUrl).toBe("https://dashboard.render.com/web/srv_123");
    expect(snapshot.events[0].ownerId).toBe("tea_123");

    vi.unstubAllGlobals();
  });

  it("starts service details and deploy requests concurrently", async () => {
    const envWithKey: ServerEnv = {
      ...baseEnv,
      RENDER_API_KEY: "rnd_key_123",
    };
    const startedUrls: string[] = [];
    let releaseService!: (value: unknown) => void;
    const serviceResponse = new Promise((resolve) => {
      releaseService = resolve;
    });

    const mockFetch = vi.fn((url: string) => {
      startedUrls.push(url);
      if (url.includes("/deploys")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      return serviceResponse.then(() => ({
        ok: true,
        status: 200,
        json: async () => ({
          service: {
            id: "srv_123",
            name: "backend",
            ownerId: "tea_123",
            dashboardUrl: "https://dashboard.render.com/web/srv_123",
          },
        }),
      }));
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new RenderProvider(envWithKey);
    const snapshotPromise = provider.fetchSnapshot();
    await Promise.resolve();

    expect(startedUrls).toEqual([
      "https://api.render.com/v1/services/srv_123",
      "https://api.render.com/v1/services/srv_123/deploys?limit=10",
    ]);

    releaseService(undefined);
    await expect(snapshotPromise).resolves.toMatchObject({
      services: [{ service: "backend", status: "unknown" }],
    });

    vi.unstubAllGlobals();
  });

  it("queries Render build logs for the configured service", async () => {
    const envWithKey: ServerEnv = {
      ...baseEnv,
      RENDER_API_KEY: "rnd_key_123",
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hasMore: false,
        nextStartTime: "2026-07-28T02:00:00Z",
        nextEndTime: "2026-07-28T03:00:00Z",
        logs: [
          {
            id: "log-1",
            message: "npm run build exited with code 1",
            timestamp: "2026-07-28T03:00:00Z",
            labels: [
              { name: "resource", value: "srv_123" },
              { name: "type", value: "build" },
              { name: "level", value: "error" },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new RenderProvider(envWithKey);
    const result = await provider.fetchDiagnostics({
      id: "render-dep_abc",
      source: "render",
      service: "backend",
      type: "deployment",
      severity: "error",
      status: "build_failed",
      message: "Deploy failed",
      occurredAt: "2026-07-28T03:00:00Z",
      resourceId: "srv_123",
      deploymentId: "dep_abc",
      diagnosticAvailable: true,
      ownerId: "tea_123",
    });

    expect(result.summary).toContain("exited with code 1");
    expect(result.lines[0]).toMatchObject({ stage: "build", level: "error" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("ownerId=tea_123"),
      expect.any(Object),
    );

    vi.unstubAllGlobals();
  });
});
