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
      id: "auth-group",
      name: "Authentication",
      tests: [
        {
          id: "auth-1",
          title: "Login with valid credentials",
          relativePath: "e2e/auth/login.spec.ts",
          runner: "playwright" as const,
          executable: true,
          risk: "read-only" as const,
          origin: "manual" as const,
          confidence: "high" as const,
          matchedBy: ["path" as const],
        },
        {
          id: "auth-2",
          title: "Logout session",
          relativePath: "e2e/auth/logout.spec.ts",
          runner: "node-test" as const,
          executable: true,
          risk: "mutating" as const,
          origin: "manual" as const,
          confidence: "high" as const,
          matchedBy: ["path" as const],
        },
      ],
      gaps: [],
    },
    {
      id: "dash-group",
      name: "Dashboard",
      tests: [
        {
          id: "dash-1",
          title: "View metrics graph",
          relativePath: "backend/test/metrics.e2e-spec.ts",
          runner: "jest-e2e" as const,
          executable: true,
          risk: "read-only" as const,
          origin: "manual" as const,
          confidence: "high" as const,
          matchedBy: ["path" as const],
        },
      ],
      gaps: [],
    },
  ];

  it("renders test groups collapsed by default and allows expanding or searching tests", () => {
    const onToggle = vi.fn();
    render(<TestExplorer groups={groups} selected={["auth-1"]} onToggle={onToggle} />);

    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    // Default collapsed: test details are hidden until group is clicked
    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();

    // Click Authentication group to expand and view details
    fireEvent.click(screen.getByText("Authentication"));
    expect(screen.getByText(/Login with valid credentials/i)).toBeInTheDocument();

    // Searching auto-expands matching group
    const searchInput = screen.getByPlaceholderText(/Filter tests/i);
    fireEvent.change(searchInput, { target: { value: "metrics" } });

    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();
    expect(screen.getByText(/View metrics graph/i)).toBeInTheDocument();
  });

  it("triggers toggle and load source callbacks for any runner", () => {
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

    // Expand Authentication group to view and interact with tests
    fireEvent.click(screen.getByText("Authentication"));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);

    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith("auth-2");

    const inspectButtons = screen.getAllByTitle(/Load source code into editor/i);
    fireEvent.click(inspectButtons[1]);
    expect(onLoadSource).toHaveBeenCalledWith("auth-2");
  });

  it("renders runner badges, risk badges, and supports runner chip filtering", () => {
    render(<TestExplorer groups={groups} selected={[]} onToggle={vi.fn()} />);

    // Filter chips present
    expect(screen.getByRole("button", { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Playwright$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Node$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Jest E2E$/i })).toBeInTheDocument();

    // Filter by Node
    fireEvent.click(screen.getByRole("button", { name: /^Node$/i }));

    expect(screen.getByText(/Logout session/i)).toBeInTheDocument();
    expect(screen.queryByText(/Login with valid credentials/i)).not.toBeInTheDocument();
    expect(screen.getByText("Frontend Node")).toBeInTheDocument();
    expect(screen.getByText("Mutating")).toBeInTheDocument();
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
