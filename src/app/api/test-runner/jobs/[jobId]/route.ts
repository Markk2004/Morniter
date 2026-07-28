import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getJobWithLogs } from "@/lib/test-runner/store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const afterSeqParam = req.nextUrl.searchParams.get("afterSequence");
  const afterSequence = afterSeqParam ? parseInt(afterSeqParam, 10) : -1;

  try {
    const data = await getJobWithLogs(jobId, Number.isNaN(afterSequence) ? -1 : afterSequence);
    if (!data) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
