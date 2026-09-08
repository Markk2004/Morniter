// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { active, touch } = vi.hoisted(() => ({
  active: vi.fn(async () => true),
  touch: vi.fn(async () => undefined),
}));
vi.mock("@/lib/test-runner/device-store", () => ({
  isDeviceTokenActive: active,
  touchAgentDevice: touch,
}));

import { createDeviceToken } from "@/lib/test-runner/device-token";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";

describe("agent authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(48));
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", "a".repeat(32));
  });

  it("preserves shared-token developer authentication", async () => {
    const req = new NextRequest("http://localhost/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: { authorization: `Bearer ${"a".repeat(32)}` },
    });
    await expect(verifyAgentAuth(req)).resolves.toEqual({ mode: "shared" });
  });

  it("accepts an active device token only with matching headers", async () => {
    const deviceId = "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae";
    const token = await createDeviceToken({ agentId: "mark-windows-01", deviceId, jti: "jti-1" });
    const req = new NextRequest("http://localhost/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "x-agent-id": "mark-windows-01", "x-device-id": deviceId },
    });
    await expect(verifyAgentAuth(req)).resolves.toMatchObject({ mode: "device", agentId: "mark-windows-01", deviceId });
    expect(touch).toHaveBeenCalledWith(deviceId);
  });

  it("rejects a device token with an impersonated agent id", async () => {
    const deviceId = "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae";
    const token = await createDeviceToken({ agentId: "mark-windows-01", deviceId, jti: "jti-1" });
    const req = new NextRequest("http://localhost/api/playwright-runner/agent/poll", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "x-agent-id": "other-agent", "x-device-id": deviceId },
    });
    await expect(verifyAgentAuth(req)).resolves.toBeNull();
  });
});
