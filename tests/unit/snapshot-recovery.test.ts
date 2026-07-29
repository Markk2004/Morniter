import { describe, expect, it } from "vitest";
import { hasRecoveredToHealthy } from "@/lib/monitor/recovery";
import type { MonitorSnapshot } from "@/lib/monitor/types";

function snapshot(status: "healthy" | "degraded", severity: "info" | "warning"): MonitorSnapshot {
  return {
    generatedAt: "2026-07-29T10:00:00.000Z",
    refreshAfterSeconds: status === "healthy" ? 60 : 20,
    partial: false,
    providers: [
      {
        source: "render",
        fetchedAt: "2026-07-29T10:00:00.000Z",
        stale: false,
        services: [{ source: "render", service: "backend-api", status, checkedAt: "2026-07-29T10:00:00.000Z" }],
        events: [
          {
            id: "render-deploy-1",
            source: "render",
            service: "backend-api",
            type: "deployment",
            severity,
            status: status === "healthy" ? "live" : "building",
            message: "deployment status",
            occurredAt: "2026-07-29T10:00:00.000Z",
          },
        ],
      },
    ],
    events: [
      {
        id: "render-deploy-1",
        source: "render",
        service: "backend-api",
        type: "deployment",
        severity,
        status: status === "healthy" ? "live" : "building",
        message: "deployment status",
        occurredAt: "2026-07-29T10:00:00.000Z",
      },
    ],
  };
}

describe("hasRecoveredToHealthy", () => {
  it("detects degraded service becoming healthy", () => {
    expect(hasRecoveredToHealthy(snapshot("degraded", "warning"), snapshot("healthy", "info"))).toBe(true);
  });

  it("detects a warning event becoming informational", () => {
    const previous = snapshot("healthy", "warning");
    const next = snapshot("healthy", "info");
    expect(hasRecoveredToHealthy(previous, next)).toBe(true);
  });

  it("does not trigger for an unchanged healthy snapshot or initial load", () => {
    expect(hasRecoveredToHealthy(null, snapshot("healthy", "info"))).toBe(false);
    expect(hasRecoveredToHealthy(snapshot("healthy", "info"), snapshot("healthy", "info"))).toBe(false);
  });
});
