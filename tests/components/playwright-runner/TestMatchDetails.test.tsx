// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TestMatchDetails } from "@/components/playwright-runner/explorer/TestMatchDetails";
import type { ProjectCoverageTest } from "@/lib/playwright-runner/types";

afterEach(() => {
  cleanup();
});

describe("TestMatchDetails Component", () => {
  const sampleTest: ProjectCoverageTest = {
    id: "auth-login-test",
    title: "Login with valid credentials",
    relativePath: "e2e/auth/login.spec.ts",
    runner: "playwright",
    executable: true,
    risk: "mutating",
    origin: "manual",
    confidence: "high",
    matchedBy: ["explicit", "path"],
  };

  it("renders all metadata fields for a matched test cleanly without absolute paths", () => {
    const { container } = render(
      <TestMatchDetails
        panelId="details-auth-1"
        functionId="FN-STS-01"
        functionName="Authentication"
        test={sampleTest}
      />,
    );

    expect(container.querySelector("#details-auth-1")).toBeInTheDocument();
    expect(screen.getByText("FN-STS-01 · Authentication")).toBeInTheDocument();
    expect(screen.getByText("e2e/auth/login.spec.ts")).toBeInTheDocument();
    expect(screen.getByText("Playwright")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText(/กำหนดไว้ใน automation map/i)).toBeInTheDocument();
    expect(screen.getByText(/ตรงจากชื่อโฟลเดอร์หรือไฟล์/i)).toBeInTheDocument();
    expect(screen.getByText("พร้อมรัน")).toBeInTheDocument();
    expect(screen.getByText("Mutating")).toBeInTheDocument();

    // Security assertions: no absolute paths or secret data
    expect(container.innerHTML).not.toMatch(/^[A-Za-z]:\\/);
    expect(container.innerHTML).not.toContain("password");
    expect(container.innerHTML).not.toContain("secret");
  });

  it("handles tests without sheet metadata or match methods gracefully", () => {
    const legacyTest: ProjectCoverageTest = {
      id: "legacy-t1",
      title: "Legacy Standalone Test",
      relativePath: "tests/legacy.test.ts",
      runner: "node-test",
      executable: false,
      risk: "read-only",
      origin: "manual",
      confidence: "low",
      matchedBy: [],
    };

    render(<TestMatchDetails panelId="details-legacy-1" test={legacyTest} />);

    expect(screen.getByText("ไม่มีรายละเอียดการจับคู่")).toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถรันได้")).toBeInTheDocument();
    expect(screen.getByText("Frontend Node")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
  });
});
