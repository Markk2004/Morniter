// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RunProgress } from "@/components/test-runner/RunProgress";
import type { TestJob } from "@/lib/test-runner/types";

afterEach(cleanup);

function job(status: TestJob["status"], failureAnalysis?: TestJob["failureAnalysis"]): TestJob {
  return {
    id: "job-1",
    requesterLabel: "Operator test",
    idempotencyKey: "run-1234567890123456",
    agentId: "agent-1",
    projectId: "demo",
    presetId: "unit",
    presetName: "Unit tests",
    category: "automated",
    srsIds: [],
    risk: "safe",
    databaseTarget: "none",
    status,
    queuedAt: "2026-07-29T10:00:00.000Z",
    exitCode: status === "failed" ? 1 : 0,
    error: status === "failed" ? "Command exited with code 1" : undefined,
    failureAnalysis,
  };
}

describe("RunProgress failure summary", () => {
  it("shows cause, fix location, recommendation, and evidence", () => {
    render(
      <RunProgress
        activeJob={job("failed", {
          category: "connection",
          title: "Redis or network connection failed",
          cause: "The test could not connect to Redis.",
          fixLocation: "Redis environment variables or test setup",
          recommendation: "Check the Redis URL and token, then rerun the test.",
          evidence: ["ECONNREFUSED 127.0.0.1:6379"],
          confidence: "high",
        })}
        onCancelJob={() => undefined}
        isSubmitting={false}
      />,
    );

    expect(screen.getByText("Failure summary")).toBeInTheDocument();
    expect(screen.getByText("The test could not connect to Redis.")).toBeInTheDocument();
    expect(screen.getByText("Redis environment variables or test setup")).toBeInTheDocument();
    expect(screen.getByText("Check the Redis URL and token, then rerun the test.")).toBeInTheDocument();
    expect(screen.getByText("ECONNREFUSED 127.0.0.1:6379")).toBeInTheDocument();
  });

  it("does not show failure summary for passed or running jobs", () => {
    const { rerender } = render(
      <RunProgress
        activeJob={job("passed")}
        onCancelJob={() => undefined}
        isSubmitting={false}
      />,
    );

    expect(screen.queryByText("Failure summary")).not.toBeInTheDocument();

    rerender(
      <RunProgress
        activeJob={job("running")}
        onCancelJob={() => undefined}
        isSubmitting={false}
      />,
    );

    expect(screen.queryByText("Failure summary")).not.toBeInTheDocument();
  });

  it("keeps the existing failure error when analysis is unavailable", () => {
    render(
      <RunProgress
        activeJob={job("failed")}
        onCancelJob={() => undefined}
        isSubmitting={false}
      />,
    );

    expect(screen.getByText(/Failure Error:/i)).toBeInTheDocument();
    expect(screen.queryByText("Failure summary")).not.toBeInTheDocument();
  });
});
