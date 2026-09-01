// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WorkspaceControlBar } from "@/components/playwright-runner/layout/WorkspaceControlBar";
import type { PlaywrightProjectCatalog } from "@/lib/playwright-runner/types";

afterEach(() => {
  cleanup();
});

describe("WorkspaceControlBar component", () => {
  const projects: PlaywrightProjectCatalog[] = [
    {
      id: "project-sts",
      name: "ProjectSTS",
    },
  ];

  it("renders project, browsers, mode, agent status, and triggers run/cancel callbacks", () => {
    const onSelectProject = vi.fn();
    const onToggleBrowser = vi.fn();
    const onRunModeChange = vi.fn();
    const onRun = vi.fn();
    const onCancel = vi.fn();
    const onResetLayout = vi.fn();

    const { rerender } = render(
      <WorkspaceControlBar
        projects={projects}
        selectedProjectId="project-sts"
        onSelectProject={onSelectProject}
        selectedBrowsers={["chromium"]}
        browserCapabilities={{ chromium: true, firefox: true, webkit: true }}
        onToggleBrowser={onToggleBrowser}
        runMode="headless"
        headedAvailable={true}
        onRunModeChange={onRunModeChange}
        presence={{ state: "online", agentId: "agent-win-1", lastHeartbeatAt: new Date().toISOString() }}
        source="project-test"
        selectedTestCount={3}
        isUnlocked={true}
        canRun={true}
        isSubmitting={false}
        isJobRunning={false}
        onRun={onRun}
        onCancel={onCancel}
        onResetLayout={onResetLayout}
      />,
    );

    // Project select
    expect(screen.getByRole("combobox", { name: "Target Project" })).toBeInTheDocument();

    // Browser button toggle
    const firefoxBtn = screen.getByRole("button", { name: /^Firefox$/i });
    fireEvent.click(firefoxBtn);
    expect(onToggleBrowser).toHaveBeenCalledWith("firefox");

    // Mode toggle
    expect(screen.getByRole("button", { name: "ทำงานเบื้องหลัง (Headless)" })).toBeInTheDocument();
    const headedBtn = screen.getByRole("button", { name: "แสดง Browser (Headed)" });
    fireEvent.click(headedBtn);
    expect(onRunModeChange).toHaveBeenCalledWith("headed");

    // Agent status
    expect(screen.getByText(/Local Agent Online/i)).toBeInTheDocument();

    // Reset layout button
    const resetBtn = screen.getByRole("button", { name: /Reset layout/i });
    fireEvent.click(resetBtn);
    expect(onResetLayout).toHaveBeenCalled();

    // Run button
    const runBtn = screen.getByRole("button", { name: /Run 3/i });
    fireEvent.click(runBtn);
    expect(onRun).toHaveBeenCalled();

    // When job is running -> Cancel button appears
    rerender(
      <WorkspaceControlBar
        projects={projects}
        selectedProjectId="project-sts"
        onSelectProject={onSelectProject}
        selectedBrowsers={["chromium"]}
        onToggleBrowser={onToggleBrowser}
        runMode="headless"
        headedAvailable={true}
        onRunModeChange={onRunModeChange}
        presence={{ state: "online", agentId: "agent-win-1", lastHeartbeatAt: new Date().toISOString() }}
        source="project-test"
        selectedTestCount={3}
        isUnlocked={true}
        canRun={true}
        isSubmitting={false}
        isJobRunning={true}
        onRun={onRun}
        onCancel={onCancel}
        onResetLayout={onResetLayout}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it("handles Interactive UI mode, Open Interactive UI label, and Stop UI action", () => {
    const onRunModeChange = vi.fn();
    const onRun = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <WorkspaceControlBar
        projects={projects}
        selectedProjectId="project-sts"
        onSelectProject={vi.fn()}
        selectedBrowsers={["chromium"]}
        onToggleBrowser={vi.fn()}
        runMode="interactive"
        headedAvailable={true}
        onRunModeChange={onRunModeChange}
        presence={{ state: "online", agentId: "agent-win-1", lastHeartbeatAt: new Date().toISOString() }}
        source="project-test"
        selectedTestCount={2}
        isUnlocked={true}
        canRun={true}
        isSubmitting={false}
        isJobRunning={false}
        onRun={onRun}
        onCancel={onCancel}
      />,
    );

    // Interactive mode button selected
    expect(screen.getByRole("button", { name: /^Interactive UI$/i })).toHaveAttribute("aria-pressed", "true");

    // Open Interactive UI button
    const openBtn = screen.getByRole("button", { name: /Open Interactive UI/i });
    expect(openBtn).toBeInTheDocument();
    fireEvent.click(openBtn);
    expect(onRun).toHaveBeenCalled();

    // When running in interactive mode -> Stop UI button appears
    rerender(
      <WorkspaceControlBar
        projects={projects}
        selectedProjectId="project-sts"
        onSelectProject={vi.fn()}
        selectedBrowsers={["chromium"]}
        onToggleBrowser={vi.fn()}
        runMode="interactive"
        headedAvailable={true}
        onRunModeChange={onRunModeChange}
        presence={{ state: "online", agentId: "agent-win-1", lastHeartbeatAt: new Date().toISOString() }}
        source="project-test"
        selectedTestCount={2}
        isUnlocked={true}
        canRun={true}
        isSubmitting={false}
        isJobRunning={true}
        onRun={onRun}
        onCancel={onCancel}
      />,
    );

    const stopBtn = screen.getByRole("button", { name: /Stop UI/i });
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
