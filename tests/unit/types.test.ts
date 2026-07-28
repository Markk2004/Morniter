import { describe, expect, it } from "vitest";
import type {
  MonitorDiagnosticsResult,
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
      refreshAfterSeconds: 60,
      partial: false,
      providers: [providerSnapshot],
      events: [event],
    };

    expect(snapshot.refreshAfterSeconds).toBe(60);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.providers[0].source).toBe("aiven");
    expect(snapshot.providers[0].services[0].databaseName).toBe("student_tracking");
  });

  it("supports optional git and deployment target metadata fields on MonitorEvent", () => {
    const deploymentEvent: MonitorEvent = {
      id: "evt-2",
      source: "vercel",
      service: "web-ui",
      type: "deployment",
      severity: "info",
      status: "READY",
      message: "Deployment ready",
      occurredAt: "2026-07-28T09:00:00Z",
      commitSha: "abc123456789",
      commitMessage: "Merge branch 'main' into production",
      branch: "main",
      commitAuthor: "developer",
      deploymentTarget: "production",
    };

    expect(deploymentEvent.commitSha).toBe("abc123456789");
    expect(deploymentEvent.commitMessage).toBe("Merge branch 'main' into production");
    expect(deploymentEvent.branch).toBe("main");
    expect(deploymentEvent.commitAuthor).toBe("developer");
    expect(deploymentEvent.deploymentTarget).toBe("production");
  });

  it("supports MonitorDiagnosticsResult and diagnostic metadata fields", () => {
    const diagnosticsResult: MonitorDiagnosticsResult = {
      eventId: "vercel-dep_123",
      summary: "Build command exited with code 1",
      lines: [
        {
          id: "log-1",
          stage: "build",
          level: "error",
          message: "Build command exited with code 1",
          occurredAt: "2026-07-28T03:00:00Z",
        },
      ],
      truncated: false,
    };

    expect(diagnosticsResult.lines[0].stage).toBe("build");
    expect(diagnosticsResult.summary).toContain("code 1");
  });
});
