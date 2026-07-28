import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  requireExecuteSession,
  requireSameOrigin,
  ExecuteSessionError,
} from "@/lib/auth/execute-session";
import { CreateJobSchema } from "@/lib/test-runner/schemas";
import {
  enqueueJob,
  listJobs,
} from "@/lib/test-runner/store";
import { TestRunnerError } from "@/lib/test-runner/errors";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const jobs = await listJobs(20);
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof TestRunnerError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
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

  const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json(
      {
        error: "Missing or invalid Idempotency-Key header (must be 16-128 characters)",
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

  const parseResult = CreateJobSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid payload. Only projectId and presetId allowed.",
        code: "INVALID_PAYLOAD",
        details: parseResult.error.format(),
      },
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

  try {
    const job = await enqueueJob(parseResult.data, ip, idempotencyKey);
    const isReplay = job.idempotencyKey === idempotencyKey && job.status !== "queued";
    return NextResponse.json(job, { status: isReplay ? 200 : 201 });
  } catch (err) {
    if (err instanceof TestRunnerError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          activeJob: "activeJob" in err ? (err as unknown as { activeJob: unknown }).activeJob : undefined,
        },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
