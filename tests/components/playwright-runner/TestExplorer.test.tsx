// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TestExplorer } from "@/components/playwright-runner/explorer/TestExplorer";
import type { ProjectCoverageGroup, ProjectCoverageTest } from "@/lib/playwright-runner/types";

afterEach(() => {
  cleanup();
});

describe("TestExplorer Component", () => {
  const sheetGroups: ProjectCoverageGroup[] = [
    {
      id: "FN-STS-01",
      name: "Authentication Group",
      functionId: "FN-STS-01",
      functionName: "Authentication",
      tests: [
        {
          id: "auth-1",
          title: "Login with valid credentials",
          relativePath: "e2e/auth/login.spec.ts",
          runner: "playwright",
          executable: true,
          risk: "read-only",
          origin: "manual",
          confidence: "high",
          matchedBy: ["path"],
        },
        {
          id: "auth-2",
          title: "Logout session",
          relativePath: "e2e/auth/logout.spec.ts",
          runner: "node-test",
          executable: true,
          risk: "mutating",
          origin: "manual",
          confidence: "medium",
          matchedBy: ["keyword"],
        },
      ],
      gaps: [],
    },
    {
      id: "FN-STS-02",
      name: "Dashboard Group",
      functionId: "FN-STS-02",
      functionName: "Dashboard",
      tests: [
        {
          id: "dash-1",
          title: "View metrics graph",
          relativePath: "backend/test/metrics.e2e-spec.ts",
          runner: "jest-e2e",
          executable: true,
          risk: "read-only",
          origin: "manual",
          confidence: "low",
          matchedBy: ["title"],
        },
      ],
      gaps: [],
    },
  ];

  const createLargeGroup = (): ProjectCoverageGroup => {
    const tests: ProjectCoverageTest[] = [];
    // 12 High/Medium tests
    for (let i = 1; i <= 12; i++) {
      tests.push({
        id: `ready-test-${i}`,
        title: `Ready Test Case ${i}`,
        relativePath: `e2e/ready-${i}.spec.ts`,
        runner: "playwright",
        executable: true,
        risk: "read-only",
        origin: "manual",
        confidence: i % 2 === 0 ? "high" : "medium",
        matchedBy: ["explicit"],
      });
    }
    // 11 Low tests
    for (let i = 1; i <= 11; i++) {
      tests.push({
        id: `low-test-${i}`,
        title: `Low Confidence Test ${i}`,
        relativePath: `e2e/low-${i}.spec.ts`,
        runner: "playwright",
        executable: true,
        risk: "mutating",
        origin: "manual",
        confidence: "low",
        matchedBy: ["keyword"],
      });
    }
    return {
      id: "FN-LARGE-01",
      name: "Large Function Group",
      functionId: "FN-LARGE-01",
      functionName: "Large Function",
      tests,
      gaps: [],
    };
  };

  const legacyGroups = [
    {
      name: "Legacy Auth",
      tests: [
        {
          id: "legacy-1",
          title: "Legacy Login Test",
          group: "Legacy Auth",
          relativePath: "e2e/legacy-login.spec.ts",
        },
      ],
    },
  ];

  const malformedGroups: ProjectCoverageGroup[] = [
    {
      id: "partial-1",
      name: "Partial Function Group",
      functionId: "FN-STS-99",
      tests: [
        {
          id: "part-1",
          title: "Partial test",
          relativePath: "e2e/part.spec.ts",
          runner: "playwright",
          executable: true,
          origin: "manual",
          confidence: "high",
          matchedBy: ["path"],
        },
      ],
      gaps: [],
    },
  ];

  it("renders sheet function labels in group headings and 'ตรงกับ Sheet' badge inside expanded group", () => {
    const onToggle = vi.fn();
    render(<TestExplorer groups={sheetGroups} selected={["auth-1"]} onToggle={onToggle} />);

    expect(screen.getByText("FN-STS-01 · Authentication")).toBeInTheDocument();
    expect(screen.getByText("FN-STS-02 · Dashboard")).toBeInTheDocument();

    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("FN-STS-01 · Authentication"));
    expect(screen.getByText(/Login with valid credentials/i)).toBeInTheDocument();

    const sheetBadges = screen.getAllByText("ตรงกับ Sheet");
    expect(sheetBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("partitions tests into 'พร้อมทดสอบ' and 'ควรตรวจสอบการจับคู่' with initial limits and pagination", () => {
    const largeGroup = createLargeGroup();
    render(<TestExplorer groups={[largeGroup]} selected={[]} onToggle={vi.fn()} />);

    // Expand group
    fireEvent.click(screen.getByText("FN-LARGE-01 · Large Function"));

    // Section 1: พร้อมทดสอบ 12 (expanded by default)
    const readyHeader = screen.getByRole("button", { name: /พร้อมทดสอบ 12/i });
    expect(readyHeader).toHaveAttribute("aria-expanded", "true");

    // Section 2: ควรตรวจสอบการจับคู่ 11 (collapsed by default)
    const reviewHeader = screen.getByRole("button", { name: /ควรตรวจสอบการจับคู่ 11/i });
    expect(reviewHeader).toHaveAttribute("aria-expanded", "false");

    // Initially 10 ready tests visible
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(screen.getByText("Ready Test Case 1")).toBeInTheDocument();
    expect(screen.getByText("Ready Test Case 10")).toBeInTheDocument();
    expect(screen.queryByText("Ready Test Case 11")).not.toBeInTheDocument();

    // Click 'แสดงเพิ่มอีก 10'
    const loadMoreBtn = screen.getByRole("button", { name: /แสดงเพิ่มอีก 10/i });
    fireEvent.click(loadMoreBtn);

    // Now all 12 ready tests visible
    expect(screen.getByText("Ready Test Case 11")).toBeInTheDocument();
    expect(screen.getByText("Ready Test Case 12")).toBeInTheDocument();

    // Click 'ย่อรายการ'
    const collapseBtn = screen.getByRole("button", { name: /ย่อรายการ/i });
    fireEvent.click(collapseBtn);
    expect(screen.queryByText("Ready Test Case 11")).not.toBeInTheDocument();

    // Expand Low confidence review section
    fireEvent.click(reviewHeader);
    expect(reviewHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Low Confidence Test 1")).toBeInTheDocument();
    expect(screen.getByText("Low Confidence Test 10")).toBeInTheDocument();
    expect(screen.queryByText("Low Confidence Test 11")).not.toBeInTheDocument();
  });

  it("supports expanding inline match details and keeping multiple panels open", () => {
    render(<TestExplorer groups={sheetGroups} selected={[]} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByText("FN-STS-01 · Authentication"));

    const detailButtons = screen.getAllByRole("button", { name: "รายละเอียด" });
    expect(detailButtons).toHaveLength(2);

    // Open first test details
    fireEvent.click(detailButtons[0]);
    expect(detailButtons[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("ข้อมูลการจับคู่ฟังก์ชัน")).toBeInTheDocument();
    expect(screen.getAllByText("e2e/auth/login.spec.ts")).toHaveLength(2);

    // Open second test details
    fireEvent.click(detailButtons[1]);
    expect(detailButtons[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("e2e/auth/logout.spec.ts")).toHaveLength(2);

    // Both details remain open simultaneously
    expect(screen.getAllByText("e2e/auth/login.spec.ts")).toHaveLength(2);
    expect(screen.getAllByText("e2e/auth/logout.spec.ts")).toHaveLength(2);

    // Close first details; second remains open
    fireEvent.click(detailButtons[0]);
    expect(detailButtons[0]).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByText("e2e/auth/login.spec.ts")).toHaveLength(1);
    expect(screen.getAllByText("e2e/auth/logout.spec.ts")).toHaveLength(2);
  });

  it("supports searching tests beyond the initial 10-item page limit", () => {
    const largeGroup = createLargeGroup();
    render(<TestExplorer groups={[largeGroup]} selected={[]} onToggle={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Filter tests/i);

    // Search for test #12 (which was on page 2)
    fireEvent.change(searchInput, { target: { value: "Ready Test Case 12" } });
    expect(screen.getByText("Ready Test Case 12")).toBeInTheDocument();

    // Search for Low confidence test #11
    fireEvent.change(searchInput, { target: { value: "Low Confidence Test 11" } });
    expect(screen.getByText("Low Confidence Test 11")).toBeInTheDocument();
  });

  it("supports searching by function ID and function name", () => {
    render(<TestExplorer groups={sheetGroups} selected={[]} onToggle={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Filter tests/i);

    fireEvent.change(searchInput, { target: { value: "FN-STS-02" } });
    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();
    expect(screen.getByText(/View metrics graph/i)).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Authentication" } });
    expect(screen.getByText(/Login with valid credentials/i)).toBeInTheDocument();
    expect(screen.queryByText(/View metrics graph/i)).not.toBeInTheDocument();
  });

  it("renders legacy groups without sheet badge and falls back to group.name under ready section", () => {
    render(<TestExplorer groups={legacyGroups} selected={[]} onToggle={vi.fn()} />);

    expect(screen.getByText("Legacy Auth")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Legacy Auth"));
    expect(screen.getByText("พร้อมทดสอบ 1")).toBeInTheDocument();
    expect(screen.getByText("Legacy Login Test")).toBeInTheDocument();
    expect(screen.queryByText("ตรงกับ Sheet")).not.toBeInTheDocument();
  });

  it("safely falls back to group.name and omits badge when metadata is malformed (only functionId present)", () => {
    render(<TestExplorer groups={malformedGroups} selected={[]} onToggle={vi.fn()} />);

    expect(screen.getByText("Partial Function Group")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Partial Function Group"));
    expect(screen.getByText("Partial test")).toBeInTheDocument();
    expect(screen.queryByText("ตรงกับ Sheet")).not.toBeInTheDocument();
  });

  it("triggers toggle and load source callbacks for any runner", () => {
    const onToggle = vi.fn();
    const onLoadSource = vi.fn();
    render(
      <TestExplorer
        groups={sheetGroups}
        selected={[]}
        onToggle={onToggle}
        onLoadSource={onLoadSource}
      />,
    );

    fireEvent.click(screen.getByText("FN-STS-01 · Authentication"));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);

    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith("auth-2");

    const inspectButtons = screen.getAllByTitle(/Load source code into editor/i);
    fireEvent.click(inspectButtons[1]);
    expect(onLoadSource).toHaveBeenCalledWith("auth-2");
  });

  it("renders runner badges, risk badges, and supports runner chip filtering", () => {
    render(<TestExplorer groups={sheetGroups} selected={[]} onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Playwright$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Node$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Jest E2E$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Node$/i }));

    expect(screen.getByText(/Logout session/i)).toBeInTheDocument();
    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();
    expect(screen.getByText("Frontend Node")).toBeInTheDocument();
    expect(screen.getByText("Mutating")).toBeInTheDocument();
  });

  it("renders Draft 🪄 button for non-Playwright tests and coverage gaps, and triggers onCreateDraft", () => {
    const onCreateDraft = vi.fn();
    const groupsWithGaps: ProjectCoverageGroup[] = [
      {
        id: "FN-STS-01",
        name: "Authentication Group",
        functionId: "FN-STS-01",
        functionName: "Authentication",
        tests: [
          {
            id: "auth-pw-1",
            title: "Playwright Login",
            relativePath: "e2e/auth/login.spec.ts",
            runner: "playwright",
            executable: true,
            risk: "read-only",
            origin: "manual",
            confidence: "high",
            matchedBy: ["path"],
          },
          {
            id: "auth-node-1",
            title: "Node Auth Helper",
            relativePath: "src/auth.test.ts",
            runner: "node-test",
            executable: true,
            risk: "read-only",
            origin: "manual",
            confidence: "medium",
            matchedBy: ["keyword"],
          },
        ],
        gaps: [
          {
            targetId: "gap-1",
            title: "Missing Password Reset",
            status: "ready-to-generate",
          },
        ],
      },
    ];

    render(
      <TestExplorer
        groups={groupsWithGaps}
        selected={[]}
        onToggle={vi.fn()}
        onCreateDraft={onCreateDraft}
      />,
    );

    fireEvent.click(screen.getByText("FN-STS-01 · Authentication"));

    // Draft buttons are rendered for Node test and gap, but NOT for Playwright test
    const draftButtons = screen.getAllByRole("button", { name: /Draft 🪄/i });
    expect(draftButtons).toHaveLength(2);

    // Trigger draft on Node test
    fireEvent.click(draftButtons[0]);
    expect(onCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        testId: "auth-node-1",
        title: "Node Auth Helper",
        relativePath: "src/auth.test.ts",
        functionId: "FN-STS-01",
        functionName: "Authentication",
      }),
    );

    // Trigger draft on Gap
    fireEvent.click(draftButtons[1]);
    expect(onCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Missing Password Reset",
        functionId: "FN-STS-01",
        functionName: "Authentication",
      }),
    );
  });

  it("shows empty state when no tests are found", () => {
    render(
      <TestExplorer
        groups={[]}
        selected={[]}
        onToggle={vi.fn()}
        scanPathLabel="frontend/e2e"
      />,
    );

    expect(screen.getByText("No tests found")).toBeInTheDocument();
    expect(screen.getByText("Scanned: frontend/e2e")).toBeInTheDocument();
  });
});
