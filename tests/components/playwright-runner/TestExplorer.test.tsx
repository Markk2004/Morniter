// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TestExplorer } from "@/components/playwright-runner/explorer/TestExplorer";

afterEach(() => {
  cleanup();
});

describe("TestExplorer Component", () => {
  const groups = [
    {
      name: "Authentication",
      tests: [
        {
          id: "auth-1",
          title: "Login with valid credentials",
          group: "Authentication",
          relativePath: "e2e/auth/login.spec.ts",
          line: 12,
        },
        {
          id: "auth-2",
          title: "Logout session",
          group: "Authentication",
          relativePath: "e2e/auth/logout.spec.ts",
          line: 45,
        },
      ],
    },
    {
      name: "Dashboard",
      tests: [
        {
          id: "dash-1",
          title: "View metrics graph",
          group: "Dashboard",
          relativePath: "e2e/dashboard/metrics.spec.ts",
        },
      ],
    },
  ];

  it("renders test groups and allows searching tests", () => {
    const onToggle = vi.fn();
    render(<TestExplorer groups={groups} selected={["auth-1"]} onToggle={onToggle} />);

    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Login with valid credentials/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Filter tests/i);
    fireEvent.change(searchInput, { target: { value: "metrics" } });

    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();
    expect(screen.getByText(/View metrics graph/i)).toBeInTheDocument();
  });

  it("triggers toggle and load source callbacks", () => {
    const onToggle = vi.fn();
    const onLoadSource = vi.fn();
    render(
      <TestExplorer
        groups={groups}
        selected={[]}
        onToggle={onToggle}
        onLoadSource={onLoadSource}
      />,
    );

    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith("auth-1");

    const inspectButtons = screen.getAllByTitle(/Load source code into editor/i);
    fireEvent.click(inspectButtons[0]);
    expect(onLoadSource).toHaveBeenCalledWith("auth-1");
  });

  it("shows the safe scan path when no Playwright tests are found", () => {
    render(
      <TestExplorer
        groups={[]}
        selected={[]}
        onToggle={vi.fn()}
        scanPathLabel="frontend/e2e"
      />,
    );

    expect(screen.getByText("No Playwright tests found")).toBeInTheDocument();
    expect(screen.getByText("Scanned: frontend/e2e")).toBeInTheDocument();
  });
});
