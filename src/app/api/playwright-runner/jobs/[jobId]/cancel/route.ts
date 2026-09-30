import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  requireExecuteSession,
  requireSameOrigin,
  ExecuteSessionError,
} from "@/lib/auth/execute-session";
import { requestCancelPlaywrightJob } from "@/lib/playwright-runner/job-store";
import { PlaywrightJobNotFoundError } from "@/lib/playwright-runner/job-store-logic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    requireSameOrigin(req);
    // Cancellation is a safety abort mechanism; require valid login and same origin.
    // Try requireExecuteSession defensively, but do not block cancellation if execute session expired.
    try {
      await requireExecuteSession(req);
    } catch {
      // Allow authenticated user with valid SESSION_COOKIE to proceed with cancel
    }
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message, code: "EXECUTION_REQUIRED" }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden origin", code: "FORBIDDEN" }, { status: 403 });
  }

  const { jobId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const force = Boolean(body?.force);

  try {
    const job = await requestCancelPlaywrightJob(jobId, undefined, undefined, force);
    return NextResponse.json({ job });
  } catch (err) {
    if (err instanceof PlaywrightJobNotFoundError) {
      return NextResponse.json({ error: err.message, code: "JOB_NOT_FOUND" }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to cancel job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
