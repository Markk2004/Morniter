import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env/server";

describe("parseServerEnv", () => {
  it("rejects a short session secret", () => {
    expect(() =>
      parseServerEnv({
        GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
        SESSION_SIGNING_SECRET: "short",
      }),
    ).toThrow();
  });

  it("splits comma-separated identifiers into id and label", () => {
    const env = parseServerEnv({
      GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
      SESSION_SIGNING_SECRET: "x".repeat(48),
      RENDER_SERVICE_IDS: "srv_a:backend,srv_b:worker",
    });
    expect(env.RENDER_SERVICE_IDS).toEqual([
      { id: "srv_a", label: "backend" },
      { id: "srv_b", label: "worker" },
    ]);
  });

  it("handles empty or optional provider environment variables gracefully", () => {
    const env = parseServerEnv({
      GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
      SESSION_SIGNING_SECRET: "x".repeat(48),
    });
    expect(env.MONITOR_DISPLAY_NAME).toBe("Project Monitor");
    expect(env.VERCEL_PROJECT_IDS).toEqual([]);
    expect(env.RENDER_SERVICE_IDS).toEqual([]);
    expect(env.AIVEN_SERVICE_NAMES).toEqual([]);
    expect(env.CRONJOB_JOB_IDS).toEqual([]);
    expect(env.MONITORED_HEALTH_ENDPOINTS).toEqual([]);
  });

  it("rejects duplicate IDs within one provider configuration", () => {
    expect(() =>
      parseServerEnv({
        GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
        SESSION_SIGNING_SECRET: "x".repeat(48),
        RENDER_SERVICE_IDS: "srv_a:backend,srv_a:worker",
      }),
    ).toThrow();
  });

  it("rejects empty ID in resource reference pair", () => {
    expect(() =>
      parseServerEnv({
        GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
        SESSION_SIGNING_SECRET: "x".repeat(48),
        RENDER_SERVICE_IDS: ":backend",
      }),
    ).toThrow();
  });
});
