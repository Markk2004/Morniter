import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import type { SessionPayload } from "./session";

export const EXECUTE_SESSION_COOKIE = "project_monitor_execute";
export const EXECUTE_SESSION_DURATION_SECONDS = 30 * 60; // 30 minutes

export async function createExecuteSessionToken(now: Date = new Date()): Promise<string> {
  const env = getServerEnv();
  const secretBytes = new TextEncoder().encode(env.SESSION_SIGNING_SECRET);

  const issueSec = Math.floor(now.getTime() / 1000);
  const expSec = issueSec + EXECUTE_SESSION_DURATION_SECONDS;

  return new SignJWT({ scope: "monitor:execute" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-test-runner")
    .setIssuedAt(issueSec)
    .setExpirationTime(expSec)
    .sign(secretBytes);
}

export async function verifyExecuteSessionToken(
  token: string,
  now: Date = new Date(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const env = getServerEnv();

  try {
    const secretBytes = new TextEncoder().encode(env.SESSION_SIGNING_SECRET);
    const { payload } = await jwtVerify(token, secretBytes, {
      issuer: "project-monitor",
      audience: "project-monitor-test-runner",
      clockTolerance: 5,
      currentDate: now,
    });

    if (payload.scope !== "monitor:execute") {
      return null;
    }

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export class ExecuteSessionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ExecuteSessionError";
  }
}

export async function requireExecuteSession(req: NextRequest): Promise<SessionPayload> {
  const token = req.cookies.get(EXECUTE_SESSION_COOKIE)?.value;
  if (!token) {
    throw new ExecuteSessionError(403, "Execution session required");
  }

  const payload = await verifyExecuteSessionToken(token);
  if (!payload) {
    throw new ExecuteSessionError(403, "Execution session expired or invalid");
  }

  return payload;
}

export function requireSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  const targetOrigin = req.nextUrl.origin;

  if (!origin || origin !== targetOrigin) {
    throw new ExecuteSessionError(403, "Cross-origin requests forbidden");
  }
}
