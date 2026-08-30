import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artifactId } = await params;
  if (!artifactId) {
    return NextResponse.json({ error: "Missing artifactId" }, { status: 400 });
  }

  // Return artifact dummy or streaming response for browser download
  return new NextResponse(`Mock Playwright artifact content for ${artifactId}`, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${artifactId}.txt"`,
    },
  });
}
