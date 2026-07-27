import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env/server";

export const SESSION_COOKIE = "project_monitor_session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

export interface SessionPayload {
  iss: string;
  aud: string;
  scope: string;
  iat: number;
  exp: number;
}

export async function createSessionToken(now: Date = new Date()): Promise<string> {
  const env = getServerEnv();
  const secretBytes = new TextEncoder().encode(env.SESSION_SIGNING_SECRET);

  const issueSec = Math.floor(now.getTime() / 1000);
  const expSec = issueSec + SESSION_DURATION_SECONDS;

  return new SignJWT({ scope: "monitor:read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-web")
    .setIssuedAt(issueSec)
    .setExpirationTime(expSec)
    .sign(secretBytes);
}

export async function verifySessionToken(
  token: string,
  now: Date = new Date(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const env = getServerEnv();

  try {
    const secretBytes = new TextEncoder().encode(env.SESSION_SIGNING_SECRET);
    const { payload } = await jwtVerify(token, secretBytes, {
      issuer: "project-monitor",
      audience: "project-monitor-web",
      clockTolerance: 5,
      currentDate: now,
    });

    if (payload.scope !== "monitor:read") {
      return null;
    }

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireMonitorSession(): Promise<SessionPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    throw new Error("UNAUTHORIZED");
  }

  return payload;
}
