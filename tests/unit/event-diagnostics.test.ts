import { describe, expect, it, vi } from "vitest";
import { getEventDiagnostics } from "@/lib/monitor/event-diagnostics";

describe("getEventDiagnostics", () => {
  it("rejects an unknown event id", async () => {
    await expect(
      getEventDiagnostics("missing", undefined, {
        snapshot: {
          generatedAt: "2026-07-28T03:00:00Z",
          refreshAfterSeconds: 15,
          partial: false,
          providers: [],
          events: [],
        },
        providers: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("calls the provider diagnostics method for the matched event", async () => {
    const fetchDiagnostics = vi.fn().mockResolvedValue({
      eventId: "vercel-dep_1",
      summary: "Build failed",
      lines: [],
      truncated: false,
    });
    const event = {
      id: "vercel-dep_1",
      source: "vercel" as const,
      service: "frontend",
      type: "deployment" as const,
      severity: "error" as const,
      status: "ERROR",
      message: "failed",
      occurredAt: "2026-07-28T03:00:00Z",
      diagnosticAvailable: true,
    };

    const result = await getEventDiagnostics("vercel-dep_1", undefined, {
      snapshot: {
        generatedAt: "2026-07-28T03:00:00Z",
        refreshAfterSeconds: 15,
        partial: false,
        providers: [],
        events: [event],
      },
      providers: [
        {
          source: "vercel",
          fetchSnapshot: vi.fn(),
          fetchDiagnostics,
        },
      ],
    });

    expect(result.summary).toBe("Build failed");
    expect(fetchDiagnostics).toHaveBeenCalledWith(event, undefined);
  });
});
