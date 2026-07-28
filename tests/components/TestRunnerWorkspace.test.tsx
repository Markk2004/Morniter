// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TestRunnerWorkspace } from "@/components/test-runner/TestRunnerWorkspace";

afterEach(() => {
  cleanup();
});

describe("TestRunnerWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/test-runner/lock")) {
          return { ok: true, json: async () => ({ unlocked: false }) };
        }
        if (url.includes("/api/test-runner/catalog")) {
          return {
            ok: true,
            json: async () => ({
              catalog: {
                version: "1.0.0",
                updatedAt: "2026-07-28T10:00:00.000Z",
                projects: [
                  {
                    id: "student-tracking",
                    name: "Student Tracking System",
                    presets: [
                      {
                        id: "cypress-e2e",
                        name: "Cypress E2E Suite",
                        description: "Run Cypress suite",
                        commandPreview: "npx cypress run",
                        timeoutSeconds: 300,
                        category: "automated",
                        srsIds: [],
                        risk: "safe",
                        databaseTarget: "none",
                      },
                    ],
                  },
                ],
              },
              presence: {
                agentId: "agent-win-1",
                state: "online",
                lastHeartbeatAt: "2026-07-28T10:00:00.000Z",
              },
            }),
          };
        }
        if (url.includes("/api/test-runner/jobs")) {
          return { ok: true, json: async () => ({ jobs: [] }) };
        }
        return { ok: false, json: async () => ({}) };
      }),
    );
  });

  it("renders workspace dropdowns, presence, and disabled run button when execution is locked", async () => {
    render(<TestRunnerWorkspace />);

    expect(await screen.findByText(/Local Agent Online/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Project")).toHaveValue("student-tracking");

    fireEvent.change(screen.getByLabelText("Test command"), { target: { value: "cypress-e2e" } });
    expect(screen.getByText(/Run Cypress suite/i)).toBeInTheDocument();

    const runBtn = screen.getByRole("button", { name: /Unlock Execution Required/i });
    expect(runBtn).toBeDisabled();
  });
});
