import { NextResponse, type NextRequest } from "next/server";
import {
  EXECUTE_SESSION_COOKIE,
  requireSameOrigin,
  ExecuteSessionError,
  verifyExecuteSessionToken,
} from "@/lib/auth/execute-session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(EXECUTE_SESSION_COOKIE)?.value ?? "";
  const session = await verifyExecuteSessionToken(token);
  const res = NextResponse.json({ unlocked: Boolean(session) });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
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
