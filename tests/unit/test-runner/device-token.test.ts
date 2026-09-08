// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/test-runner/device-store", () => ({
  isDeviceTokenActive: vi.fn(async () => true),
  touchAgentDevice: vi.fn(async () => undefined),
}));

import { createDeviceToken, verifyDeviceToken } from "@/lib/test-runner/device-token";

describe("device token", () => {
  beforeEach(() => {
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(48));
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", "a".repeat(32));
  });

  it("issues a scoped device token with bounded expiry", async () => {
    const now = new Date("2026-09-08T10:00:00.000Z");
    const token = await createDeviceToken({ agentId: "mark-windows-01", deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae", jti: "jti-1" }, now);
    const claims = await verifyDeviceToken(token, now);
    expect(claims).toMatchObject({ scope: "agent:poll", agentId: "mark-windows-01", sub: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae", jti: "jti-1" });
    expect(claims?.exp).toBe(Math.floor(now.getTime() / 1000) + 30 * 24 * 60 * 60);
  });

  it("rejects an expired token", async () => {
    const issued = new Date("2026-08-01T10:00:00.000Z");
    const token = await createDeviceToken({ agentId: "mark-windows-01", deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae", jti: "jti-1" }, issued);
    await expect(verifyDeviceToken(token, new Date("2026-09-08T10:00:00.000Z"))).resolves.toBeNull();
  });
});
