import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getServerEnv } from "@/lib/env/server";
import {
  createExecuteSessionToken,
  EXECUTE_SESSION_COOKIE,
  EXECUTE_SESSION_DURATION_SECONDS,
  requireSameOrigin,
  ExecuteSessionError,
} from "@/lib/auth/execute-session";
import { consumeExecuteLoginAttempt } from "@/lib/test-runner/rate-limit";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
  }

  // Monitor read session must be valid
  const monitorToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!monitorToken || !(await verifySessionToken(monitorToken))) {
    return NextResponse.json({ error: "Monitor session required" }, { status: 401 });
  }

  const env = getServerEnv();
  if (!env.GROUP_ACCESS_PASSWORD_HASH) {
    return NextResponse.json(
      { error: "Group password not configured" },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
  const rateLimit = await consumeExecuteLoginAttempt(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many failed execution login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = body.password || "";
  const isValid = await bcrypt.compare(password, env.GROUP_ACCESS_PASSWORD_HASH);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid group password" }, { status: 401 });
  }

  const token = await createExecuteSessionToken();
  const res = new NextResponse(null, { status: 204 });

  res.cookies.set({
    name: EXECUTE_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: EXECUTE_SESSION_DURATION_SECONDS,
  });

  return res;
}

export async function DELETE(req: NextRequest) {
  try {
    requireSameOrigin(req);
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set({
    name: EXECUTE_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
