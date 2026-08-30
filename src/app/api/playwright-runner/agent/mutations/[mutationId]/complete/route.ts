import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { completeMutation } from "@/lib/playwright-runner/mutation-store";
import { z } from "zod";

const CompleteMutationSchema = z.object({
  leaseToken: z.string().min(1),
  status: z.enum(["succeeded", "conflict", "rejected", "failed"]),
  newRevision: z.string().optional(),
  writtenFiles: z.array(z.string()).optional(),
  error: z.string().optional(),
}).strict();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ mutationId: string }> },
) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized agent", code: "UNAUTHORIZED_AGENT" }, { status: 401 });
  }

  const { mutationId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const parseResult = CompleteMutationSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid completion payload", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  try {
    const res = await completeMutation(mutationId, parseResult.data.leaseToken, parseResult.data);
    if (!res.accepted) {
      return NextResponse.json(
        { error: "Mutation lease lost or expired", code: res.code || "LEASE_LOST" },
        { status: 409 },
      );
    }
    return NextResponse.json({ mutation: res.mutation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to complete mutation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
