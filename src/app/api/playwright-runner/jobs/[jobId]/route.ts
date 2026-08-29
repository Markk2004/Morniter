import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  getPlaywrightJob,
  readPlaywrightLogPage,
} from "@/lib/playwright-runner/job-store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const afterSeqParam = req.nextUrl.searchParams.get("afterSequence");
  const limitParam = req.nextUrl.searchParams.get("limit");

  const afterSequence = afterSeqParam !== null ? parseInt(afterSeqParam, 10) : -1;
  const limit = limitParam !== null ? parseInt(limitParam, 10) : 200;

  try {
    const job = await getPlaywrightJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found", code: "JOB_NOT_FOUND" }, { status: 404 });
    }

    const logPage = await readPlaywrightLogPage(jobId, afterSequence, limit);

    return NextResponse.json(
      {
        job,
        logs: logPage.lines,
        nextSequence: logPage.nextSequence,
        hasMore: logPage.hasMore,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
