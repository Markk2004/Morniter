import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  DiagnosticLookupError,
  getEventDiagnostics,
} from "@/lib/monitor/event-diagnostics";
import { ProviderError } from "@/lib/providers/request";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    const result = await getEventDiagnostics(eventId, req.signal);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof DiagnosticLookupError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ProviderError) {
      const status =
        error.code === "rate_limited"
          ? 429
          : error.code === "timeout"
            ? 504
            : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Unable to load diagnostics" }, { status: 500 });
  }
}
