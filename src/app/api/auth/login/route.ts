import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyGroupPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const LoginSchema = z.object({
  password: z.string().min(1).max(256),
});

// Simple in-memory rate limiter: IP -> { attempts: number, resetAt: number }
const attemptsMap = new Map<string, { attempts: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attemptsMap.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    attemptsMap.delete(ip);
    return false;
  }
  return entry.attempts >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const entry = attemptsMap.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptsMap.set(ip, { attempts: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyGroupPassword(parsed.data.password);
    if (!isValid) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken();
    const res = new NextResponse(null, { status: 204 });

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
