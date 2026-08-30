import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getMutation } from "@/lib/playwright-runner/mutation-store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ mutationId: string }> },
) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken || !(await verifySessionToken(sessionToken))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { mutationId } = await context.params;
  const mutation = await getMutation(mutationId);

  if (!mutation) {
    return NextResponse.json({ error: `Mutation '${mutationId}' not found` }, { status: 404 });
  }

  return NextResponse.json({ mutation });
}
