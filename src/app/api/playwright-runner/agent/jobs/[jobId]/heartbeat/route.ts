import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { PlaywrightHeartbeatSchema } from "@/lib/playwright-runner/schemas";
import { heartbeatPlaywrightJob } from "@/lib/playwright-runner/job-store";
import {
  PlaywrightJobNotFoundError,
  PlaywrightAgentOwnershipError,
} from "@/lib/playwright-runner/job-store-logic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized agent", code: "UNAUTHORIZED_AGENT" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const agentId = req.headers.get("x-agent-id") || "windows-local-agent-1";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const parseResult = PlaywrightHeartbeatSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid heartbeat payload", code: "INVALID_PAYLOAD", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  try {
    const result = await heartbeatPlaywrightJob(
      jobId,
      agentId,
      parseResult.data.browserResults,
      new Date(parseResult.data.observedAt),
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlaywrightJobNotFoundError) {
      return NextResponse.json({ error: err.message, code: "JOB_NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof PlaywrightAgentOwnershipError) {
      return NextResponse.json({ error: err.message, code: "AGENT_OWNERSHIP_ERROR" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to record heartbeat";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
