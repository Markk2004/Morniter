import { describe, expect, it } from "vitest";
import { AgentBuffer } from "@/lib/monitor/agent-buffer";

describe("AgentBuffer", () => {
  it("appends and reads agent events with redaction", () => {
    const buffer = new AgentBuffer(60);
    buffer.clear();

    const nowIso = new Date().toISOString();
    buffer.append([
      {
        projectId: "my-app",
        service: "dev-server",
        level: "info",
        message: "Server listening on Authorization: Bearer secret123",
        timestamp: nowIso,
      },
    ]);

    const events = buffer.read("my-app");
    expect(events).toHaveLength(1);
    expect(events[0].message).toContain("Authorization: [REDACTED]");
  });

  it("caps total stored events to 1,000", () => {
    const buffer = new AgentBuffer(60);
    buffer.clear();

    const nowIso = new Date().toISOString();
    const batch = Array.from({ length: 1100 }, (_, i) => ({
      projectId: "my-app",
      service: "dev",
      level: "info" as const,
      message: `log line ${i}`,
      timestamp: nowIso,
    }));

    buffer.append(batch);
    const events = buffer.read("my-app", 2000);
    expect(events.length).toBeLessThanOrEqual(1000);
  });
});
