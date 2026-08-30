import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { EXECUTE_SESSION_COOKIE, verifyExecuteSessionToken } from "@/lib/auth/execute-session";
import { enqueueMutation } from "@/lib/playwright-runner/mutation-store";
import { getPlaywrightJob } from "@/lib/playwright-runner/job-store";
import { RecipeDraftSchema } from "@/lib/playwright-runner/recipe-schema";
import { z } from "zod";

const CreateMutationBodySchema = z.object({
  projectId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  baseRevision: z.string().min(1),
  recipe: RecipeDraftSchema,
  verifiedJobId: z.string().min(1),
  renderedCodeHash: z.string().regex(/^[a-f0-9]{64}$/, "Must be a 64-character SHA-256 hex string"),
}).strict();

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken || !(await verifySessionToken(sessionToken))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const executeToken = req.cookies.get(EXECUTE_SESSION_COOKIE)?.value;
  if (!executeToken || !(await verifyExecuteSessionToken(executeToken))) {
    return NextResponse.json({ error: "Execution locked", code: "EXECUTION_LOCKED" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const parseResult = CreateMutationBodySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid mutation payload", code: "INVALID_PAYLOAD", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  const { verifiedJobId, renderedCodeHash, projectId } = parseResult.data;

  // Enforce passing verified draft check
  const verifiedJob = await getPlaywrightJob(verifiedJobId);
  if (!verifiedJob) {
    return NextResponse.json(
      { error: `Verified job '${verifiedJobId}' not found`, code: "JOB_NOT_FOUND" },
      { status: 400 },
    );
  }

  if (verifiedJob.status !== "passed") {
    return NextResponse.json(
      { error: `Recipe draft has not passed verification (current status: ${verifiedJob.status})`, code: "DRAFT_NOT_PASSED" },
      { status: 400 },
    );
  }

  if (verifiedJob.source !== "workspace" || !verifiedJob.code) {
    return NextResponse.json(
      { error: "Verified job must be a passing workspace draft execution", code: "INVALID_VERIFIED_JOB" },
      { status: 400 },
    );
  }

  if (verifiedJob.projectId !== projectId) {
    return NextResponse.json(
      { error: "Verified job project does not match mutation project", code: "PROJECT_MISMATCH" },
      { status: 400 },
    );
  }

  const actualJobCodeHash = crypto.createHash("sha256").update(verifiedJob.code).digest("hex");
  if (actualJobCodeHash !== renderedCodeHash) {
    return NextResponse.json(
      { error: "Rendered code hash does not match verified execution code", code: "CODE_HASH_MISMATCH" },
      { status: 400 },
    );
  }

  try {
    const mutation = await enqueueMutation(parseResult.data, parseResult.data.agentId);
    return NextResponse.json({ mutation }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to enqueue mutation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
