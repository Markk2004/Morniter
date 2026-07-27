import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "project_monitor_session",
  verifySessionToken: vi.fn(async (token: string) =>
    token === "valid" ? { scope: "monitor:read" } : null,
  ),
}));

vi.mock("@/lib/monitor/event-diagnostics", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/monitor/event-diagnostics")
  >("@/lib/monitor/event-diagnostics");
  return {
    ...actual,
    getEventDiagnostics: vi.fn(async (eventId: string) => ({
      eventId,
      summary: "Build failed",
      lines: [],
      truncated: false,
    })),
  };
});

import { GET } from "@/app/api/monitor/diagnostics/route";

const request = (url: string, authenticated = true) =>
  new NextRequest(url, {
    headers: authenticated
      ? { cookie: "project_monitor_session=valid" }
      : undefined,
  });

describe("GET /api/monitor/diagnostics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a valid session", async () => {
    const response = await GET(request(
      "http://localhost/api/monitor/diagnostics?eventId=vercel-dep_1",
      false,
    ));
    expect(response.status).toBe(401);
  });

  it("requires eventId", async () => {
    const response = await GET(request(
      "http://localhost/api/monitor/diagnostics",
    ));
    expect(response.status).toBe(400);
  });

  it("returns private diagnostics", async () => {
    const response = await GET(request(
      "http://localhost/api/monitor/diagnostics?eventId=vercel-dep_1",
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      eventId: "vercel-dep_1",
      summary: "Build failed",
    });
  });
});
