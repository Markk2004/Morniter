import { describe, expect, it } from "vitest";
import { createProviders } from "@/lib/providers/types";
import type { ServerEnv } from "@/lib/env/server";

describe("createProviders", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [],
    RENDER_SERVICE_IDS: [],
    AIVEN_SERVICE_NAMES: [],
    AIVEN_DATABASE_NAME: "student_tracking",
    CRONJOB_JOB_IDS: [],
    MONITORED_HEALTH_ENDPOINTS: [],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it("omits CronJob when it has no configuration", () => {
    expect(createProviders(baseEnv).map((provider) => provider.source)).toEqual([
      "vercel",
      "render",
      "aiven",
      "health",
    ]);
  });

  it("includes CronJob when credentials and jobs are configured", () => {
    const env: ServerEnv = {
      ...baseEnv,
      CRONJOB_API_KEY: "cron-key",
      CRONJOB_JOB_IDS: [{ id: "123", label: "nightly" }],
    };

    expect(createProviders(env).map((provider) => provider.source)).toEqual([
      "vercel",
      "render",
      "aiven",
      "cronjob",
      "health",
    ]);
  });
});
