// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { PlaywrightWorkspace } from "@/components/playwright-runner/PlaywrightWorkspace";

afterEach(() => {
  cleanup();
});

describe("PlaywrightWorkspace Main Integration Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders full Playwright automation workspace with project, explorer, and editor", async () => {
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

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Online/i)).toBeInTheDocument();
      expect(screen.getByText(/User login test/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Code Workspace/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /Select User login test/i }));
    expect(screen.getByText(/Run 1 Test/i)).toBeInTheDocument();
  });
});
