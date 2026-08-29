import fs from "node:fs/promises";
import path from "node:path";
import { spawnProcessCommand, terminateProcessTree } from "./process-adapter.js";
import { resolveExecutable } from "./config.js";
import { resolveInsideRoot, scanPlaywrightTests } from "./playwright-catalog.js";
import { redactText } from "./redact.js";
import type {
  AgentConfig,
  PlaywrightJob,
  PlaywrightExecutionResult,
  BrowserExecutionResult,
} from "./types.js";

const BLOCKED_ENV_KEYS = new Set([
  "TEST_RUNNER_AGENT_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
  "SESSION_SIGNING_SECRET",
  "GROUP_ACCESS_PASSWORD_HASH",
  "TEST_RUNNER_PASSWORD_HASH",
]);

export function buildSafeTestEnv(
  envAllowlist: string[] = [],
  sourceEnv: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  const safeEnv: Record<string, string> = {
    PATH: sourceEnv.PATH ?? "",
    NODE_ENV: "test",
  };

  if (sourceEnv.PLAYWRIGHT_BROWSERS_PATH) {
    safeEnv.PLAYWRIGHT_BROWSERS_PATH = sourceEnv.PLAYWRIGHT_BROWSERS_PATH;
  }
  if (sourceEnv.SYSTEMROOT) {
    safeEnv.SYSTEMROOT = sourceEnv.SYSTEMROOT;
  }

  for (const key of envAllowlist) {
    if (BLOCKED_ENV_KEYS.has(key)) {
      continue;
    }
    const val = sourceEnv[key];
    if (val !== undefined) {
      safeEnv[key] = val;
    }
  }

  return safeEnv;
}

export interface PreparedPlaywrightRun {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutSeconds: number;
  cleanup: () => Promise<void>;
}

export async function preparePlaywrightExecution(
  config: AgentConfig,
  job: PlaywrightJob,
): Promise<PreparedPlaywrightRun> {
  const project = config.projects.find((p) => p.id === job.projectId);
  if (!project || !project.playwright) {
    throw new Error(`Project '${job.projectId}' does not have Playwright configured on this agent.`);
  }

  const pw = project.playwright;
  const workspaceRoot = path.resolve(pw.workspaceRoot);

  // Validate browsers
  const allowedBrowsers = pw.allowedBrowsers || ["chromium"];
  for (const b of job.browsers) {
    if (!allowedBrowsers.includes(b)) {
      throw new Error(`Browser '${b}' is not allowed for project '${job.projectId}' on this agent.`);
    }
  }

  // Validate headed mode
  if (job.mode === "headed" && pw.allowHeaded === false) {
    throw new Error(`Headed mode is disabled for project '${job.projectId}' on this agent.`);
  }

  const testRoot = pw.testRoot || "e2e";
  let specPaths: string[] = [];
  let cleanup = async () => {};

  if (job.source === "project-test") {
    if (!job.testIds || job.testIds.length === 0) {
      throw new Error("No testIds provided for project-test execution.");
    }

    const allTests = await scanPlaywrightTests(workspaceRoot, testRoot);
    const resolvedFiles = new Set<string>();

    for (const testId of job.testIds) {
      const match = allTests.find((t) => t.id === testId);
      if (!match) {
        throw new Error(`TestId '${testId}' could not be resolved in project '${job.projectId}'.`);
      }
      const fullPath = resolveInsideRoot(workspaceRoot, match.relativePath);
      resolvedFiles.add(fullPath);
    }

    specPaths = Array.from(resolvedFiles);
  } else if (job.source === "workspace") {
    if (pw.allowWorkspaceExecution === false) {
      throw new Error(`Workspace code execution is disabled for project '${job.projectId}'.`);
    }
    if (!job.code || job.code.trim().length === 0) {
      throw new Error("Workspace code is empty.");
    }

    const workspaceDir = path.join(workspaceRoot, testRoot, "__workspace__");
    await fs.mkdir(workspaceDir, { recursive: true });

    const specFile = path.join(workspaceDir, `${job.id}.spec.ts`);
    await fs.writeFile(specFile, job.code, "utf-8");

    specPaths = [specFile];

    cleanup = async () => {
      try {
        await fs.unlink(specFile);
      } catch {
        // ignore
      }
    };
  }

  const executable = resolveExecutable("npx");
  const args = ["playwright", "test", ...specPaths];

  for (const b of job.browsers) {
    args.push(`--project=${b}`);
  }

  if (job.mode === "headed") {
    args.push("--headed");
  }

  const safeEnv = buildSafeTestEnv(pw.envAllowlist);
  const timeoutSeconds = pw.maxTimeoutSeconds || 600;

  return {
    command: executable,
    args,
    cwd: workspaceRoot,
    env: safeEnv,
    timeoutSeconds,
    cleanup,
  };
}

export async function runPlaywrightExecution(
  prepared: PreparedPlaywrightRun,
  job: PlaywrightJob,
  callbacks: {
    onLines: (stream: "stdout" | "stderr" | "system", lines: string[]) => void;
    onStarted?: (pid: number) => void;
  },
  signal?: AbortSignal,
): Promise<PlaywrightExecutionResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  const browserResults: BrowserExecutionResult[] = job.browsers.map((b) => ({
    browser: b,
    status: "running",
    passed: 0,
    failed: 0,
    skipped: 0,
  }));

  let child: ReturnType<typeof spawnProcessCommand>;
  try {
    child = spawnProcessCommand(prepared.command, prepared.args, prepared.cwd, prepared.env);
  } catch (err) {
    await prepared.cleanup();
    const finishedAt = new Date().toISOString();
    const errMsg = err instanceof Error ? err.message : "Failed to spawn Playwright process";
    callbacks.onLines("stderr", [errMsg]);
    return {
      status: "failed",
      browserResults: job.browsers.map((b) => ({
        browser: b,
        status: "failed",
        passed: 0,
        failed: 1,
        skipped: 0,
      })),
      startedAt,
      finishedAt,
      durationMs: 0,
      truncated: false,
      error: errMsg,
    };
  }

  if (child.pid && callbacks.onStarted) {
    callbacks.onStarted(child.pid);
  }

  let isFinished = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;

  return new Promise<PlaywrightExecutionResult>((resolve) => {
    async function finish(
      finalStatus: PlaywrightExecutionResult["status"],
      errMessage?: string,
      shouldKill = false,
    ) {
      if (isFinished) return;
      isFinished = true;

      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (abortListener && signal) {
        signal.removeEventListener("abort", abortListener);
      }

      if (shouldKill && child.pid) {
        const pid = child.pid;
        try {
          child.kill();
        } catch {
          // ignore
        }
        setImmediate(() => terminateProcessTree(pid));
      }

      await prepared.cleanup();

      const finishedAtDate = new Date();
      const finishedAt = finishedAtDate.toISOString();
      const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();

      browserResults.forEach((br) => {
        br.status = finalStatus === "passed" ? "passed" : "failed";
        br.durationMs = durationMs;
      });

      resolve({
        status: finalStatus,
        browserResults,
        startedAt,
        finishedAt,
        durationMs,
        truncated: false,
        error: errMessage,
      });
    }

    if (signal) {
      if (signal.aborted) {
        finish("cancelled", "Execution cancelled by caller", true);
        return;
      }
      abortListener = () => finish("cancelled", "Execution cancelled by caller", true);
      signal.addEventListener("abort", abortListener);
    }

    if (prepared.timeoutSeconds > 0) {
      timeoutTimer = setTimeout(() => {
        finish("timed_out", `Execution timed out after ${prepared.timeoutSeconds} seconds`, true);
      }, prepared.timeoutSeconds * 1000);
    }

    function processStream(stream: "stdout" | "stderr", data: Buffer) {
      if (isFinished) return;
      const text = data.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      const redacted = lines.map((l) => redactText(l));

      for (const clean of redacted) {
        if (clean.includes("passed") || clean.includes("✓")) {
          browserResults.forEach((br) => {
            br.passed += 1;
          });
        } else if (clean.includes("failed") || clean.includes("✗") || clean.includes("Error:")) {
          browserResults.forEach((br) => {
            br.failed += 1;
          });
        }
      }

      if (redacted.length > 0) {
        callbacks.onLines(stream, redacted);
      }
    }

    if (child.stdout) {
      child.stdout.on("data", (data: Buffer) => processStream("stdout", data));
    }
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => processStream("stderr", data));
    }

    child.on("error", (err: Error) => {
      processStream("stderr", Buffer.from(err.message));
      finish("failed", err.message, false);
    });

    child.on("close", (code: number | null) => {
      const finalStatus = code === 0 ? "passed" : "failed";
      finish(finalStatus, undefined, false);
    });
  });
}
