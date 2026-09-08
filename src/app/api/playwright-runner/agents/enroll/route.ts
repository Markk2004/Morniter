import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { EnrollDeviceSchema } from "@/lib/test-runner/device-contracts";
import { consumePairingCode, recordEnrollmentAttempt } from "@/lib/test-runner/device-store";
import { createDeviceToken } from "@/lib/test-runner/device-token";

export async function POST(req: NextRequest) {
  try {
    const fingerprint =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      req.headers.get("user-agent") ??
      "unknown";
    if (!(await recordEnrollmentAttempt(fingerprint))) {
      return NextResponse.json(
        { error: "Too many enrollment attempts", code: "ENROLLMENT_RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "600" } },
      );
    }
    const body = EnrollDeviceSchema.parse(await req.json());
    const jti = crypto.randomUUID();
    const deviceToken = await createDeviceToken({
      agentId: body.agentId,
      deviceId: body.deviceId,
      jti,
    });
    const device = await consumePairingCode(body.pairingCode, {
      agentId: body.agentId,
      deviceId: body.deviceId,
      jti,
    });
    return NextResponse.json(
      { deviceToken, device: { deviceId: device.deviceId, agentId: device.agentId, createdAt: device.createdAt } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid enrollment request", code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "PAIRING_CODE_INVALID") {
      return NextResponse.json({ error: "Pairing code is invalid or expired", code: "PAIRING_CODE_INVALID" }, { status: 401 });
    }
    return NextResponse.json({ error: "Device enrollment failed", code: "ENROLLMENT_FAILED" }, { status: 500 });
  }
}
