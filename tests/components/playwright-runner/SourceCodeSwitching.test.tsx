// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TestExplorer } from "@/components/playwright-runner/explorer/TestExplorer";
import type { ProjectCoverageGroup } from "@/lib/playwright-runner/types";

afterEach(() => {
  cleanup();
});

const mockGroups: ProjectCoverageGroup[] = [
  {
    id: "group-1",
    name: "01-auth-login",
    functionId: "FN-STS-01",
    functionName: "Authentication Suite",
    tests: [
      {
        id: "tc-1",
        title: "TC-STS-AUTH-001: Login as Admin",
        relativePath: "e2e/sts/login.spec.ts",
        runner: "playwright",
        executable: true,
        origin: "manual",
        confidence: "high",
        matchedBy: ["path"],
      },
      {
        id: "tc-2",
        title: "TC-STS-AUTH-002: Invalid Password",
        relativePath: "e2e/sts/login.spec.ts",
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

describe("Source Code Switching Performance & Feedback", () => {
  it("triggers onPrefetchSource when mouse hovers over a test card", () => {
    const onPrefetch = vi.fn();
    const onLoad = vi.fn();

    render(
      <TestExplorer
        groups={mockGroups}
        selected={[]}
        onToggle={vi.fn()}
        onLoadSource={onLoad}
        onPrefetchSource={onPrefetch}
      />
    );

    // Expand group
    const groupHeader = screen.getByText(/Authentication Suite/i);
    fireEvent.click(groupHeader);

    // Find test card
    const testTitle = screen.getByText(/TC-STS-AUTH-001: Login as Admin/i);
    const cardContainer = testTitle.closest(".space-y-1");
    expect(cardContainer).toBeTruthy();

    // Hover
    fireEvent.mouseEnter(cardContainer!);
    expect(onPrefetch).toHaveBeenCalledWith("tc-1");
  });

  it("displays loading spinner when loadingSourceTestId matches test.id", () => {
    const onLoad = vi.fn();

    const { rerender } = render(
      <TestExplorer
        groups={mockGroups}
        selected={[]}
        onToggle={vi.fn()}
        onLoadSource={onLoad}
        loadingSourceTestId={null}
      />
    );

    // Expand group
    const groupButtons = screen.getAllByRole("button");
    const groupHeader = groupButtons.find(b => b.textContent?.includes("Authentication Suite"))!;
    fireEvent.click(groupHeader);

    expect(screen.getAllByText("Open 📝").length).toBe(2);

    // Set loading on tc-1
    rerender(
      <TestExplorer
        groups={mockGroups}
        selected={[]}
        onToggle={vi.fn()}
        onLoadSource={onLoad}
        loadingSourceTestId="tc-1"
      />
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // Second item still has Open 📝
    expect(screen.getAllByText("Open 📝").length).toBe(1);
  });
});
