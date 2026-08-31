// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BalancedWorkspaceLayout } from "@/components/playwright-runner/layout/BalancedWorkspaceLayout";
import type { UseWorkspaceLayoutResult } from "@/components/playwright-runner/layout/useWorkspaceLayout";

afterEach(() => {
  cleanup();
});

describe("BalancedWorkspaceLayout component", () => {
  const defaultLayout: UseWorkspaceLayoutResult = {
    isNarrow: false,
    explorerWidth: 320,
    terminalHeight: 240,
    terminalCollapsed: false,
    activeTab: "explorer",
    setExplorerWidth: vi.fn(),
    setTerminalHeight: vi.fn(),
    setTerminalCollapsed: vi.fn(),
    setActiveTab: vi.fn(),
    resetLayout: vi.fn(),
  };

  it("renders desktop layout in a bounded frame with internally scrolling main panels", () => {
    render(
      <div style={{ height: "800px" }}>
        <BalancedWorkspaceLayout
          layout={defaultLayout}
          toolbar={<div data-testid="toolbar">Toolbar</div>}
          explorer={<div data-testid="explorer">Explorer</div>}
          code={<div data-testid="code">Code</div>}
          terminal={<div data-testid="terminal">Terminal</div>}
        />
      </div>,
    );

    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("explorer")).toBeInTheDocument();
    expect(screen.getByTestId("code")).toBeInTheDocument();
    expect(screen.getByTestId("terminal")).toBeInTheDocument();

    expect(screen.getByTestId("balanced-workspace")).toHaveClass("h-full", "overflow-hidden");
    expect(screen.getByTestId("workspace-main-row")).toHaveClass("min-h-0", "overflow-hidden");
    expect(screen.getByTestId("workspace-explorer-panel")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("workspace-code-panel")).toHaveClass("overflow-y-auto");

    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(2); // 1 vertical, 1 horizontal
  });

  it("collapses terminal when header is clicked", () => {
    const setTerminalCollapsed = vi.fn();
    const { rerender } = render(
      <BalancedWorkspaceLayout
        layout={{
          ...defaultLayout,
          terminalCollapsed: false,
          setTerminalCollapsed,
        }}
        toolbar={<div>Toolbar</div>}
        explorer={<div>Explorer</div>}
        code={<div>Code</div>}
        terminal={<div data-testid="terminal">Terminal Body</div>}
      />,
    );

    expect(screen.getByTestId("terminal")).toBeInTheDocument();
    const toggleBtn = screen.getByRole("button", { name: /Collapse Terminal/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hide Terminal ▼")).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(setTerminalCollapsed).toHaveBeenCalledWith(true);

    // When collapsed
    rerender(
      <BalancedWorkspaceLayout
        layout={{
          ...defaultLayout,
          terminalCollapsed: true,
          setTerminalCollapsed,
        }}
        toolbar={<div>Toolbar</div>}
        explorer={<div>Explorer</div>}
        code={<div>Code</div>}
        terminal={<div data-testid="terminal">Terminal Body</div>}
      />,
    );

    expect(screen.queryByTestId("terminal")).not.toBeInTheDocument();
    const expandBtn = screen.getByRole("button", { name: /Expand Terminal/i });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Show Terminal ▲")).toBeInTheDocument();
  });

  it("switches to WorkspaceTabs when isNarrow is true", () => {
    const setActiveTab = vi.fn();
    render(
      <BalancedWorkspaceLayout
        layout={{
          ...defaultLayout,
          isNarrow: true,
          activeTab: "code",
          setActiveTab,
        }}
        toolbar={<div data-testid="toolbar">Toolbar</div>}
        explorer={<div data-testid="explorer">Explorer</div>}
        code={<div data-testid="code">Code</div>}
        terminal={<div data-testid="terminal">Terminal</div>}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Workspace tabs" })).toBeInTheDocument();
    expect(screen.queryAllByRole("separator")).toHaveLength(0); // no separators in narrow mode
  });
});
