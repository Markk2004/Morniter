import { describe, expect, it } from "vitest";
import { parseDiagnosticCommand } from "@/lib/monitor/commands";

describe("parseDiagnosticCommand", () => {
  it("parses valid logs command", () => {
    expect(parseDiagnosticCommand("logs render backend --last 100")).toEqual({
      type: "logs",
      source: "render",
      service: "backend",
      limit: 100,
    });
  });

  it("parses valid errors command", () => {
    expect(parseDiagnosticCommand("errors vercel --last 20")).toEqual({
      type: "errors",
      source: "vercel",
      limit: 20,
    });
  });

  it("parses valid health and cron commands", () => {
    expect(parseDiagnosticCommand("health all")).toEqual({
      type: "health",
      target: "all",
    });
    expect(parseDiagnosticCommand("cron failures")).toEqual({
      type: "cron",
      target: "failures",
    });
  });

  it("rejects shell metacharacters", () => {
    expect(() => parseDiagnosticCommand("logs render; rm -rf /")).toThrow();
    expect(() => parseDiagnosticCommand("errors | grep secret")).toThrow();
    expect(() => parseDiagnosticCommand("health && echo 1")).toThrow();
  });

  it("rejects unknown commands or counts over 500", () => {
    expect(() => parseDiagnosticCommand("npm run build")).toThrow();
    expect(() => parseDiagnosticCommand("logs render backend --last 1000")).toThrow();
  });
});
