// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobHistory } from "@/components/test-runner/JobHistory";
import type { TestJob } from "@/lib/test-runner/types";

const failedJob: TestJob = {
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
  status: "failed",
  queuedAt: "2026-07-29T10:00:00.000Z",
  failureAnalysis: {
    category: "dependency",
    title: "Test dependency is missing",
    cause: "A package could not be loaded.",
    fixLocation: "package.json or dependency installation",
    recommendation: "Install the package and rerun.",
    evidence: ["Cannot find module 'playwright'"],
    confidence: "high",
  },
};

describe("JobHistory failure summary", () => {
  it("keeps the cause title and fix location visible for failed jobs", () => {
    render(<JobHistory history={[failedJob]} />);

    expect(screen.getByText(/Failure summary: Test dependency is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Fix: package.json or dependency installation/i)).toBeInTheDocument();
  });
});
