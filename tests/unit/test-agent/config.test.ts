import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  expandPresetEnvironment,
  resolveExecutable,
  parseAgentConfig,
  resolvePreset,
  buildCatalogFromConfig,
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
              metadata: { category: "automated", srsIds: [], risk: "safe", databaseTarget: "none" },
            },
          ],
        },
      ],
    };

    const config = parseAgentConfig(raw);
    expect(config.agentId).toBe("agent-win-1");
    expect(config.projects[0].presets?.[0].cwd).toBe("E:\\project-monitor");
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
              metadata: { category: "automated", srsIds: [], risk: "safe", databaseTarget: "none" },
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

  it("rejects unsafe category and database combinations", () => {
    const base = {
      agentId: "agent-win-1",
      serverUrl: "http://localhost:3000",
      agentToken: "secret-token-32-chars-at-least-123",
      projects: [{
        id: "student-tracking",
        name: "Student Tracking System",
        presets: [{
          id: "unsafe",
          name: "Unsafe",
          description: "",
          command: "node",
          cwd: "E:\\project-monitor",
          metadata: { category: "execution", srsIds: [], risk: "safe", databaseTarget: "none" },
        }],
      }],
    };

    expect(() => parseAgentConfig(base)).toThrow(/execution presets/);
    expect(() => parseAgentConfig({
      ...base,
      projects: [{ ...base.projects[0], presets: [{ ...base.projects[0].presets[0], id: "uat", metadata: { category: "uat", srsIds: [], risk: "mutating", databaseTarget: "defaultdb" } }] }],
    })).toThrow(/uat presets/);
    expect(() => parseAgentConfig({
      ...base,
      projects: [{ ...base.projects[0], presets: [{ ...base.projects[0].presets[0], id: "prod", metadata: { category: "automated", srsIds: [], risk: "mutating", databaseTarget: "production" } }] }],
    })).toThrow(/production/);
  });

  it("publishes only metadata, not expanded environment values, in the catalog", () => {
    const raw = JSON.parse(fs.readFileSync("test-runner.config.local.json", "utf8"));
    const config = parseAgentConfig(raw);
    const catalog = buildCatalogFromConfig(config);
    const presets = catalog.projects.flatMap((project) => project.presets);
    expect(presets.length).toBeGreaterThan(10);
    expect(presets.every((preset) => preset.category && preset.risk && preset.databaseTarget)).toBe(true);
    expect(presets.some((preset) => preset.category === "execution" && preset.databaseTarget === "defaultdb")).toBe(true);
    expect(presets.some((preset) => preset.category === "uat" && preset.databaseTarget === "none")).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain("STS_TEST_DATABASE_URL");
    expect(JSON.stringify(catalog)).not.toContain("STS_UAT_PASSWORD");
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
          metadata: { category: "execution", srsIds: ["FR-AUTH-001"], risk: "mutating", databaseTarget: "defaultdb" },
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
