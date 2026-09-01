import { describe, expect, it } from "vitest";
import { buildCatalogFromConfig, buildSafeRunSummary } from "../../../agent/src/runner";
import type { AgentConfig, PlaywrightJob } from "../../../agent/src/types";

describe("Agent Runner & Catalog Builder", () => {
  it("builds clean TestProjectCatalog from AgentConfig", () => {
    const config: AgentConfig = {
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
              description: "Run Cypress tests",
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

    const catalog = buildCatalogFromConfig(config);
    expect(catalog.version).toBe("1.0.0");
    expect(catalog.projects).toHaveLength(1);
    expect(catalog.projects[0].presets[0].commandPreview).toBe("npx cypress run");
  });

  it("builds safe run summary with metadata and excludes secrets, paths, and commands", () => {
    const job: PlaywrightJob = {
      id: "plw-1",
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      source: "project-test",
      testIds: ["test-1", "test-2"],
      browsers: ["chromium"],
      mode: "headless",
      status: "claimed",
      browserResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const project = {
      id: "sts-playwright",
      name: "STS Playwright Automation",
      playwright: {
        workspaceRoot: "E:\\ProjectSTS",
        testRoot: "frontend/e2e",
        config: "frontend/playwright.config.ts",
      },
    };

    const summary = buildSafeRunSummary(job, project, ["auth/login.spec.ts", "auth/logout.spec.ts"]);
    expect(summary).toEqual([
      "[RUN] Project: sts-playwright",
      "[RUN] Source: Project tests",
      "[RUN] Tests: 2 selected (auth/login.spec.ts, auth/logout.spec.ts)",
      "[RUN] Browsers: chromium",
      "[RUN] Mode: headless",
    ]);

    const serialized = summary.join("\n");
    expect(serialized).not.toContain("E:\\");
    expect(serialized).not.toContain("C:\\");
    expect(serialized).not.toContain("workspaceRoot");
    expect(serialized).not.toContain("agentToken");
    expect(serialized).not.toContain("playwright.config.ts");
  });

  it("builds safe run summary for workspace draft", () => {
    const job: PlaywrightJob = {
      id: "plw-2",
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      source: "workspace",
      code: "test('something', () => {})",
      browsers: ["chromium", "firefox"],
      mode: "headed",
      status: "claimed",
      browserResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const summary = buildSafeRunSummary(job);
    expect(summary).toEqual([
      "[RUN] Project: sts-playwright",
      "[RUN] Source: Workspace draft",
      "[RUN] Tests: Workspace spec",
      "[RUN] Browsers: chromium, firefox",
      "[RUN] Mode: headed",
    ]);
  });

  it("builds safe run summary for interactive UI mode", () => {
    const job: PlaywrightJob = {
      id: "plw-interactive",
      agentId: "agent-win-1",
      projectId: "sts-playwright",
      source: "project-test",
      testIds: ["auth-1"],
      browsers: ["chromium"],
      mode: "interactive",
      status: "claimed",
      browserResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const summary = buildSafeRunSummary(job);
    expect(summary).toEqual([
      "[UI] Interactive session opened on Local Agent desktop",
      "[UI] Project: sts-playwright",
      "[UI] Selected tests: 1",
      "[UI] Browser: chromium",
      "[UI] Maximum duration: 30 minutes",
    ]);
  });
});
