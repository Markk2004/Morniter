// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import TestRunnerWorkspace from "@/components/test-runner/TestRunnerWorkspace";

describe("TestRunnerWorkspace Dropdown Components", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders offline status when no agent catalog is available", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/api/playwright-runner/catalog") || href.includes("/api/test-runner/catalog")) {
        return new Response(JSON.stringify({ catalog: null, presence: { state: "offline" } }), { status: 200 });
      }
      if (href.includes("/api/playwright-runner/jobs") || href.includes("/api/test-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(<TestRunnerWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Offline/i)).toBeInTheDocument();
    });
  });

  it("requires an explicit test selection via Project and Playwright test checklist", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/api/playwright-runner/catalog") || href.includes("/api/test-runner/catalog")) {
        return new Response(
          JSON.stringify({
            presence: { state: "online", agentId: "agent-win-1" },
            catalog: {
              version: "2.0.0",
              updatedAt: new Date().toISOString(),
              projects: [
                {
                  id: "student-tracking",
                  name: "Student Tracking System",
                  capabilities: {
                    browsers: { chromium: true, firefox: true, webkit: true },
                    headed: true,
                    workspaceExecution: true,
                  },
                  tests: [
                    {
                      id: "cypress-e2e",
                      title: "Cypress E2E Suite",
                      group: "E2E",
                      relativePath: "cypress/e2e/suite.spec.ts",
                    },
                    {
                      id: "execution-br-006",
                      title: "Execution BR-006",
                      group: "Cases",
                      relativePath: "e2e/cases.spec.ts",
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      if (href.includes("/api/playwright-runner/jobs") || href.includes("/api/test-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(<TestRunnerWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Online/i)).toBeInTheDocument();
      expect(screen.getByText(/Cypress E2E Suite/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Project")).toHaveValue("student-tracking");
    expect(screen.getByRole("button", { name: "Unlock Execution Required" })).toBeDisabled();
  });
});
