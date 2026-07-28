import { describe, expect, it } from "vitest";
import { resolveExecutable, parseAgentConfig } from "../../../agent/src/config";

describe("Local Agent Config & Resolver", () => {
  it("resolves npm and npx to .cmd on Windows", () => {
    expect(resolveExecutable("npx", "win32")).toBe("npx.cmd");
    expect(resolveExecutable("npm", "win32")).toBe("npm.cmd");
    expect(resolveExecutable("node", "win32")).toBe("node");
    expect(resolveExecutable("npx", "linux")).toBe("npx");
  });

  it("parses valid agent config with absolute cwd", () => {
    const raw = {
      agentId: "agent-win-1",
      serverUrl: "http://localhost:3000",
      agentToken: "secret-token-32-chars-at-least-123",
      projects: [
        {
          id: "student-tracking",
          name: "Student Tracking System",
          presets: [
            {
              id: "cypress-e2e",
              name: "Cypress E2E",
              description: "Run Cypress suite",
              command: "npx",
              args: ["cypress", "run"],
              cwd: "E:\\project-monitor",
              timeoutSeconds: 300,
            },
          ],
        },
      ],
    };

    const config = parseAgentConfig(raw);
    expect(config.agentId).toBe("agent-win-1");
    expect(config.projects[0].presets[0].cwd).toBe("E:\\project-monitor");
  });

  it("rejects non-absolute cwd path", () => {
    const raw = {
      agentId: "agent-win-1",
      serverUrl: "http://localhost:3000",
      agentToken: "secret-token-32-chars-at-least-123",
      projects: [
        {
          id: "student-tracking",
          name: "Student Tracking System",
          presets: [
            {
              id: "cypress-e2e",
              name: "Cypress E2E",
              description: "Run Cypress suite",
              command: "npx",
              cwd: "./relative/path",
            },
          ],
        },
      ],
    };

    expect(() => parseAgentConfig(raw)).toThrow();
  });
});
