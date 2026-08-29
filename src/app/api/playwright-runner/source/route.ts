import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getPlaywrightCatalog } from "@/lib/playwright-runner/job-store";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const testId = searchParams.get("testId");

  if (!projectId || !testId) {
    return NextResponse.json(
      { error: "Missing projectId or testId query parameter" },
      { status: 400 },
    );
  }

  try {
    const catalog = await getPlaywrightCatalog();
    if (!catalog) {
      return NextResponse.json(
        { error: "Playwright catalog not published yet" },
        { status: 404 },
      );
    }

    const project = catalog.projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json(
        { error: `Project '${projectId}' not found` },
        { status: 404 },
      );
    }

    const allTests = [
      ...(project.tests || []),
      ...(project.testGroups?.flatMap((g) => g.tests) || []),
    ];
    const testItem = allTests.find((t) => t.id === testId);

    if (!testItem) {
      return NextResponse.json(
        { error: `Test '${testId}' not found in project '${projectId}'` },
        { status: 404 },
      );
    }

    const content = project.sourceByPath?.[testItem.relativePath];
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Test source is not available; refresh the Agent catalog" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      projectId,
      testId,
      relativePath: testItem.relativePath,
      content,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load test source";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
