import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { parseDiagnosticCommand, executeDiagnosticQuery } from "@/lib/monitor/commands";
import { z } from "zod";

const CommandBodySchema = z.object({
  command: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CommandBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid command input" }, { status: 400 });
    }

    const query = parseDiagnosticCommand(parsed.data.command);
    const snapshot = await executeDiagnosticQuery(query, req.signal);

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid diagnostic command" },
      { status: 400 },
    );
  }
}
