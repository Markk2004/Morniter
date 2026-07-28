import { describe, expect, it, vi, beforeEach } from "vitest";
import { getEventDiagnostics, clearDiagnosticCache } from "@/lib/monitor/event-diagnostics";

describe("getEventDiagnostics", () => {
  beforeEach(() => {
    clearDiagnosticCache();
  });

  it("rejects an unknown event id", async () => {
    await expect(
      getEventDiagnostics("missing", undefined, {
        snapshot: {
          generatedAt: "2026-07-28T03:00:00Z",
          refreshAfterSeconds: 60,
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
        refreshAfterSeconds: 60,
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

  it("caches diagnostic results for 60 seconds and deduplicates concurrent in-flight requests", async () => {
    const fetchDiagnostics = vi.fn().mockResolvedValue({
      eventId: "vercel-dep_1",
      summary: "Deployment log cached",
      lines: [],
      truncated: false,
    });
    const event = {
      id: "vercel-dep_1",
      source: "vercel" as const,
      service: "frontend",
      type: "deployment" as const,
      severity: "info" as const,
      status: "READY",
      message: "Deployment ready",
      occurredAt: "2026-07-28T03:00:00Z",
      diagnosticAvailable: true,
    };

    const overrides = {
      snapshot: {
        generatedAt: "2026-07-28T03:00:00Z",
        refreshAfterSeconds: 60,
        partial: false,
        providers: [],
        events: [event],
      },
      providers: [
        {
          source: "vercel" as const,
          fetchSnapshot: vi.fn(),
          fetchDiagnostics,
        },
      ],
    };

    const first = await getEventDiagnostics("vercel-dep_1", undefined, overrides);
    const second = await getEventDiagnostics("vercel-dep_1", undefined, overrides);

    expect(fetchDiagnostics).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
