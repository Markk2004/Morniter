import { randomUUID } from "node:crypto";
import { saveDeviceCredential } from "./credential-store";

function endpoint(serverUrl: string, path: string): string {
  const base = new URL(serverUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "localhost")) throw new Error("SERVER_URL_MUST_USE_HTTPS");
  return new URL(path, base).toString();
}

export async function enrollDevice(input: { serverUrl: string; pairingCode: string; agentId: string; deviceId?: string }): Promise<{ deviceId: string; agentId: string }> {
  const deviceId = input.deviceId ?? randomUUID();
  const response = await fetch(endpoint(input.serverUrl, "/api/playwright-runner/agents/enroll"), {
    method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ pairingCode: input.pairingCode, agentId: input.agentId, deviceId }),
  });
  const data = await response.json().catch(() => ({})) as { deviceToken?: string; device?: { deviceId?: string; agentId?: string }; code?: string };
  if (!response.ok || !data.deviceToken || !data.device?.deviceId || !data.device.agentId) throw new Error(data.code || "ENROLLMENT_FAILED");
  await saveDeviceCredential(data.deviceToken);
  return { deviceId: data.device.deviceId, agentId: data.device.agentId };
}
