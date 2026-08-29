import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { PlaywrightCompleteJobSchema } from "@/lib/playwright-runner/schemas";
import { completePlaywrightJob } from "@/lib/playwright-runner/job-store";
import {
  PlaywrightJobNotFoundError,
  PlaywrightInvalidTransitionError,
} from "@/lib/playwright-runner/job-store-logic";

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

  const parseResult = PlaywrightCompleteJobSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid completion payload", code: "INVALID_PAYLOAD", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  try {
    const job = await completePlaywrightJob(jobId, parseResult.data);
    return NextResponse.json({ job });
  } catch (err) {
    if (err instanceof PlaywrightJobNotFoundError) {
      return NextResponse.json({ error: err.message, code: "JOB_NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof PlaywrightInvalidTransitionError) {
      return NextResponse.json({ error: err.message, code: "INVALID_TRANSITION" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to complete job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
