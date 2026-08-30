import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { claimNextMutation } from "@/lib/playwright-runner/mutation-store";
import { z } from "zod";

const PollMutationSchema = z.object({
  agentId: z.string().min(1),
}).strict();

export async function POST(req: NextRequest) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized agent", code: "UNAUTHORIZED_AGENT" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const parseResult = PollMutationSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid poll payload", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  try {
    const mutation = await claimNextMutation(parseResult.data.agentId);
    if (!mutation) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ mutation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to claim mutation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
