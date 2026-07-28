import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";

export function verifyAgentAuth(req: NextRequest): boolean {
  const env = getServerEnv();
  const configuredToken = env.TEST_RUNNER_AGENT_TOKEN;

  if (!configuredToken) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(configuredToken);

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}
