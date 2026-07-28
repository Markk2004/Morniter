import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getAgentPresence, getCatalog } from "@/lib/test-runner/store";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [catalog, presence] = await Promise.all([getCatalog(), getAgentPresence()]);
    return NextResponse.json(
      {
        catalog,
        online: Boolean(catalog),
        presence,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
