import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { globalAgentBuffer, type AgentIngestEvent } from "@/lib/monitor/agent-buffer";
import { z } from "zod";

const EventItemSchema = z.object({
  projectId: z.string().optional(),
  service: z.string().optional(),
  level: z.enum(["info", "warn", "warning", "error"]).optional(),
  message: z.string().min(1).max(20000),
  timestamp: z.string().optional(),
});

const BatchSchema = z.array(EventItemSchema).max(100);

export async function POST(req: NextRequest) {
  const env = getServerEnv();

  if (!env.MONITOR_AGENT_INGEST_TOKEN) {
    return NextResponse.json({ error: "Agent ingestion disabled" }, { status: 404 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (token !== env.MONITOR_AGENT_INGEST_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = BatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid agent batch payload" }, { status: 400 });
    }

    // Filter project ID if configured
    let eventsToIngest = parsed.data as AgentIngestEvent[];
    if (env.MONITOR_AGENT_PROJECT_ID) {
      eventsToIngest = eventsToIngest.filter(
        (e) => !e.projectId || e.projectId === env.MONITOR_AGENT_PROJECT_ID,
      );
    }

    globalAgentBuffer.append(eventsToIngest);

    return new NextResponse(null, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bad Request" },
      { status: 400 },
    );
  }
}
