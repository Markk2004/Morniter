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

  it("renders workspace, tutorial launcher, and all 9 target wrappers", async () => {
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

    // Tutorial auto-opens on first visit
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /Playwright Automation Tutorial/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/ขั้นตอน 1 จาก 9/i)).toBeInTheDocument();
    });

    // Close tutorial modal
    fireEvent.click(screen.getByRole("button", { name: /Skip Tutorial/i }));
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
      expect(document.querySelector(`[data-tutorial-id="${targetId}"]`)).not.toBeNull();
    }

    // Manual tutorial trigger button re-opens at step 1
    const tutorialBtn = screen.getByRole("button", {
      name: /เปิด Tutorial การใช้งาน Playwright/i,
    });
    fireEvent.click(tutorialBtn);

    expect(
      screen.getByRole("dialog", { name: /Playwright Automation Tutorial/i }),
    ).toBeInTheDocument();
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

    // Tutorial dialog MUST NOT be opened
    expect(
      screen.queryByRole("dialog", { name: /Playwright Automation Tutorial/i }),
    ).not.toBeInTheDocument();
  });
});
