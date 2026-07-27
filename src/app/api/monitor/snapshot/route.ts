import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getMonitorSnapshot } from "@/lib/monitor/aggregate";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getMonitorSnapshot({ signal: req.signal });

    // If all providers returned errors, return 503 Service Unavailable
    const totalProviders = snapshot.providers.length;
    const failedProviders = snapshot.providers.filter((p) => p.error !== undefined).length;

    if (totalProviders > 0 && failedProviders === totalProviders) {
      return NextResponse.json(snapshot, {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "application/json",
        },
      });
    }

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
