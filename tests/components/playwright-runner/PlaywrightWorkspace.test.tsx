// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { PlaywrightWorkspace } from "@/components/playwright-runner/PlaywrightWorkspace";
import { TUTORIAL_STORAGE_KEY } from "@/components/playwright-runner/tutorial/tutorial-steps";

describe("PlaywrightWorkspace Main Integration Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders workspace, tutorial launcher, and replaces workspace with Learning mode", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/api/test-runner/lock")) {
        return new Response(JSON.stringify({ unlocked: true }), { status: 200 });
      }
      if (href.includes("/api/playwright-runner/catalog")) {
        return new Response(
          JSON.stringify({
            presence: { state: "online", agentId: "agent-win-1" },
            catalog: {
              version: "2.0.0",
              updatedAt: new Date().toISOString(),
              projects: [
                {
                  id: "projectsts",
                  name: "ProjectSTS",
                  rootLabel: "frontend",
                  scanPathLabel: "frontend/e2e",
                  capabilities: {
                    browsers: { chromium: true, firefox: true, webkit: true },
                    headed: true,
                    workspaceExecution: true,
                  },
                  testGroups: [
                    {
                      name: "Authentication",
                      tests: [
                        {
                          id: "test-login",
                          title: "User login test",
                          group: "Authentication",
                          relativePath: "e2e/auth/login.spec.ts",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      if (href.includes("/api/playwright-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(<PlaywrightWorkspace />);

    // Learning Mode auto-opens on first visit
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /Playwright Automation Learning Mode/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("tutorial-learning-stage")).toBeInTheDocument();
      expect(screen.getByText(/ขั้นตอน 1 จาก 9/i)).toBeInTheDocument();
    });

    // Skip tutorial
    fireEvent.click(screen.getByRole("button", { name: /ข้าม Tutorial/i }));
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe("true");

    // Verify workspace components and 9 tutorial targets
    expect(screen.getByText(/Local Agent Online/i)).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Authentication"));
    expect(screen.getByText(/User login test/i)).toBeInTheDocument();

    const expectedTargets = [
      "agent",
      "execution-lock",
      "project",
      "select-test",
      "browsers",
      "code",
      "run",
      "terminal",
      "result",
    ];

    for (const targetId of expectedTargets) {
      const elements = document.querySelectorAll(`[data-tutorial-id="${targetId}"]`);
      expect(elements).toHaveLength(1);
    }

    // Manual tutorial trigger button re-opens Learning mode at step 1
    const tutorialBtn = screen.getByRole("button", {
      name: /เปิด Tutorial การใช้งาน Playwright/i,
    });
    fireEvent.click(tutorialBtn);

    expect(
      screen.getByRole("region", { name: /Playwright Automation Learning Mode/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-learning-stage")).toBeInTheDocument();

    // Close tutorial with ออกจาก Tutorial
    fireEvent.click(screen.getByRole("button", { name: /ออกจาก Tutorial/i }));
    expect(
      screen.queryByRole("region", { name: /Playwright Automation Learning Mode/i }),
    ).toBeNull();
  });

  it("does not auto-open tutorial and displays error banner when catalog loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/api/playwright-runner/catalog")) {
        return new Response(JSON.stringify({ error: "Agent connection failed" }), {
          status: 500,
        });
      }
      if (href.includes("/api/test-runner/lock")) {
        return new Response(JSON.stringify({ unlocked: false }), { status: 200 });
      }
      if (href.includes("/api/playwright-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(<PlaywrightWorkspace />);

    // Wait for catalog load failure
    await waitFor(() => {
      expect(screen.getByText(/ไม่สามารถโหลด Playwright Catalog ได้/i)).toBeInTheDocument();
    });

    // Learning Mode region MUST NOT be opened
    expect(
      screen.queryByRole("region", { name: /Playwright Automation Learning Mode/i }),
    ).not.toBeInTheDocument();
  });

  it("tracks unread logs via effect and clears count when terminal expands", async () => {
    let jobPollCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const href = String(url);
      const method = init?.method || "GET";

      if (href.includes("/api/playwright-runner/catalog")) {
        return new Response(
          JSON.stringify({
            presence: { state: "online", agentId: "agent-win-1" },
            catalog: {
              version: "2.0.0",
              updatedAt: new Date().toISOString(),
              projects: [
                {
                  id: "projectsts",
                  name: "ProjectSTS",
                  rootLabel: "frontend",
                  scanPathLabel: "frontend/e2e",
                  capabilities: {
                    browsers: { chromium: true },
                    headed: true,
                    workspaceExecution: true,
                  },
                  testGroups: [
                    {
                      name: "Authentication",
                      tests: [
                        {
                          id: "test-login",
                          title: "User login test",
                          group: "Authentication",
                          relativePath: "e2e/auth/login.spec.ts",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      if (href.includes("/api/test-runner/lock")) {
        return new Response(JSON.stringify({ unlocked: true }), { status: 200 });
      }
      if (href.includes("/api/playwright-runner/jobs/job-active-1")) {
        jobPollCount += 1;
        return new Response(
          JSON.stringify({
            job: {
              id: "job-active-1",
              status: "running",
              createdAt: new Date().toISOString(),
              target: { projectId: "projectsts", selectedTestIds: ["test-login"] },
            },
            logs:
              jobPollCount > 1
                ? [
                    {
                      sequence: 1,
                      timestamp: new Date().toISOString(),
                      stream: "stdout",
                      message: "Step 1 passed",
                    },
                  ]
                : [],
            nextSequence: jobPollCount > 1 ? 2 : 1,
          }),
          { status: 200 },
        );
      }
      if (method === "POST" && href.includes("/api/playwright-runner/jobs")) {
        return new Response(
          JSON.stringify({
            id: "job-active-1",
            status: "running",
            createdAt: new Date().toISOString(),
            target: { projectId: "projectsts", selectedTestIds: ["test-login"] },
          }),
          { status: 200 },
        );
      }
      if (href.includes("/api/playwright-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<PlaywrightWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ข้าม Tutorial/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /ข้าม Tutorial/i }));

    // 1. Terminal is expanded initially - no unread badge
    expect(screen.queryByText(/new/i)).not.toBeInTheDocument();

    // 2. Collapse terminal
    const collapseBtn = screen.getByRole("button", { name: /Collapse Terminal/i });
    fireEvent.click(collapseBtn);
    expect(screen.getByRole("button", { name: /Expand Terminal/i })).toBeInTheDocument();

    // Select test and trigger Run
    fireEvent.click(screen.getByText("Authentication"));
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const runBtn = screen.getByRole("button", { name: /Run/i });
    fireEvent.click(runBtn);

    // 3. New terminal log arrives while collapsed -> unread badge appears
    await waitFor(() => {
      expect(screen.getByText(/new/i)).toBeInTheDocument();
    });

    // 4. Expand terminal -> unread badge is cleared
    const expandBtn = screen.getByRole("button", { name: /Expand Terminal/i });
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.queryByText(/new/i)).not.toBeInTheDocument();
    });

    // 5. Verify no render-phase update warnings were logged
    const renderPhaseWarnings = consoleErrorSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes("Cannot update a component")),
    );
    expect(renderPhaseWarnings).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
});
