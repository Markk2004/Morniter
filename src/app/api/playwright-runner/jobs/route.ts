import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  requireExecuteSession,
  requireSameOrigin,
  ExecuteSessionError,
} from "@/lib/auth/execute-session";
import { PlaywrightJobRequestSchema } from "@/lib/playwright-runner/schemas";
import {
  enqueuePlaywrightJob,
  listPlaywrightJobs,
} from "@/lib/playwright-runner/job-store";
import {
  PlaywrightActiveJobExistsError,
  PlaywrightQueueFullError,
} from "@/lib/playwright-runner/job-store-logic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const jobs = await listPlaywrightJobs(20);
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    requireSameOrigin(req);
    await requireExecuteSession(req);
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message, code: "EXECUTION_REQUIRED" }, { status: err.status });
    }
    return NextResponse.json({ error: "Execution permission denied", code: "EXECUTION_REQUIRED" }, { status: 403 });
  }

  const idempotencyKey =
    req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key") || undefined;
  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    return NextResponse.json(
      {
        error: "Invalid Idempotency-Key header (must be 8-128 characters)",
        code: "INVALID_IDEMPOTENCY_KEY",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const parseResult = PlaywrightJobRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid Playwright job payload.",
        code: "INVALID_PAYLOAD",
        details: parseResult.error.format(),
      },
      { status: 400 },
    );
  }

  const agentId = parseResult.data.agentId || "windows-local-agent-1";

  try {
    const job = await enqueuePlaywrightJob(parseResult.data, agentId, idempotencyKey);
    const isReplay = idempotencyKey && job.status !== "queued";
    return NextResponse.json(job, { status: isReplay ? 200 : 201 });
  } catch (err) {
    if (err instanceof PlaywrightActiveJobExistsError) {
      return NextResponse.json(
        { error: err.message, code: "ACTIVE_JOB_EXISTS", activeJobId: err.jobId },
        { status: 409 },
      );
    }
    if (err instanceof PlaywrightQueueFullError) {
      return NextResponse.json({ error: err.message, code: "QUEUE_FULL" }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
