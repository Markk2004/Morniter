import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { AppendLogBatchSchema } from "@/lib/test-runner/schemas";
import { appendLogBatch } from "@/lib/test-runner/store";
import { TestRunnerError } from "@/lib/test-runner/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { jobId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_AGENT_PAYLOAD" }, { status: 400 });
  }

  const parseResult = AppendLogBatchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid log batch payload", code: "INVALID_AGENT_PAYLOAD" }, { status: 400 });
  }

  try {
    const result = await appendLogBatch(
      jobId,
      parseResult.data.sequenceStart,
      parseResult.data.entries,
      parseResult.data.progress,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof TestRunnerError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to append log batch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
