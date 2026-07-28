import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { readLogPage, getJob } from "@/lib/test-runner/store";
import { TestRunnerError } from "@/lib/test-runner/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { jobId } = await params;
  const afterSeqParam = req.nextUrl.searchParams.get("afterSequence");
  const limitParam = req.nextUrl.searchParams.get("limit");

  const afterSequence = afterSeqParam ? parseInt(afterSeqParam, 10) : -1;
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 200;

  try {
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found", code: "JOB_NOT_FOUND" }, { status: 404 });
    }

    const logPage = await readLogPage(
      jobId,
      Number.isNaN(afterSequence) ? -1 : afterSequence,
      Number.isNaN(limit) ? 200 : limit,
    );

    return NextResponse.json(
      {
        job,
        lines: logPage.lines,
        nextSequence: logPage.nextSequence,
        hasMore: logPage.hasMore,
        truncated: logPage.truncated,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof TestRunnerError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to load job details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
