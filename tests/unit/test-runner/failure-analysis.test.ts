import { describe, expect, it } from "vitest";
import { analyzeTestFailure } from "@/lib/test-runner/failure-analysis";
import type { TestLogLine } from "@/lib/test-runner/types";

function line(message: string, stream: TestLogLine["stream"] = "stderr", sequence = 1): TestLogLine {
  return {
    sequence,
    stream,
    message,
    timestamp: "2026-07-29T10:00:00.000Z",
  };
}

describe("analyzeTestFailure", () => {
  it("prioritizes a timed out status", () => {
    const result = analyzeTestFailure({
      status: "timed_out",
      exitCode: null,
      error: "Execution timed out after 30 seconds",
      lines: [line("Expected 200 received 500")],
    });

    expect(result.category).toBe("timeout");
    expect(result.title).toMatch(/timed out|timeout/i);
    expect(result.confidence).toBe("high");
  });

  it("identifies an agent lease failure", () => {
    const result = analyzeTestFailure({
      status: "agent_lost",
      exitCode: null,
      error: "Agent heartbeat lost (lease expired)",
      lines: [],
    });

    expect(result.category).toBe("agent");
    expect(result.fixLocation).toMatch(/agent/i);
  });

  it.each([
    ["Cannot find module 'playwright'", "dependency"],
    ["UPSTASH_REDIS_REST_URL is not defined", "environment"],
    ["Redis connection error: ECONNREFUSED", "connection"],
    ["EACCES: permission denied, open config.json", "permission"],
    ["expect(received).toBe(expected)", "assertion"],
    ["SyntaxError: Unexpected token '<'", "syntax"],
  ])("classifies %s as %s", (message, category) => {
    const result = analyzeTestFailure({
      status: "failed",
      exitCode: 1,
      lines: [line(message)],
    });

    expect(result.category).toBe(category);
    expect(result.evidence[0]).toContain(message);
  });

  it("limits evidence and uses the exit code when no error text exists", () => {
    const result = analyzeTestFailure({
      status: "failed",
      exitCode: 1,
      lines: [line("line one", "stdout", 1), line("line two", "stdout", 2), line("line three", "stderr", 3), line("line four", "stderr", 4)],
    });

    expect(result.category).toBe("unknown");
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.join(" ")).toContain("code 1");
  });

  it("falls back to an actionable unknown summary", () => {
    const result = analyzeTestFailure({
      status: "failed",
      exitCode: 2,
      error: "Command ended unexpectedly",
      lines: [line("runner stopped")],
    });

    expect(result.category).toBe("unknown");
    expect(result.cause).toMatch(/recognized|specific/i);
    expect(result.recommendation).toMatch(/log|stderr/i);
  });
});
