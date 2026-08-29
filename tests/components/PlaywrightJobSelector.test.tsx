// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PlaywrightJobSelector } from "@/components/test-runner/PlaywrightJobSelector";
import type { PlaywrightCatalog } from "@/lib/playwright-runner/types";

afterEach(() => {
  cleanup();
});

const mockCatalog: PlaywrightCatalog = {
  version: "2.0.0",
  updatedAt: new Date().toISOString(),
  projects: [
    {
      id: "projectsts",
      name: "ProjectSTS",
      capabilities: {
        browsers: { chromium: true, firefox: true, webkit: true },
        headed: true,
        workspaceExecution: true,
      },
      tests: [
        {
          id: "test-auth-1",
          title: "Verify Valid Login",
          group: "Auth",
          relativePath: "e2e/auth.spec.ts",
        },
        {
          id: "test-auth-2",
          title: "Verify Invalid Password",
          group: "Auth",
          relativePath: "e2e/auth.spec.ts",
        },
      ],
    },
  ],
};

describe("PlaywrightJobSelector Component", () => {
  it("renders project tests and handles test selection and select-all", () => {
    const onRunJob = vi.fn();
    render(
      <PlaywrightJobSelector
        catalog={mockCatalog}
        activeJob={null}
        isUnlocked={true}
        isAgentOnline={true}
        isJobRunning={false}
        isSubmitting={false}
        onRunJob={onRunJob}
      />,
    );

    expect(screen.getByText("Verify Valid Login")).toBeInTheDocument();
    expect(screen.getByText("Verify Invalid Password")).toBeInTheDocument();

    const selectAllBtn = screen.getByRole("button", { name: /Select All|Deselect All/i });
    fireEvent.click(selectAllBtn);

    const runBtn = screen.getByRole("button", { name: /Execute Playwright Tests/i });
    expect(runBtn).not.toBeDisabled();
    fireEvent.click(runBtn);

    expect(onRunJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "projectsts",
        source: "project-test",
        testIds: ["test-auth-1", "test-auth-2"],
        browsers: ["chromium"],
        mode: "headless",
      }),
    );
  });

  it("switches to code workspace and runs custom playwright code", () => {
    const onRunJob = vi.fn();
    render(
      <PlaywrightJobSelector
        catalog={mockCatalog}
        activeJob={null}
        isUnlocked={true}
        isAgentOnline={true}
        isJobRunning={false}
        isSubmitting={false}
        onRunJob={onRunJob}
      />,
    );

    const workspaceTab = screen.getByRole("button", { name: /Code Workspace/i });
    fireEvent.click(workspaceTab);

    const textarea = screen.getByLabelText("Workspace Code");
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "test('custom test', async () => {})" } });

    const runBtn = screen.getByRole("button", { name: /Execute Playwright Tests/i });
    fireEvent.click(runBtn);

    expect(onRunJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "projectsts",
        source: "workspace",
        code: "test('custom test', async () => {})",
        browsers: ["chromium"],
        mode: "headless",
      }),
    );
  });
});
