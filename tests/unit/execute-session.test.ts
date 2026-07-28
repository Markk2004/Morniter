import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createExecuteSessionToken,
  verifyExecuteSessionToken,
  EXECUTE_SESSION_COOKIE,
} from "@/lib/auth/execute-session";
import { resetServerEnvCache } from "@/lib/env/server";

describe("Execute Session Token", () => {
  const secret = "s".repeat(48);

  beforeEach(() => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("exports correct cookie name", () => {
    expect(EXECUTE_SESSION_COOKIE).toBe("project_monitor_execute");
  });

  it("creates and verifies a valid execute token with scope monitor:execute", async () => {
    const token = await createExecuteSessionToken();
    const payload = await verifyExecuteSessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.scope).toBe("monitor:execute");
    expect(payload?.aud).toBe("project-monitor-test-runner");
    expect(payload?.iss).toBe("project-monitor");
  });

  it("rejects expired token after 30 minutes", async () => {
    const now = new Date();
    const token = await createExecuteSessionToken(now);

    const future = new Date(now.getTime() + 31 * 60 * 1000); // 31 minutes later
    const payload = await verifyExecuteSessionToken(token, future);

    expect(payload).toBeNull();
  });
});
