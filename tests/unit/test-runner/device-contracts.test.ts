import { describe, expect, it } from "vitest";
import {
  CreatePairingCodeSchema,
  EnrollDeviceSchema,
  PAIRING_TTL_SECONDS,
} from "@/lib/test-runner/device-contracts";

describe("agent device contracts", () => {
  it("accepts a valid pairing enrollment", () => {
    const result = EnrollDeviceSchema.parse({
      pairingCode: "ABC-123",
      agentId: "mark-windows-01",
      deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae",
    });

    expect(result.agentId).toBe("mark-windows-01");
    expect(PAIRING_TTL_SECONDS).toBe(600);
  });

  it("rejects malformed ids and extra payload fields", () => {
    expect(() =>
      EnrollDeviceSchema.parse({
        pairingCode: "abc",
        agentId: "bad id",
        deviceId: "C:\\secret",
        token: "secret",
      }),
    ).toThrow();
    expect(() => CreatePairingCodeSchema.parse({ agentId: "bad/id" })).toThrow();
  });
});
