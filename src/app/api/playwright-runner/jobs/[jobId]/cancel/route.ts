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
    await requireExecuteSession(req);
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message, code: "EXECUTION_REQUIRED" }, { status: err.status });
    }
    return NextResponse.json({ error: "Execution permission denied", code: "EXECUTION_REQUIRED" }, { status: 403 });
  }

  const { jobId } = await context.params;

  try {
    const job = await requestCancelPlaywrightJob(jobId);
    return NextResponse.json({ job });
  } catch (err) {
    if (err instanceof PlaywrightJobNotFoundError) {
      return NextResponse.json({ error: err.message, code: "JOB_NOT_FOUND" }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to cancel job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
