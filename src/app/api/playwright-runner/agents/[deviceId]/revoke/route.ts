import { NextResponse, type NextRequest } from "next/server";
import { requireExecuteSession, ExecuteSessionError, requireSameOrigin } from "@/lib/auth/execute-session";
import { requireMonitorSession } from "@/lib/auth/session";
import { DeviceIdSchema } from "@/lib/test-runner/device-contracts";
import { revokeAgentDevice } from "@/lib/test-runner/device-store";

export async function POST(req: NextRequest, context: { params: Promise<{ deviceId: string }> }) {
  try {
    requireSameOrigin(req);
    await requireMonitorSession();
    await requireExecuteSession(req);
    const { deviceId } = await context.params;
    DeviceIdSchema.parse(deviceId);
    const revoked = await revokeAgentDevice(deviceId);
    if (!revoked) return NextResponse.json({ error: "Device not found or already revoked", code: "DEVICE_NOT_FOUND" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof ExecuteSessionError) {
      return NextResponse.json({ error: err.message, code: "EXECUTION_REQUIRED" }, { status: err.status });
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid device id", code: "INVALID_DEVICE_ID" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to revoke device", code: "DEVICE_REVOKE_FAILED" }, { status: 500 });
  }
}
