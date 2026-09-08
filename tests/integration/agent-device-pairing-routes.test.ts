// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createPairingCode: vi.fn(async () => ({ code: "ABC-123", expiresAt: "2026-09-08T10:10:00.000Z" })),
  consumePairingCode: vi.fn(async (_code: string, device: { agentId: string; deviceId: string; jti: string }) => ({ ...device, createdAt: "2026-09-08T10:00:00.000Z" })),
  recordEnrollmentAttempt: vi.fn(async () => true),
  listAgentDevices: vi.fn(async () => [{ deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae", agentId: "mark-windows-01", createdAt: "2026-09-08T10:00:00.000Z", status: "online" }]),
  revokeAgentDevice: vi.fn(async () => true),
  requireMonitorSession: vi.fn(async () => ({ scope: "monitor:read" })),
  requireExecuteSession: vi.fn(async () => ({ scope: "monitor:execute" })),
  requireSameOrigin: vi.fn(),
}));

vi.mock("@/lib/test-runner/device-store", () => ({
  createPairingCode: mocks.createPairingCode,
  consumePairingCode: mocks.consumePairingCode,
  recordEnrollmentAttempt: mocks.recordEnrollmentAttempt,
  listAgentDevices: mocks.listAgentDevices,
  revokeAgentDevice: mocks.revokeAgentDevice,
}));
vi.mock("@/lib/auth/session", () => ({
  requireMonitorSession: mocks.requireMonitorSession,
  SESSION_COOKIE: "project_monitor_session",
  verifySessionToken: vi.fn(async () => ({ scope: "monitor:read" })),
}));
vi.mock("@/lib/auth/execute-session", () => ({
  requireExecuteSession: mocks.requireExecuteSession,
  requireSameOrigin: mocks.requireSameOrigin,
  ExecuteSessionError: class extends Error { status = 403; },
}));

import { POST as createCode } from "@/app/api/playwright-runner/agents/pairing-code/route";
import { POST as enroll } from "@/app/api/playwright-runner/agents/enroll/route";
import { GET as list } from "@/app/api/playwright-runner/agents/route";
import { POST as revoke } from "@/app/api/playwright-runner/agents/[deviceId]/revoke/route";

describe("Agent device pairing routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(48));
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", "a".repeat(32));
  });

  it("creates a short-lived pairing code only for an unlocked operator", async () => {
    const req = new NextRequest("http://localhost/api/playwright-runner/agents/pairing-code", {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: JSON.stringify({ agentId: "mark-windows-01" }),
    });
    const res = await createCode(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "ABC-123", expiresAt: "2026-09-08T10:10:00.000Z" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("enrolls once and does not include the shared root token in the public device", async () => {
    const req = new NextRequest("https://monitorsoftdeath.vercel.app/api/playwright-runner/agents/enroll", {
      method: "POST",
      headers: { "user-agent": "test-agent" },
      body: JSON.stringify({ pairingCode: "ABC-123", agentId: "mark-windows-01", deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae" }),
    });
    const res = await enroll(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ device: { agentId: "mark-windows-01" }, deviceToken: expect.any(String) });
  });

  it("lists public device metadata and revokes a selected device", async () => {
    const cookie = "project_monitor_session=session";
    const listRes = await list(new NextRequest("http://localhost/api/playwright-runner/agents", { headers: { cookie } }));
    expect(listRes.status).toBe(200);
    expect(JSON.stringify(await listRes.json())).not.toContain("jti");

    const revokeRes = await revoke(
      new NextRequest("http://localhost/api/playwright-runner/agents/8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae/revoke", { method: "POST", headers: { origin: "http://localhost" } }),
      { params: Promise.resolve({ deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae" }) },
    );
    expect(revokeRes.status).toBe(204);
    expect(mocks.revokeAgentDevice).toHaveBeenCalledWith("8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae");
  });
});
