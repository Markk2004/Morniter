import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  requireExecuteSession,
  requireSameOrigin,
  ExecuteSessionError,
} from "@/lib/auth/execute-session";
import { requestCancel, JobNotFoundError } from "@/lib/test-runner/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireSameOrigin(req);
    await requireExecuteSession(req);
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Execution permission denied" }, { status: 403 });
  }

  const { jobId } = await params;

  try {
    const job = await requestCancel(jobId);
    return NextResponse.json(job, { status: 200 });
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to cancel job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
