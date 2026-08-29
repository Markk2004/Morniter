// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TestRunnerWorkspace } from "@/components/test-runner/TestRunnerWorkspace";

afterEach(() => {
  cleanup();
});

describe("TestRunnerWorkspace with Playwright", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/test-runner/lock")) {
          return { ok: true, json: async () => ({ unlocked: false }) };
        }
        if (url.includes("/api/playwright-runner/catalog")) {
          return {
            ok: true,
            json: async () => ({
              catalog: {
                version: "2.0.0",
                updatedAt: "2026-08-29T10:00:00.000Z",
                projects: [
                  {
                    id: "student-tracking",
                    name: "Student Tracking System",
                    capabilities: {
                      browsers: { chromium: true, firefox: true, webkit: false },
                      headed: true,
                      workspaceExecution: true,
                    },
                    tests: [
                      {
                        id: "auth-login",
                        title: "Login Flow",
                        group: "Auth",
                        relativePath: "e2e/auth.spec.ts",
                      },
                    ],
                  },
                ],
              },
              presence: {
                agentId: "agent-win-1",
                state: "online",
                lastHeartbeatAt: "2026-08-29T10:00:00.000Z",
              },
            }),
          };
        }
        if (url.includes("/api/playwright-runner/jobs")) {
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

    expect(screen.getByText(/Login Flow/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Select Chromium")).toBeChecked();

    const runBtn = screen.getByRole("button", { name: /Unlock Execution Required/i });
    expect(runBtn).toBeDisabled();
  });
});
