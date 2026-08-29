import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  getPlaywrightCatalog,
  getPlaywrightAgentPresence,
  getPlaywrightJob,
} from "@/lib/playwright-runner/job-store";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId") || "windows-local-agent-1";

  try {
    const [catalog, presence] = await Promise.all([
      getPlaywrightCatalog(agentId),
      getPlaywrightAgentPresence(agentId),
    ]);

    const activeJob = presence?.activeJobId
      ? await getPlaywrightJob(presence.activeJobId)
      : null;

    return NextResponse.json(
      { catalog, presence, activeJob },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
