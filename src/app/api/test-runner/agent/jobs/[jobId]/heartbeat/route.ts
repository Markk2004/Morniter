import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { AgentHeartbeatSchema } from "@/lib/test-runner/schemas";
import { heartbeatJob } from "@/lib/test-runner/store";
import { TestRunnerError } from "@/lib/test-runner/errors";
import { getServerEnv } from "@/lib/env/server";

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

  const parseResult = AgentHeartbeatSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid heartbeat payload", code: "INVALID_AGENT_PAYLOAD" }, { status: 400 });
  }

  const env = getServerEnv();
  const agentId = env.MONITOR_AGENT_PROJECT_ID || "windows-local-agent-1";

  try {
    const result = await heartbeatJob(
      jobId,
      agentId,
      parseResult.data.progress,
      new Date(parseResult.data.observedAt),
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof TestRunnerError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Heartbeat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
