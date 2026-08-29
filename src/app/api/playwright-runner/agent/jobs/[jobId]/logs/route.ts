import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { AppendPlaywrightLogBatchSchema } from "@/lib/playwright-runner/schemas";
import { appendPlaywrightLogBatch } from "@/lib/playwright-runner/job-store";
import { PlaywrightJobNotFoundError } from "@/lib/playwright-runner/job-store-logic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized agent", code: "UNAUTHORIZED_AGENT" }, { status: 401 });
  }

  const { jobId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const parseResult = AppendPlaywrightLogBatchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid log batch payload", code: "INVALID_PAYLOAD", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  const { sequenceStart, entries, browserResults } = parseResult.data;

  try {
    const result = await appendPlaywrightLogBatch(jobId, sequenceStart, entries, browserResults);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlaywrightJobNotFoundError) {
      return NextResponse.json({ error: err.message, code: "JOB_NOT_FOUND" }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to append logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
