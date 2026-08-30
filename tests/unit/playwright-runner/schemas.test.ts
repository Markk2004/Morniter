import { describe, expect, it } from "vitest";
import {
  AppendPlaywrightLogBatchSchema,
  PlaywrightCatalogSchema,
  PlaywrightCompleteJobSchema,
  PlaywrightHeartbeatSchema,
  PlaywrightJobRequestSchema,
  PlaywrightPollRequestSchema,
  sanitizeBrowsers,
} from "@/lib/playwright-runner/schemas";

describe("Playwright Runner Zod Schemas", () => {
  it("parses valid existing test job request", () => {
    const valid = PlaywrightJobRequestSchema.parse({
      projectId: "projectsts",
      source: "project-test",
      testIds: ["auth-login-valid", "student-create"],
      browsers: ["chromium", "firefox"],
      mode: "headed",
    });

    expect(valid.projectId).toBe("projectsts");
    expect(valid.source).toBe("project-test");
    if (valid.source === "project-test") {
      expect(valid.testIds).toHaveLength(2);
    }
  });

  it("parses valid workspace code job request", () => {
    const valid = PlaywrightJobRequestSchema.parse({
      projectId: "projectsts",
      source: "workspace",
      code: "import { test } from '@playwright/test';",
      browsers: ["chromium"],
      mode: "headless",
    });

    expect(valid.source).toBe("workspace");
    if (valid.source === "workspace") {
      expect(valid.code).toContain("import");
    }
  });

  it("rejects workspace job request without code", () => {
    expect(() =>
      PlaywrightJobRequestSchema.parse({
        projectId: "projectsts",
        source: "workspace",
        browsers: ["chromium"],
        mode: "headless",
      }),
    ).toThrow();
  });

  it("rejects project-test job request without testIds", () => {
    expect(() =>
      PlaywrightJobRequestSchema.parse({
        projectId: "projectsts",
        source: "project-test",
        browsers: ["chromium"],
        mode: "headless",
      }),
    ).toThrow();
  });

  it("rejects arbitrary command or cwd in request payload", () => {
    expect(() =>
      PlaywrightJobRequestSchema.parse({
        projectId: "projectsts",
        source: "project-test",
        testIds: ["auth-login"],
        browsers: ["chromium"],
        mode: "headless",
        command: "rm -rf /",
      }),
    ).toThrow();
  });

  it("sanitizes duplicate browsers correctly", () => {
    const result = sanitizeBrowsers(["chromium", "firefox", "chromium"]);
    expect(result).toEqual(["chromium", "firefox"]);
  });

  it("validates PlaywrightPollRequestSchema from local agent", () => {
    const valid = PlaywrightPollRequestSchema.parse({
      agentId: "windows-agent-1",
      catalogVersion: "2.0.0",
      capabilities: {
        browsers: { chromium: true, firefox: true, webkit: false },
        headed: true,
        workspaceExecution: true,
      },
    });
    expect(valid.agentId).toBe("windows-agent-1");
  });

  it("validates PlaywrightCatalogSchema with test groups", () => {
    const valid = PlaywrightCatalogSchema.parse({
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "projectsts",
          name: "ProjectSTS",
          testGroups: [
            {
              name: "Auth",
              tests: [
                {
                  id: "auth-1",
                  title: "Login",
                  group: "Auth",
                  relativePath: "e2e/auth.spec.ts",
                },
              ],
            },
          ],
        },
      ],
    });
    expect(valid.projects).toHaveLength(1);
  });

  it("validates AppendPlaywrightLogBatchSchema with browser tag", () => {
    const valid = AppendPlaywrightLogBatchSchema.parse({
      sequenceStart: 0,
      entries: [
        { stream: "stdout", message: "[chromium] ✓ Passed", browser: "chromium" },
      ],
      browserResults: [
        {
          browser: "chromium",
          status: "passed",
          passed: 1,
          failed: 0,
          skipped: 0,
          durationMs: 1200,
        },
      ],
    });
    expect(valid.entries).toHaveLength(1);
    expect(valid.browserResults).toHaveLength(1);
  });

  it("validates PlaywrightHeartbeatSchema and CompleteJobSchema", () => {
    const hb = PlaywrightHeartbeatSchema.parse({
      observedAt: new Date().toISOString(),
    });
    expect(hb.observedAt).toBeDefined();

    const complete = PlaywrightCompleteJobSchema.parse({
      status: "passed",
      artifacts: [
        {
          id: "art-1",
          jobId: "job-1",
          type: "trace",
          filename: "trace.zip",
          size: 1024,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(complete.status).toBe("passed");
  });

  it("validates PlaywrightCatalogSchema with coverageGroups and runner profiles", () => {
    const valid = PlaywrightCatalogSchema.parse({
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "sts-playwright",
          name: "ProjectSTS",
          coverageGroups: [
            {
              id: "FN-STS-01",
              name: "Authentication",
              tests: [
                {
                  id: "test-auth-1",
                  title: "Login spec",
                  relativePath: "frontend/e2e/auth/login.spec.ts",
                  runner: "playwright",
                  executionProfileId: "frontend-playwright",
                  executable: true,
                  risk: "read-only",
                  origin: "manual",
                  confidence: "high",
                  matchedBy: ["path"],
                },
              ],
              gaps: [],
            },
          ],
        },
      ],
    });
    expect(valid.projects[0].coverageGroups).toHaveLength(1);
    expect(valid.projects[0].coverageGroups?.[0].tests[0].executionProfileId).toBe("frontend-playwright");
  });

  it("validates PlaywrightCatalogSchema with testTarget", () => {
    const valid = PlaywrightCatalogSchema.parse({
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      projects: [
        {
          id: "sts-playwright",
          name: "ProjectSTS",
          testTarget: {
            id: "projectsts-uat",
            label: "ProjectSTS UAT",
            allowMutating: true,
          },
        },
      ],
    });
    expect(valid.projects[0].testTarget?.id).toBe("projectsts-uat");
    expect(valid.projects[0].testTarget?.allowMutating).toBe(true);
  });
});
