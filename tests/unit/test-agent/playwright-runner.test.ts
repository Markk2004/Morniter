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
  runPlaywrightExecution,
  type PreparedPlaywrightRun,
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
    const specPath = path.resolve(prepared.cwd, prepared.args[3]);
    const fileExists = await fs.stat(specPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Call cleanup
    await prepared.cleanup();
    const fileStillExists = await fs.stat(specPath).then(() => true).catch(() => false);
    expect(fileStillExists).toBe(false);

    // Cleanup temp dir
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("passes project test paths relative to the Playwright execution directory", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-playwright-project-test-"));
    await fs.mkdir(path.join(tempDir, "e2e", "auth"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "e2e", "auth", "login.spec.ts"),
      'import { test } from "@playwright/test"; test("login", async () => {});',
    );

    const config: AgentConfig = {
      agentId: "agent-project-test",
      serverUrl: "http://localhost:3000",
      agentToken: "token-1234567890123456",
      projects: [{
        id: "projectsts",
        name: "ProjectSTS",
        playwright: {
          workspaceRoot: tempDir,
          testRoot: "e2e",
          allowedBrowsers: ["chromium"],
        },
      }],
    };
    const job: PlaywrightJob = {
      id: "job-project-test-1",
      agentId: "agent-project-test",
      projectId: "projectsts",
      source: "project-test",
      testIds: [generateTestId("e2e/auth/login.spec.ts", "login", 0, 1)],
      browsers: ["chromium"],
      mode: "headless",
      status: "claimed",
      browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const prepared = await preparePlaywrightExecution(config, job);

    expect(prepared.cwd).toBe(tempDir);
    expect(prepared.args[3]).toBe("e2e/auth/login.spec.ts");
    expect(path.isAbsolute(prepared.args[3])).toBe(false);
    await prepared.cleanup();
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

  it("prepares a secure Playwright UI command with loopback binding and 30-min timeout", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-playwright-interactive-"));
    await fs.mkdir(path.join(tempDir, "e2e", "auth"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "e2e", "auth", "login.spec.ts"),
      'import { test } from "@playwright/test"; test("login", async () => {});',
    );

    const config: AgentConfig = {
      agentId: "agent-interactive-1",
      serverUrl: "http://localhost:3000",
      agentToken: "token-1234567890123456",
      projects: [{
        id: "projectsts",
        name: "ProjectSTS",
        playwright: {
          workspaceRoot: tempDir,
          testRoot: "e2e",
          allowedBrowsers: ["chromium", "firefox"],
        },
      }],
    };

    const job: PlaywrightJob = {
      id: "job-interactive-1",
      agentId: "agent-interactive-1",
      projectId: "projectsts",
      source: "project-test",
      testIds: [generateTestId("e2e/auth/login.spec.ts", "login", 0, 1)],
      browsers: ["chromium"],
      mode: "interactive",
      status: "claimed",
      browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const prepared = await preparePlaywrightExecution(config, job);

    expect(prepared.interactive).toBe(true);
    expect(prepared.timeoutSeconds).toBe(1800);
    expect(prepared.args).toContain("--ui");
    expect(prepared.args).toContain("--ui-host=127.0.0.1");
    expect(prepared.args).toContain("--ui-port=0");
    expect(prepared.args).toContain("--project=chromium");
    expect(prepared.args).not.toContain("--headed");
    expect(prepared.args.some((arg) => path.isAbsolute(arg) && arg.endsWith(".spec.ts"))).toBe(false);

    await prepared.cleanup();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("rejects interactive mode with workspace source or multiple browsers", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-playwright-interactive-invalid-"));
    const config: AgentConfig = {
      agentId: "agent-interactive-2",
      serverUrl: "http://localhost:3000",
      agentToken: "token-1234567890123456",
      projects: [{
        id: "projectsts",
        name: "ProjectSTS",
        playwright: {
          workspaceRoot: tempDir,
          testRoot: "e2e",
          allowedBrowsers: ["chromium", "firefox"],
          allowWorkspaceExecution: true,
        },
      }],
    };

    const workspaceJob: PlaywrightJob = {
      id: "job-interactive-ws",
      agentId: "agent-interactive-2",
      projectId: "projectsts",
      source: "workspace",
      code: "import { test } from '@playwright/test';",
      browsers: ["chromium"],
      mode: "interactive",
      status: "claimed",
      browserResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(preparePlaywrightExecution(config, workspaceJob)).rejects.toThrow(/project tests/i);

    const multiBrowserJob: PlaywrightJob = {
      id: "job-interactive-multi",
      agentId: "agent-interactive-2",
      projectId: "projectsts",
      source: "project-test",
      testIds: ["test-1"],
      browsers: ["chromium", "firefox"],
      mode: "interactive",
      status: "claimed",
      browserResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(preparePlaywrightExecution(config, multiBrowserJob)).rejects.toThrow(/one browser/i);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Interactive UI Process Lifecycle", () => {
    it("handles normal process close as user_closed", async () => {
      const prepared: PreparedPlaywrightRun = {
        command: "node",
        args: ["-e", "process.exit(0)"],
        cwd: os.tmpdir(),
        env: { NODE_ENV: "test" },
        timeoutSeconds: 30,
        interactive: true,
        cleanup: async () => {},
      };

      const job: PlaywrightJob = {
        id: "job-int-1",
        agentId: "agent-1",
        projectId: "sts-playwright",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "interactive",
        status: "running",
        browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const systemLines: string[] = [];
      const result = await runPlaywrightExecution(prepared, job, {
        onLines: (stream, lines) => {
          if (stream === "system") systemLines.push(...lines);
        },
      });

      expect(result.status).toBe("session_closed");
      expect(result.sessionCloseReason).toBe("user_closed");
      expect(result.browserResults[0].status).toBe("session_closed");
      expect(systemLines).toContain("[UI] Session closed: user_closed");
    });

    it("handles abort signal as operator_stopped", async () => {
      const abortController = new AbortController();
      const prepared: PreparedPlaywrightRun = {
        command: "node",
        args: ["-e", "setInterval(() => {}, 1000)"],
        cwd: os.tmpdir(),
        env: { NODE_ENV: "test" },
        timeoutSeconds: 30,
        interactive: true,
        cleanup: async () => {},
      };

      const job: PlaywrightJob = {
        id: "job-int-2",
        agentId: "agent-1",
        projectId: "sts-playwright",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "interactive",
        status: "running",
        browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const systemLines: string[] = [];
      const runPromise = runPlaywrightExecution(
        prepared,
        job,
        {
          onLines: (stream, lines) => {
            if (stream === "system") systemLines.push(...lines);
          },
          onStarted: () => {
            setTimeout(() => abortController.abort(), 100);
          },
        },
        abortController.signal,
      );

      const result = await runPromise;
      expect(result.status).toBe("session_closed");
      expect(result.sessionCloseReason).toBe("operator_stopped");
      expect(systemLines).toContain("[UI] Session closed: operator_stopped");
    });

    it("handles timeout expiration as timeout", async () => {
      const prepared: PreparedPlaywrightRun = {
        command: "node",
        args: ["-e", "setInterval(() => {}, 1000)"],
        cwd: os.tmpdir(),
        env: { NODE_ENV: "test" },
        timeoutSeconds: 1, // 1 second for test
        interactive: true,
        cleanup: async () => {},
      };

      const job: PlaywrightJob = {
        id: "job-int-3",
        agentId: "agent-1",
        projectId: "sts-playwright",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "interactive",
        status: "running",
        browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const systemLines: string[] = [];
      const result = await runPlaywrightExecution(prepared, job, {
        onLines: (stream, lines) => {
          if (stream === "system") systemLines.push(...lines);
        },
      });

      expect(result.status).toBe("session_closed");
      expect(result.sessionCloseReason).toBe("timeout");
      expect(systemLines).toContain("[UI] Session closed: timeout");
    });

    it("handles spawn error as process_error", async () => {
      const prepared: PreparedPlaywrightRun = {
        command: "non_existent_binary_12345",
        args: [],
        cwd: os.tmpdir(),
        env: { NODE_ENV: "test" },
        timeoutSeconds: 30,
        interactive: true,
        cleanup: async () => {},
      };

      const job: PlaywrightJob = {
        id: "job-int-4",
        agentId: "agent-1",
        projectId: "sts-playwright",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "interactive",
        status: "running",
        browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const systemLines: string[] = [];
      const result = await runPlaywrightExecution(prepared, job, {
        onLines: (stream, lines) => {
          if (stream === "system") systemLines.push(...lines);
        },
      });

      expect(result.status).toBe("session_closed");
      expect(result.sessionCloseReason).toBe("process_error");
      expect(systemLines).toContain("[UI] Session closed: process_error");
    });

    it("filters loopback URL and emits safe Local Playwright UI ready line", async () => {
      const prepared: PreparedPlaywrightRun = {
        command: "node",
        args: ["-e", 'console.log("Listening on http://127.0.0.1:49213/index.html"); process.exit(0);'],
        cwd: os.tmpdir(),
        env: { NODE_ENV: "test" },
        timeoutSeconds: 30,
        interactive: true,
        cleanup: async () => {},
      };

      const job: PlaywrightJob = {
        id: "job-int-5",
        agentId: "agent-1",
        projectId: "sts-playwright",
        source: "project-test",
        testIds: ["test-1"],
        browsers: ["chromium"],
        mode: "interactive",
        status: "running",
        browserResults: [{ browser: "chromium", status: "running", passed: 0, failed: 0, skipped: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const stdoutLines: string[] = [];
      const systemLines: string[] = [];
      await runPlaywrightExecution(prepared, job, {
        onLines: (stream, lines) => {
          if (stream === "stdout") stdoutLines.push(...lines);
          if (stream === "system") systemLines.push(...lines);
        },
      });

      expect(stdoutLines).toEqual([]); // stdout suppressed in interactive mode
      expect(systemLines).toContain("[UI] Local Playwright UI ready");
      expect(systemLines.join(" ")).not.toContain("49213");
      expect(systemLines.join(" ")).not.toContain("127.0.0.1");
    });
  });
});
