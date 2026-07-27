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
      source: "aiven",
      service: "database",
      type: "database",
      severity: "info",
      status: "RUNNING",
      message: "Database running",
      occurredAt: "2026-07-25T10:00:00Z",
      databaseName: "student_tracking",
    };

    const service: ServiceStatus = {
      source: "aiven",
      service: "database",
      status: "healthy",
      checkedAt: "2026-07-25T10:00:00Z",
      databaseName: "student_tracking",
    };

    const providerSnapshot: ProviderSnapshot = {
      source: "aiven",
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
    expect(snapshot.providers[0].source).toBe("aiven");
    expect(snapshot.providers[0].services[0].databaseName).toBe("student_tracking");
  });
});
