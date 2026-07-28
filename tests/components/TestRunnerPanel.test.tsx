// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TestRunnerWorkspace from "@/components/test-runner/TestRunnerWorkspace";

describe("TestRunnerWorkspace Dropdown Components", () => {
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

    render(<TestRunnerWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Offline/i)).toBeInTheDocument();
    });
  });

  it("requires an explicit test selection via Project and Test command dropdowns", async () => {
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
                      category: "automated",
                      srsIds: [],
                      risk: "safe",
                      databaseTarget: "none",
                    },
                    {
                      id: "execution-br-006",
                      name: "Execution BR-006",
                      description: "Case close group",
                      commandPreview: "npx jest ... BR-006",
                      timeoutSeconds: 900,
                      category: "execution",
                      srsIds: ["BR-006"],
                      risk: "mutating",
                      databaseTarget: "defaultdb",
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

    render(<TestRunnerWorkspace />);

    await waitFor(() => {
      expect(screen.getByText(/Local Agent Online/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Project")).toHaveValue("student-tracking");
    expect(screen.getByLabelText("Test command")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Unlock Execution Required" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Test command"), { target: { value: "cypress-e2e" } });

    expect(screen.getByText(/Runs full Cypress tests/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock Execution Required" })).toBeDisabled(); // Disabled because execution is locked
  });
});
