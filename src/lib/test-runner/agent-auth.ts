import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { isDeviceTokenActive, touchAgentDevice } from "./device-store";
import { verifyDeviceToken } from "./device-token";

export interface AgentAuthResult {
  mode: "shared" | "device";
  agentId?: string;
  deviceId?: string;
}

export function agentIdentityMatches(auth: AgentAuthResult, agentId: string): boolean {
  return auth.mode === "shared" || auth.agentId === agentId;
}

export async function verifyAgentAuth(req: NextRequest): Promise<AgentAuthResult | null> {
  const env = getServerEnv();
  const configuredToken = env.TEST_RUNNER_AGENT_TOKEN;

  if (!configuredToken) {
    return null;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(configuredToken);

  if (tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return { mode: "shared" };
  }

  const claims = await verifyDeviceToken(token);
  if (!claims || claims.sub !== req.headers.get("x-device-id")) {
    return null;
  }
  if (!(await isDeviceTokenActive(claims.sub, claims.jti))) {
    return null;
  }
  const requestAgentId = req.headers.get("x-agent-id");
  if (!requestAgentId || requestAgentId !== claims.agentId) {
    return null;
  }
  await touchAgentDevice(claims.sub);
  return { mode: "device", agentId: claims.agentId, deviceId: claims.sub };
}
