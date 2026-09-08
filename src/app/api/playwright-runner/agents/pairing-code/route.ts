import { NextResponse, type NextRequest } from "next/server";
import { requireExecuteSession, ExecuteSessionError, requireSameOrigin } from "@/lib/auth/execute-session";
import { requireMonitorSession } from "@/lib/auth/session";
import { CreatePairingCodeSchema } from "@/lib/test-runner/device-contracts";
import { createPairingCode } from "@/lib/test-runner/device-store";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    await requireMonitorSession();
    await requireExecuteSession(req);
    const body = CreatePairingCodeSchema.parse(await req.json());
    const result = await createPairingCode(body.agentId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message, code: "EXECUTION_REQUIRED" }, { status: err.status });
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (err instanceof SyntaxError || err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid pairing request", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create pairing code", code: "PAIRING_UNAVAILABLE" }, { status: 500 });
  }
}
