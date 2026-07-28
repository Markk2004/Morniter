import { describe, expect, it } from "vitest";
import {
  expandPresetEnvironment,
  resolveExecutable,
  parseAgentConfig,
  resolvePreset,
} from "../../../agent/src/config";

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

  it("expands preset environment references before execution", () => {
    expect(expandPresetEnvironment(
      { NODE_ENV: "test", DATABASE_URL: "${STS_TEST_DATABASE_URL}" },
      { STS_TEST_DATABASE_URL: "postgres://secret@host/defaultdb" },
    )).toEqual({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://secret@host/defaultdb",
    });
  });

  it("rejects a missing environment reference", () => {
    expect(() => expandPresetEnvironment(
      { DATABASE_URL: "${MISSING_DATABASE_URL}" },
      {},
    )).toThrow("MISSING_DATABASE_URL");
  });

  it("resolves preset environment references without exposing them in the catalog", () => {
    const originalTestUrl = process.env.STS_TEST_DATABASE_URL;
    process.env.STS_TEST_DATABASE_URL = "postgres://secret@host/defaultdb";

    const config = parseAgentConfig({
      agentId: "agent-win-1",
      serverUrl: "http://localhost:3000",
      agentToken: "secret-token-32-chars-at-least-123",
      projects: [{
        id: "student-tracking",
        name: "Student Tracking System",
        presets: [{
          id: "backend-e2e-aiven",
          name: "STS Backend E2E",
          description: "Run E2E",
          command: "npm",
          args: ["run", "test:e2e"],
          cwd: "E:\\ProjectSTS\\backend",
          env: { DATABASE_URL: "${STS_TEST_DATABASE_URL}" },
        }],
      }],
    });

    try {
      expect(resolvePreset(config, "student-tracking", "backend-e2e-aiven").env)
        .toEqual({ DATABASE_URL: "postgres://secret@host/defaultdb" });
    } finally {
      if (originalTestUrl === undefined) {
        delete process.env.STS_TEST_DATABASE_URL;
      } else {
        process.env.STS_TEST_DATABASE_URL = originalTestUrl;
      }
    }
  });
});
