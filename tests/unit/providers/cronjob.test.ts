import { describe, expect, it, vi } from "vitest";
import { CronJobProvider } from "@/lib/providers/cronjob";
import type { ServerEnv } from "@/lib/env/server";

describe("CronJobProvider", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [],
    RENDER_SERVICE_IDS: [],
    AIVEN_SERVICE_NAMES: [],
    AIVEN_DATABASE_NAME: "student_tracking",
    CRONJOB_JOB_IDS: [{ id: "8158370", label: "news-process" }],
    MONITORED_HEALTH_ENDPOINTS: [],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it("returns configuration_error when key is missing", async () => {
    const provider = new CronJobProvider(baseEnv);
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.error?.code).toBe("configuration_error");
  });

  it("normalizes cron job execution status", async () => {
    const envWithKey: ServerEnv = {
      ...baseEnv,
      CRONJOB_API_KEY: "cron_key_123",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jobData: {
          jobId: 8158370,
          title: "Process News",
          enabled: true,
          lastExecution: {
            status: 0,
            duration: 150,
            date: "2026-07-25T10:00:00Z",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new CronJobProvider(envWithKey);
    const snapshot = await provider.fetchSnapshot();

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.services[0].status).toBe("healthy");
    expect(snapshot.events[0].status).toBe("SUCCESS");

    vi.unstubAllGlobals();
  });
});
