import { describe, expect, it, vi } from "vitest";
import { HealthProvider } from "@/lib/providers/health";
import type { ServerEnv } from "@/lib/env/server";

describe("HealthProvider", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [],
    RENDER_SERVICE_IDS: [],
    AIVEN_SERVICE_NAMES: [],
    AIVEN_DATABASE_NAME: "student_tracking",
    CRONJOB_JOB_IDS: [],
    MONITORED_HEALTH_ENDPOINTS: [
      { id: "https://api.example.com/health", label: "main-api" },
    ],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it("returns configuration_error when no endpoints configured", async () => {
    const provider = new HealthProvider({
      ...baseEnv,
      MONITORED_HEALTH_ENDPOINTS: [],
    });
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.error?.code).toBe("configuration_error");
  });

  it("performs health check and reports status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new HealthProvider(baseEnv);
    const snapshot = await provider.fetchSnapshot();

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.services[0].status).toBe("healthy");
    expect(snapshot.events[0].status).toBe("UP");

    vi.unstubAllGlobals();
  });
});
