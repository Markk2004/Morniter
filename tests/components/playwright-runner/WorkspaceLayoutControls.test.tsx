// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResizeSeparator } from "@/components/playwright-runner/layout/ResizeSeparator";
import { WorkspaceTabs } from "@/components/playwright-runner/layout/WorkspaceTabs";

afterEach(() => {
  cleanup();
});

describe("ResizeSeparator component", () => {
  it("renders vertical separator with accessible ARIA attributes", () => {
    render(
      <ResizeSeparator
        orientation="vertical"
        value={320}
        min={280}
        max={440}
        resetValue={320}
        label="Test Explorer width resizer"
        onChange={vi.fn()}
      />,
    );

    const separator = screen.getByRole("separator", { name: "Test Explorer width resizer" });
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "320");
    expect(separator).toHaveAttribute("aria-valuemin", "280");
    expect(separator).toHaveAttribute("aria-valuemax", "440");
  });

  it("handles keyboard Arrow keys, Home, and End", () => {
    const onChange = vi.fn();
    render(
      <ResizeSeparator
        orientation="vertical"
        value={320}
        min={280}
        max={440}
        resetValue={320}
        label="Test Explorer width resizer"
        onChange={onChange}
      />,
    );

    const separator = screen.getByRole("separator");

    // ArrowRight -> +16
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(336);

    // ArrowLeft -> -16
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(304);

    // Home -> min (280)
    fireEvent.keyDown(separator, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith(280);

    // End -> max (440)
    fireEvent.keyDown(separator, { key: "End" });
    expect(onChange).toHaveBeenCalledWith(440);
  });

  it("double-click resets to default value", () => {
    const onChange = vi.fn();
    render(
      <ResizeSeparator
        orientation="horizontal"
        value={350}
        min={160}
        max={600}
        resetValue={240}
        label="Terminal height resizer"
        onChange={onChange}
      />,
    );

    const separator = screen.getByRole("separator");
    fireEvent.doubleClick(separator);
    expect(onChange).toHaveBeenCalledWith(240);
  });
});

describe("WorkspaceTabs component", () => {
  it("renders 3 accessible tabs with role tablist and tabpanel semantics", () => {
    const onChange = vi.fn();
    render(
      <WorkspaceTabs
        activeTab="explorer"
        unreadLogsCount={0}
        isJobRunning={false}
        onChange={onChange}
        explorerPanel={<div data-testid="panel-explorer">Explorer Content</div>}
        codePanel={<div data-testid="panel-code">Code Content</div>}
        terminalPanel={<div data-testid="panel-terminal">Terminal Content</div>}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: /Workspace tabs/i });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");

    // Switching tabs via click
    fireEvent.click(tabs[1]);
    expect(onChange).toHaveBeenCalledWith("code");
  });

  it("shows running badge and unread logs count on terminal tab", () => {
    render(
      <WorkspaceTabs
        activeTab="explorer"
        unreadLogsCount={5}
        isJobRunning={true}
        onChange={vi.fn()}
        explorerPanel={<div>Explorer Content</div>}
        codePanel={<div>Code Content</div>}
        terminalPanel={<div>Terminal Content</div>}
      />,
    );

    expect(screen.getByText(/Running/i)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("supports keyboard Arrow navigation across tabs", () => {
    const onChange = vi.fn();
    render(
      <WorkspaceTabs
        activeTab="explorer"
        unreadLogsCount={0}
        isJobRunning={false}
        onChange={onChange}
        explorerPanel={<div>Explorer Content</div>}
        codePanel={<div>Code Content</div>}
        terminalPanel={<div>Terminal Content</div>}
      />,
    );

    const tabs = screen.getAllByRole("tab");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("code");

    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(onChange).toHaveBeenCalledWith("terminal");

    fireEvent.keyDown(tabs[2], { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("explorer");
  });
});
