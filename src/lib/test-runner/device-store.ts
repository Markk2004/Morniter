import "server-only";
import crypto from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import { getRunnerRedis } from "./redis";
import {
  PAIRING_TTL_SECONDS,
  type AgentDevice,
  type AgentDevicePublic,
  type PairingCodeRecord,
} from "./device-contracts";

const DEVICE_INDEX_KEY = "monitor:test-runner:v2:devices";
const PAIRING_PREFIX = "monitor:test-runner:v2:pairing:";
const DEVICE_PREFIX = "monitor:test-runner:v2:device:";
const DEVICE_RETENTION_SECONDS = 31 * 24 * 60 * 60;
const ENROLLMENT_ATTEMPT_TTL_SECONDS = 10 * 60;
const MAX_ENROLLMENT_ATTEMPTS = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function rootSecret(): string {
  const secret = getServerEnv().TEST_RUNNER_AGENT_TOKEN;
  if (!secret) throw new Error("AGENT_PAIRING_NOT_CONFIGURED");
  return secret;
}

function digest(value: string): string {
  return crypto.createHmac("sha256", rootSecret()).update(value).digest("hex");
}

function createCode(): string {
  const bytes = crypto.randomBytes(6);
  const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3).join("")}`;
}

function redisClient() {
  return getRunnerRedis();
}

function pairingKey(code: string): string {
  return `${PAIRING_PREFIX}${digest(code)}`;
}

function deviceKey(deviceId: string): string {
  return `${DEVICE_PREFIX}${deviceId}`;
}

export async function createPairingCode(
  agentId: string,
  now: Date = new Date(),
): Promise<{ code: string; expiresAt: string }> {
  const code = createCode();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_SECONDS * 1000).toISOString();
  const record: PairingCodeRecord = { agentId, createdAt: now.toISOString(), expiresAt };
  await redisClient().set(pairingKey(code), record, { ex: PAIRING_TTL_SECONDS });
  return { code, expiresAt };
}

export async function consumePairingCode(
  code: string,
  device: Pick<AgentDevice, "deviceId" | "agentId" | "jti">,
  now: Date = new Date(),
): Promise<AgentDevice> {
  const rawResult = (await redisClient().eval(
    `local value = redis.call("GET", KEYS[1])
if not value then return "" end
local record = cjson.decode(value)
if record.agentId ~= ARGV[1] then return value end
redis.call("DEL", KEYS[1])
return value`,
    [pairingKey(code)],
    [device.agentId],
  )) as unknown;
  const raw = typeof rawResult === "string"
    ? rawResult
    : Array.isArray(rawResult) && typeof rawResult[0] === "string" ? rawResult[0]
      : rawResult && typeof rawResult === "object" ? JSON.stringify(rawResult)
        : "";

  if (!raw) throw new Error("PAIRING_CODE_INVALID");
  const record = JSON.parse(raw) as PairingCodeRecord;
  if (record.expiresAt <= now.toISOString() || record.agentId !== device.agentId) {
    throw new Error("PAIRING_CODE_INVALID");
  }

  const result: AgentDevice = {
    ...device,
    createdAt: now.toISOString(),
  };
  await redisClient().set(deviceKey(device.deviceId), result, { ex: DEVICE_RETENTION_SECONDS });
  await redisClient().zadd(DEVICE_INDEX_KEY, { score: now.getTime(), member: device.deviceId });
  return result;
}

function publicDevice(device: AgentDevice, now: Date): AgentDevicePublic {
  const age = now.getTime() - new Date(device.lastSeenAt ?? device.createdAt).getTime();
  return {
    deviceId: device.deviceId,
    agentId: device.agentId,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
    status: device.revokedAt ? "revoked" : age > 75_000 ? "offline" : "online",
  };
}

export async function listAgentDevices(now: Date = new Date()): Promise<AgentDevicePublic[]> {
  const ids = await redisClient().zrange<string[]>(DEVICE_INDEX_KEY, 0, -1);
  const devices = await Promise.all(
    ids.map((id) => redisClient().get<AgentDevice>(deviceKey(id))),
  );
  return devices.filter((device): device is AgentDevice => Boolean(device)).map((device) => publicDevice(device, now));
}

export async function revokeAgentDevice(deviceId: string, now: Date = new Date()): Promise<boolean> {
  const key = deviceKey(deviceId);
  const device = await redisClient().get<AgentDevice>(key);
  if (!device || device.revokedAt) return false;
  await redisClient().set(key, { ...device, revokedAt: now.toISOString() }, { ex: DEVICE_RETENTION_SECONDS });
  return true;
}

export async function isDeviceTokenActive(deviceId: string, jti: string): Promise<boolean> {
  const device = await redisClient().get<AgentDevice>(deviceKey(deviceId));
  return Boolean(device && device.jti === jti && !device.revokedAt);
}

export async function recordEnrollmentAttempt(fingerprint: string): Promise<boolean> {
  const key = `${PAIRING_PREFIX}attempt:${digest(fingerprint)}`;
  const result = (await redisClient().eval(
    `local count = redis.call("INCR", KEYS[1])\nif count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end\nreturn count`,
    [key],
    [String(ENROLLMENT_ATTEMPT_TTL_SECONDS)],
  )) as unknown;
  const countValue = Array.isArray(result) ? result[0] : result;
  const count = Number(countValue ?? 0);
  return count > 0 && count <= MAX_ENROLLMENT_ATTEMPTS;
}

export async function touchAgentDevice(deviceId: string, now: Date = new Date()): Promise<void> {
  const key = deviceKey(deviceId);
  const device = await redisClient().get<AgentDevice>(key);
  if (device && !device.revokedAt) {
    await redisClient().set(key, { ...device, lastSeenAt: now.toISOString() }, { ex: DEVICE_RETENTION_SECONDS });
  }
}
