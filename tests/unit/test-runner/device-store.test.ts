// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
const sorted = new Map<string, string[]>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    set: vi.fn(async (key: string, value: unknown) => { values.set(key, value); return "OK"; }),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    zadd: vi.fn(async (key: string, input: { member: string }) => { sorted.set(key, [...(sorted.get(key) ?? []), input.member]); return 1; }),
    zrange: vi.fn(async (key: string) => sorted.get(key) ?? []),
    eval: vi.fn(async (script: string, keys: string[], args: string[] = []) => {
      if (script.includes("INCR")) {
        const count = Number(values.get(keys[0]) ?? 0) + 1;
        values.set(keys[0], count);
        return count;
      }
      const value = values.get(keys[0]);
      if (script.includes("ARGV[1]") && value && JSON.parse(JSON.stringify(value)).agentId !== args[0]) {
        return value;
      }
      values.delete(keys[0]);
      return value ?? "";
    }),
  }),
}));

import { consumePairingCode, createPairingCode, isDeviceTokenActive, listAgentDevices, recordEnrollmentAttempt, revokeAgentDevice } from "@/lib/test-runner/device-store";

describe("agent device store", () => {
  beforeEach(() => {
    values.clear();
    sorted.clear();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(48));
    vi.stubEnv("TEST_RUNNER_AGENT_TOKEN", "a".repeat(32));
  });

  it("creates and consumes a pairing code only once", async () => {
    const now = new Date("2026-09-08T10:00:00.000Z");
    const created = await createPairingCode("mark-windows-01", now);
    expect(created.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);

    const device = { deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae", agentId: "mark-windows-01", jti: "jti-1" };
    await expect(consumePairingCode(created.code, device, now)).resolves.toMatchObject(device);
    await expect(consumePairingCode(created.code, device, now)).rejects.toThrow("PAIRING_CODE_INVALID");
  });

  it("does not burn a pairing code when the agent id does not match", async () => {
    const created = await createPairingCode("mark-windows-01");
    const deviceId = "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae";

    await expect(
      consumePairingCode(created.code, { deviceId, agentId: "other-agent", jti: "jti-1" }),
    ).rejects.toThrow("PAIRING_CODE_INVALID");
    await expect(
      consumePairingCode(created.code, { deviceId, agentId: "mark-windows-01", jti: "jti-2" }),
    ).resolves.toMatchObject({ deviceId, agentId: "mark-windows-01" });
  });

  it("lists and revokes a device without exposing its jti", async () => {
    const created = await createPairingCode("mark-windows-01");
    const device = { deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae", agentId: "mark-windows-01", jti: "private-jti" };
    await consumePairingCode(created.code, device);
    expect(await listAgentDevices()).toHaveLength(1);
    expect(JSON.stringify(await listAgentDevices())).not.toContain("private-jti");
    await revokeAgentDevice(device.deviceId);
    expect(await isDeviceTokenActive(device.deviceId, device.jti)).toBe(false);
  });

  it("limits enrollment attempts per fingerprint", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(recordEnrollmentAttempt("test-device")).resolves.toBe(true);
    }
    await expect(recordEnrollmentAttempt("test-device")).resolves.toBe(false);
  });
});
