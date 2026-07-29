// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonitorLogsPage } from "@/components/monitor/MonitorLogsPage";
import type { MonitorSnapshot } from "@/lib/monitor/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function makeSnapshot(status: "degraded" | "healthy", severity: "warning" | "info"): MonitorSnapshot {
  return {
    generatedAt: status === "degraded" ? "2026-07-29T10:00:00.000Z" : "2026-07-29T10:00:20.000Z",
    refreshAfterSeconds: status === "degraded" ? 20 : 60,
    partial: false,
    providers: [
      {
        source: "render",
        fetchedAt: "2026-07-29T10:00:00.000Z",
        stale: false,
        services: [
          {
            source: "render",
            service: "backend-api",
            status,
            checkedAt: "2026-07-29T10:00:00.000Z",
          },
        ],
        events: [],
      },
    ],
    events: [
      {
        id: "render-deploy-1",
        source: "render",
        service: "backend-api",
        type: "deployment",
        severity,
        status: status === "degraded" ? "building" : "live",
        message: status === "degraded" ? "Deploy is building" : "Deploy is live",
        occurredAt: "2026-07-29T10:00:00.000Z",
      },
    ],
  };
}

describe("MonitorLogsPage recovery refresh", () => {
  it("forces a fresh snapshot when warning changes to healthy", async () => {
    vi.useFakeTimers();
    const warningSnapshot = makeSnapshot("degraded", "warning");
    const healthySnapshot = makeSnapshot("healthy", "info");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/monitor/redis-status")) {
        return new Response(JSON.stringify({
          status: "HEALTHY",
          checkedAt: "2026-07-29T10:00:00.000Z",
          latencyMs: 10,
          metrics: { totalCommandsProcessed: 10, usedMemoryBytes: 100, totalKeys: 1, uptimeSeconds: null },
          appCommands: { total: 1, byCommand: {}, windowStartedAt: "2026-07-29T10:00:00.000Z", windowDurationSeconds: 60 },
        }), { status: 200 });
      }
      if (url.includes("force=1")) {
        return new Response(JSON.stringify(healthySnapshot), { status: 200 });
      }
      return new Response(JSON.stringify(healthySnapshot), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MonitorLogsPage initialSnapshot={warningSnapshot} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitor/snapshot?force=1",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/monitor/redis-status",
      expect.anything(),
    );
  });
});
