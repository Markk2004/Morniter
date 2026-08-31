import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  resolveInsideRoot,
  generateTestId,
  detectBrowserCapabilities,
  scanPlaywrightProject,
  buildPlaywrightCatalogFromConfig,
} from "../../../agent/src/playwright-catalog";
import {
  buildSafeTestEnv,
  preparePlaywrightExecution,
} from "../../../agent/src/playwright-executor";
import type { AgentConfig, PlaywrightJob } from "../../../agent/src/types";

describe("Local Agent Playwright Runner", () => {
  it("resolves paths safely inside workspaceRoot and blocks path traversal", () => {
    const root = path.resolve(os.tmpdir(), "test-workspace-root");
    const safePath = resolveInsideRoot(root, "e2e/auth.spec.ts");
    expect(safePath.startsWith(root)).toBe(true);

    expect(() => resolveInsideRoot(root, "../secret.ts")).toThrow(/escapes/);
    expect(() => resolveInsideRoot(root, "e2e/../../secret.ts")).toThrow(/escapes/);
  });

  it("generates deterministic and sanitized test IDs", () => {
    const id1 = generateTestId("e2e/auth/login.spec.ts", "Login Flow");
    const id2 = generateTestId("e2e/auth/login.spec.ts", "Login Flow");
    expect(id1).toBe(id2);
    expect(id1).toContain("login");
  });

  it("discovers only Playwright files and groups them by the first test folder", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-playwright-catalog-"));
    await fs.mkdir(path.join(root, "e2e", "auth"), { recursive: true });
    await fs.mkdir(path.join(root, "e2e", "students"), { recursive: true });
    await fs.writeFile(
      path.join(root, "e2e", "auth", "login.spec.ts"),
      'import { test } from "@playwright/test";\ntest("login page", async () => {});',
    );
    await fs.writeFile(
      path.join(root, "e2e", "students", "service.test.ts"),
      'import test from "node:test";\ntest("not a browser test", () => {});',
    );

    const result = await scanPlaywrightProject(root, "e2e");

    expect(result.tests).toHaveLength(1);
    expect(result.tests[0]).toMatchObject({
      title: "login page",
      group: "Authentication",
      relativePath: "e2e/auth/login.spec.ts",
    });
    expect(result.sourceByPath[result.tests[0].relativePath]).toContain("@playwright/test");
    expect(result.scanPathLabel).toBe(`${path.basename(root)}/e2e`);

    await fs.rm(root, { recursive: true, force: true });
  });

  it("publishes canonical Playwright IDs for coverage rows", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-playwright-coverage-"));
    await fs.mkdir(path.join(root, "e2e", "auth"), { recursive: true });
    await fs.writeFile(
      path.join(root, "e2e", "auth", "login.spec.ts"),
      'import { test } from "@playwright/test";\ntest("login page", async () => {});',
    );
    await fs.writeFile(
      path.join(root, "map.json"),
      JSON.stringify({
        version: 1,
        projectId: "example",
        scanRoots: [{ path: "e2e", runner: "playwright", executable: true }],
        excludeDirectories: [],
        generatedRoot: "e2e/generated",
        functions: [{ id: "auth", name: "Authentication", keywords: ["login"] }],
        explicitMappings: [{ path: "e2e/auth/login.spec.ts", functionId: "auth" }],
        coverageTargets: [],
        recipes: [],
      }),
    );

    const config: AgentConfig = {
      agentId: "agent-coverage",
      serverUrl: "http://localhost:3000",
      agentToken: "token-1234567890123456",
      projects: [{
        id: "example",
        name: "Example",
        playwright: {
          workspaceRoot: root,
          testRoot: "e2e",
          automationMap: "map.json",
        },
      }],
    };

    const catalog = await buildPlaywrightCatalogFromConfig(config);
    const project = catalog.projects[0];
    const canonicalId = project.tests?.[0]?.id;
    const coverageGroup = project.coverageGroups?.[0];
    const coverageId = coverageGroup?.tests[0]?.id;

    expect(canonicalId).toBeDefined();
    expect(coverageId).toBe(canonicalId);
    expect(coverageGroup?.functionId).toBe("auth");
    expect(coverageGroup?.functionName).toBe("Authentication");
    await fs.rm(root, { recursive: true, force: true });
  });

  it("builds safe test environment excluding all server secrets", () => {
    const sourceEnv = {
      PATH: "/usr/bin",
      NODE_ENV: "production",
      TEST_RUNNER_AGENT_TOKEN: "secret-agent-token",
      UPSTASH_REDIS_REST_TOKEN: "secret-redis-token",
      SESSION_SIGNING_SECRET: "secret-session-key",
      STS_UAT_BASE_URL: "http://localhost:3000",
    };

    const safeEnv = buildSafeTestEnv(["STS_UAT_BASE_URL", "TEST_RUNNER_AGENT_TOKEN"], sourceEnv);
    expect(safeEnv.NODE_ENV).toBe("test");
    expect(safeEnv.PATH).toBe("/usr/bin");
    expect(safeEnv.STS_UAT_BASE_URL).toBe("http://localhost:3000");
    expect(safeEnv.TEST_RUNNER_AGENT_TOKEN).toBeUndefined();
    expect(safeEnv.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
    expect(safeEnv.SESSION_SIGNING_SECRET).toBeUndefined();
  });

  it("prepares workspace code execution and cleans up temporary spec file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-playwright-test-"));
    const config: AgentConfig = {
      agentId: "agent-1",
      serverUrl: "http://localhost:3000",
      agentToken: "token-1234567890123456",
      projects: [
        {
          id: "projectsts",
          name: "ProjectSTS",
          playwright: {
            workspaceRoot: tempDir,
            testRoot: "e2e",
            allowedBrowsers: ["chromium", "firefox"],
            allowHeaded: true,
            allowWorkspaceExecution: true,
          },
        },
      ],
    };

    const job: PlaywrightJob = {
      id: "job-workspace-1",
      agentId: "agent-1",
      projectId: "projectsts",
      source: "workspace",
      code: "import { test } from '@playwright/test'; test('sample', () => {});",
      browsers: ["chromium"],
      mode: "headless",
      status: "claimed",
      browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const prepared = await preparePlaywrightExecution(config, job);
    expect(prepared.args).toContain("playwright");
    expect(prepared.args).toContain("test");
    expect(prepared.args).toContain("--project=chromium");

    // Spec file should exist during execution
    const specPath = prepared.args[3];
    const fileExists = await fs.stat(specPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Call cleanup
    await prepared.cleanup();
    const fileStillExists = await fs.stat(specPath).then(() => true).catch(() => false);
    expect(fileStillExists).toBe(false);

    // Cleanup temp dir
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("detects browser capabilities accurately from config", () => {
    const caps = detectBrowserCapabilities({
      agentId: "agent-1",
      serverUrl: "http://localhost:3000",
      agentToken: "token-1234567890123456",
      projects: [
        {
          id: "projectsts",
          name: "ProjectSTS",
          playwright: {
            workspaceRoot: os.tmpdir(),
            allowedBrowsers: ["chromium", "firefox"],
            allowHeaded: true,
          },
        },
      ],
    });

    expect(caps.browsers.chromium).toBe(true);
    expect(caps.browsers.firefox).toBe(true);
    expect(caps.browsers.webkit).toBe(false);
    expect(caps.headed).toBe(true);
  });
});
