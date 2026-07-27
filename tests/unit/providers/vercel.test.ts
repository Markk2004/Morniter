import { describe, expect, it, vi } from "vitest";
import { VercelProvider } from "@/lib/providers/vercel";
import type { ServerEnv } from "@/lib/env/server";

describe("VercelProvider", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [{ id: "prj_1", label: "frontend" }],
    RENDER_SERVICE_IDS: [],
    AIVEN_SERVICE_NAMES: [],
    CRONJOB_JOB_IDS: [],
    MONITORED_HEALTH_ENDPOINTS: [],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it("returns configuration_error when token is missing", async () => {
    const provider = new VercelProvider(baseEnv);
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.error?.code).toBe("configuration_error");
  });

  it("normalizes deployment data cleanly", async () => {
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
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new VercelProvider(envWithToken);
    const snapshot = await provider.fetchSnapshot();

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.services).toHaveLength(1);
    expect(snapshot.services[0].status).toBe("healthy");
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].status).toBe("READY");

    vi.unstubAllGlobals();
  });
});
