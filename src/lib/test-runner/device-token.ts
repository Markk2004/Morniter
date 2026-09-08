import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getServerEnv } from "@/lib/env/server";
import { DEVICE_TOKEN_TTL_SECONDS } from "./device-contracts";

export interface DeviceTokenClaims extends JWTPayload {
  scope: "agent:poll";
  agentId: string;
  sub: string;
  jti: string;
}

function secretBytes(): Uint8Array {
  const secret = getServerEnv().TEST_RUNNER_AGENT_TOKEN;
  if (!secret) throw new Error("AGENT_PAIRING_NOT_CONFIGURED");
  return new TextEncoder().encode(secret);
}

export async function createDeviceToken(input: {
  agentId: string;
  deviceId: string;
  jti: string;
}, now: Date = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ scope: "agent:poll", agentId: input.agentId, jti: input.jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("morniter-agent")
    .setAudience("morniter-runner")
    .setSubject(input.deviceId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + DEVICE_TOKEN_TTL_SECONDS)
    .sign(secretBytes());
}

export async function verifyDeviceToken(
  token: string,
  now: Date = new Date(),
): Promise<DeviceTokenClaims | null> {
  try {
    const result = await jwtVerify(token, secretBytes(), {
      issuer: "morniter-agent",
      audience: "morniter-runner",
      currentDate: now,
      clockTolerance: 5,
    });
    const payload = result.payload as Partial<DeviceTokenClaims>;
    if (
      payload.scope !== "agent:poll" ||
      typeof payload.agentId !== "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string"
    ) {
      return null;
    }
    return payload as DeviceTokenClaims;
  } catch {
    return null;
  }
}
