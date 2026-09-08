import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { listAgentDevices } from "@/lib/test-runner/device-store";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const devices = await listAgentDevices();
    return NextResponse.json({ devices }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch Agent devices", code: "DEVICE_LIST_FAILED" }, { status: 500 });
  }
}
