import { NextResponse, type NextRequest } from "next/server";
import { verifyAgentAuth } from "@/lib/test-runner/agent-auth";
import { PollRequestSchema } from "@/lib/test-runner/schemas";
import { publishCatalog, claimNextJob } from "@/lib/test-runner/store";
import type { TestProjectCatalog } from "@/lib/test-runner/types";

export async function POST(req: NextRequest) {
  if (!verifyAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = PollRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid poll payload" }, { status: 400 });
  }

  const { agentId, catalog } = parseResult.data;

  try {
    if (catalog) {
      await publishCatalog(catalog as TestProjectCatalog);
    }

    const job = await claimNextJob(agentId);
    if (!job) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ job }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
