import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { CompleteJobSchema } from "@/lib/test-runner/schemas";
import { completeJob, JobNotFoundError } from "@/lib/test-runner/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = CompleteJobSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid complete job payload" }, { status: 400 });
  }

  try {
    const job = await completeJob(jobId, parseResult.data);
    return NextResponse.json(job, { status: 200 });
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to complete job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
