// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { resetServerEnvCache } from "@/lib/env/server";

describe("session tokens", () => {
  const secret = "a".repeat(48);

  it("creates and verifies a valid session token", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$samplehash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const now = new Date("2026-07-25T10:00:00Z");
    const token = await createSessionToken(now);
    expect(token).toBeDefined();

    const payload = await verifySessionToken(token, new Date("2026-07-25T11:00:00Z"));
    expect(payload).not.toBeNull();
    expect(payload?.scope).toBe("monitor:read");

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("rejects an expired session token", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$samplehash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const now = new Date("2026-07-25T00:00:00Z");
    const token = await createSessionToken(now);

    // 9 hours later (session duration is 8 hours)
    const future = new Date("2026-07-25T09:00:00Z");
    expect(await verifySessionToken(token, future)).toBeNull();

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("rejects a token signed with a different secret", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$samplehash");
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    const token = await createSessionToken();

    resetServerEnvCache();
    vi.stubEnv("SESSION_SIGNING_SECRET", "b".repeat(48));
    expect(await verifySessionToken(token)).toBeNull();

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
