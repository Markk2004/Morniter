// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { JobHistory } from "@/components/test-runner/JobHistory";
import type { TestJob } from "@/lib/test-runner/types";

afterEach(() => {
  cleanup();
});

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

  it("renders test cases with pass/fail badges and triggers onLoadWorkspaceCode", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onLoadCode = vi.fn();

    const jobWithCases = {
      id: "job-sts-1",
      projectId: "projectSts",
      source: "workspace",
      code: "console.log('workspace code');",
      status: "failed",
      browsers: ["chromium"],
      testExecutionSummary: {
        uatId: "FN-STS-01",
        uatTitle: "FN-STS-01 (Part 1) · เข้าสู่ระบบสำเร็จตามสิทธิ์",
        total: 2,
        passed: 1,
        failed: 1,
        duration: "12.5s",
        cases: [
          {
            id: "TC-STS-AUTH-TEACHER",
            title: "Login as teacher succeeds",
            status: "passed" as const,
            duration: "5.2s",
          },
          {
            id: "TC-STS-AUTH-DIRECTOR",
            title: "Login as director succeeds",
            status: "failed" as const,
            duration: "7.3s",
            error: "Error: expect(page).toHaveURL failed",
          },
        ],
      },
    };

    const { getByText, getByTitle, getAllByRole } = render(
      <JobHistory jobs={[jobWithCases]} onLoadWorkspaceCode={onLoadCode} />
    );

    // Header and UAT title visible
    expect(getByText(/FN-STS-01 \(Part 1\) · เข้าสู่ระบบสำเร็จตามสิทธิ์/i)).toBeInTheDocument();
    expect(getByText(/ผ่าน 1\/2 เคส/i)).toBeInTheDocument();

    // Expand accordion
    const expandBtn = getByTitle(/ดูผลการทดสอบราย Test Case/i);
    await user.click(expandBtn);

    // Test cases breakdown is now visible
    expect(getByText(/TC-STS-AUTH-TEACHER/i)).toBeInTheDocument();
    expect(getByText(/Login as teacher succeeds/i)).toBeInTheDocument();
    expect(getByText(/TC-STS-AUTH-DIRECTOR/i)).toBeInTheDocument();
    expect(getByText(/Error: expect\(page\)\.toHaveURL failed/i)).toBeInTheDocument();

    // Click load code button
    const loadButtons = getAllByRole("button", { name: /โหลดโค้ด/i });
    expect(loadButtons.length).toBeGreaterThan(0);
    fireEvent.click(loadButtons[0]);

    expect(onLoadCode).toHaveBeenCalledWith(expect.objectContaining({ id: "job-sts-1" }));
  });
});
