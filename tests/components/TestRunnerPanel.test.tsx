// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TestRunnerPanel from "@/components/test-runner/TestRunnerPanel";

describe("TestRunnerPanel Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders offline status when no agent catalog is available", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/api/test-runner/catalog")) {
        return new Response(JSON.stringify({ catalog: null, online: false }), { status: 200 });
      }
      if (href.includes("/api/test-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(<TestRunnerPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Offline/i)).toBeInTheDocument();
    });
  });

  it("renders project/preset selector when agent catalog is online", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/api/test-runner/catalog")) {
        return new Response(
          JSON.stringify({
            online: true,
            presence: { state: "online", agentId: "agent-win-1" },
            catalog: {
              version: "1.0.0",
              updatedAt: new Date().toISOString(),
              projects: [
                {
                  id: "student-tracking",
                  name: "Student Tracking System",
                  presets: [
                    {
                      id: "cypress-e2e",
                      name: "Cypress E2E Suite",
                      description: "Runs full Cypress tests",
                      commandPreview: "npx cypress run",
                      timeoutSeconds: 300,
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      if (href.includes("/api/test-runner/jobs")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(<TestRunnerPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Online/i)).toBeInTheDocument();
      expect(screen.getByText(/Cypress E2E Suite/i)).toBeInTheDocument();
      expect(screen.getByText(/npx cypress run/i)).toBeInTheDocument();
    });
  });
});
