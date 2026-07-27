import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false });
  }

  const expiresAt = new Date(payload.exp * 1000).toISOString();
  return NextResponse.json({ authenticated: true, expiresAt });
}
