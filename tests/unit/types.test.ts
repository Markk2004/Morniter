import { describe, expect, it } from "vitest";
import type {
  MonitorEvent,
  MonitorSnapshot,
  ProviderSnapshot,
  ServiceStatus,
} from "@/lib/monitor/types";

describe("Domain types contracts", () => {
  it("allows construction of valid MonitorEvent and MonitorSnapshot", () => {
    const event: MonitorEvent = {
      id: "evt-1",
      source: "vercel",
      service: "frontend",
      type: "deployment",
      severity: "info",
      status: "BUILDING",
      message: "Build started",
      occurredAt: "2026-07-25T10:00:00Z",
    };

    const service: ServiceStatus = {
      source: "vercel",
      service: "frontend",
      status: "healthy",
      checkedAt: "2026-07-25T10:00:00Z",
    };

    const providerSnapshot: ProviderSnapshot = {
      source: "vercel",
      fetchedAt: "2026-07-25T10:00:00Z",
      stale: false,
      services: [service],
      events: [event],
    };

    const snapshot: MonitorSnapshot = {
      generatedAt: "2026-07-25T10:00:00Z",
      refreshAfterSeconds: 15,
      partial: false,
      providers: [providerSnapshot],
      events: [event],
    };

    expect(snapshot.refreshAfterSeconds).toBe(15);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.providers[0].source).toBe("vercel");
  });
});
