import { describe, expect, it, vi } from "vitest";
import { AivenProvider, normalizeAivenState } from "@/lib/providers/aiven";
import type { ServerEnv } from "@/lib/env/server";

describe("AivenProvider", () => {
  const baseEnv: ServerEnv = {
    GROUP_ACCESS_PASSWORD_HASH: "hash",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    MONITOR_DISPLAY_NAME: "Monitor",
    VERCEL_PROJECT_IDS: [],
    RENDER_SERVICE_IDS: [],
    AIVEN_SERVICE_NAMES: [{ id: "db_main", label: "database" }],
    AIVEN_DATABASE_NAME: "student_tracking",
    CRONJOB_JOB_IDS: [],
    MONITORED_HEALTH_ENDPOINTS: [],
    MONITOR_AGENT_BUFFER_SECONDS: 60,
  };

  it.each([
    ["RUNNING", "healthy", "info"],
    ["REBUILDING", "degraded", "warning"],
    ["REBALANCING", "degraded", "warning"],
    ["POWEROFF", "failed", "error"],
    ["POWERED_OFF", "failed", "error"],
    ["FAILED", "failed", "error"],
    ["MAINTENANCE", "unknown", "warning"],
  ] as const)("maps Aiven state %s", (rawState, status, severity) => {
    expect(normalizeAivenState(rawState)).toEqual({
      status,
      severity,
      normalizedState: rawState.replace(/[^A-Z]/gi, "").toUpperCase(),
    });
  });

  it("returns configuration_error when credentials are missing", async () => {
    const provider = new AivenProvider(baseEnv);
    const snapshot = await provider.fetchSnapshot();
    expect(snapshot.error?.code).toBe("configuration_error");
  });

  it("normalizes Aiven service state and includes database identity", async () => {
    const envWithCreds: ServerEnv = {
      ...baseEnv,
      AIVEN_API_TOKEN: "aiven_tok_123",
      AIVEN_PROJECT_NAME: "my-project",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        service: {
          service_name: "db_main",
          service_type: "pg",
          state: "RUNNING",
          update_time: "2026-07-25T10:00:00Z",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new AivenProvider(envWithCreds);
    const snapshot = await provider.fetchSnapshot();

    expect(snapshot.error).toBeUndefined();
    expect(snapshot.services[0].status).toBe("healthy");
    expect(snapshot.services[0].databaseName).toBe("student_tracking");
    expect(snapshot.events[0].status).toBe("RUNNING");
    expect(snapshot.events[0].databaseName).toBe("student_tracking");
    expect(snapshot.events[0].message).toContain("Database target: student_tracking");

    vi.unstubAllGlobals();
  });

  it("handles POWEROFF state correctly", async () => {
    const envWithCreds: ServerEnv = {
      ...baseEnv,
      AIVEN_API_TOKEN: "aiven_tok_123",
      AIVEN_PROJECT_NAME: "my-project",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        service: {
          service_name: "db_main",
          service_type: "pg",
          state: "POWEROFF",
          update_time: "2026-07-25T10:00:00Z",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new AivenProvider(envWithCreds);
    const snapshot = await provider.fetchSnapshot();

    expect(snapshot.services[0].status).toBe("failed");
    expect(snapshot.events[0].severity).toBe("error");
    expect(snapshot.events[0].status).toBe("POWEROFF");

    vi.unstubAllGlobals();
  });
});
