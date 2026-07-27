import { describe, expect, it } from "vitest";
import type { ServiceStatus } from "@/lib/monitor/types";
import { getAivenIncidentTransitions } from "@/lib/monitor/aiven-incidents";

const service = (status: ServiceStatus["status"]): ServiceStatus => ({
  source: "aiven",
  service: "sts-tracking",
  status,
  checkedAt: "2026-07-28T10:00:00Z",
  databaseName: "student_tracking",
});

describe("getAivenIncidentTransitions", () => {
  it("opens one incident when a healthy service becomes unhealthy", () => {
    expect(getAivenIncidentTransitions([service("healthy")], [service("failed")])).toEqual([
      {
        kind: "opened",
        key: "aiven:sts-tracking",
        service: "sts-tracking",
        status: "failed",
        databaseName: "student_tracking",
      },
    ]);
  });

  it("opens an initial incident when the current service is already unhealthy", () => {
    expect(getAivenIncidentTransitions([], [service("failed")])).toEqual([
      {
        kind: "opened",
        key: "aiven:sts-tracking",
        service: "sts-tracking",
        status: "failed",
        databaseName: "student_tracking",
      },
    ]);
  });

  it("does not reopen an incident while the service stays unhealthy", () => {
    expect(getAivenIncidentTransitions([service("failed")], [service("failed")])).toEqual([]);
  });

  it("returns recovery when the service becomes healthy", () => {
    expect(getAivenIncidentTransitions([service("failed")], [service("healthy")])).toEqual([
      {
        kind: "recovered",
        key: "aiven:sts-tracking",
        service: "sts-tracking",
        status: "healthy",
        databaseName: "student_tracking",
      },
    ]);
  });

  it("ignores non-Aiven services", () => {
    const renderService: ServiceStatus = { ...service("failed"), source: "render" };
    expect(getAivenIncidentTransitions([], [renderService])).toEqual([]);
  });
});
