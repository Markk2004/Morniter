import { describe, expect, it } from "vitest";
import { deriveActiveIncidents } from "@/lib/monitor/incidents";

const failedService = {
  source: "vercel" as const,
  service: "frontend",
  status: "failed" as const,
  checkedAt: "2026-07-28T03:00:00Z",
};

describe("deriveActiveIncidents", () => {
  it("uses the deployment incident key from the latest error event", () => {
    const incidents = deriveActiveIncidents([failedService], [
      {
        id: "vercel-dep_1",
        source: "vercel",
        service: "frontend",
        type: "deployment",
        severity: "error",
        status: "ERROR",
        message: "Build failed",
        occurredAt: "2026-07-28T03:00:00Z",
        stage: "build",
        incidentKey: "vercel:frontend:dep_1",
      },
    ]);

    expect(incidents[0]).toMatchObject({
      key: "vercel:frontend:dep_1",
      source: "vercel",
      status: "failed",
      stage: "build",
    });
  });

  it("does not create incidents for healthy services", () => {
    expect(deriveActiveIncidents([{ ...failedService, status: "healthy" }], [])).toEqual([]);
  });
});
