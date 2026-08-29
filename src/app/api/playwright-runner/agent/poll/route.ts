import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { PlaywrightPollRequestSchema } from "@/lib/playwright-runner/schemas";
import {
  claimNextPlaywrightJob,
  publishPlaywrightCatalog,
} from "@/lib/playwright-runner/job-store";

export async function POST(req: NextRequest) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized agent", code: "UNAUTHORIZED_AGENT" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const parseResult = PlaywrightPollRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid poll payload", code: "INVALID_PAYLOAD", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  const { agentId, catalog, capabilities } = parseResult.data;

  try {
    if (catalog) {
      await publishPlaywrightCatalog(catalog, capabilities, agentId);
    }

    const job = await claimNextPlaywrightJob(agentId);
    if (!job) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to poll job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
