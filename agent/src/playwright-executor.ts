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
  interactive: boolean;
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

  if (job.mode === "interactive") {
    if (job.source !== "project-test") {
      throw new Error("Interactive UI requires project tests.");
    }
    if (job.browsers.length !== 1) {
      throw new Error("Interactive UI requires exactly one browser.");
    }
  }

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
  const testRootPath = resolveInsideRoot(workspaceRoot, testRoot);
  const configPath = pw.config ? resolveInsideRoot(workspaceRoot, pw.config) : undefined;
  const executionCwd = configPath ? path.dirname(configPath) : workspaceRoot;
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

    specPaths = Array.from(resolvedFiles).map((fullPath) =>
      path.relative(executionCwd, fullPath).replace(/\\/g, "/"),
    );
  } else if (job.source === "workspace") {
    if (pw.allowWorkspaceExecution === false) {
      throw new Error(`Workspace code execution is disabled for project '${job.projectId}'.`);
    }
    if (!job.code || job.code.trim().length === 0) {
      throw new Error("Workspace code is empty.");
    }

    const workspaceDir = resolveInsideRoot(testRootPath, "__workspace__");
    await fs.mkdir(workspaceDir, { recursive: true });

    const specFile = path.join(workspaceDir, `${job.id}.spec.ts`);
    await fs.writeFile(specFile, job.code, "utf-8");

    specPaths = [path.relative(executionCwd, specFile).replace(/\\/g, "/")];

    cleanup = async () => {
      try {
        await fs.unlink(specFile);
      } catch {
        // ignore
      }
    };
  }

  const executable = resolveExecutable("npx");
  const args = ["-y", "playwright", "test", ...specPaths];

  if (configPath) {
    args.push("--config", configPath);
  }

  for (const b of job.browsers) {
    args.push(`--project=${b}`);
  }

  if (job.mode === "interactive") {
    args.push("--ui", "--ui-host=127.0.0.1", "--ui-port=0");
  } else if (job.mode === "headed") {
    args.push("--headed");
  }

  const safeEnv = buildSafeTestEnv(pw.envAllowlist);
  const timeoutSeconds = job.mode === "interactive" ? 1800 : (pw.maxTimeoutSeconds || 600);

  return {
    command: executable,
    args,
    cwd: executionCwd,
    env: safeEnv,
    timeoutSeconds,
    interactive: job.mode === "interactive",
    cleanup,
  };
}

async function harvestArtifacts(
  workspaceRoot: string,
  jobId: string,
): Promise<NonNullable<PlaywrightExecutionResult["artifacts"]>> {
  const artifacts: NonNullable<PlaywrightExecutionResult["artifacts"]> = [];
  const resultsDir = path.join(workspaceRoot, "test-results");
  try {
    const entries = await fs.readdir(resultsDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(entry.parentPath || resultsDir, entry.name);
        const stat = await fs.stat(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        let type: "trace" | "screenshot" | "video" | "report" = "report";
        if (ext === ".zip" || entry.name.includes("trace")) {
          type = "trace";
        } else if (ext === ".png" || ext === ".jpg") {
          type = "screenshot";
        } else if (ext === ".webm" || ext === ".mp4") {
          type = "video";
        }

        artifacts.push({
          id: `art-${jobId}-${artifacts.length + 1}`,
          jobId,
          type,
          filename: entry.name,
          size: stat.size,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore if test-results directory does not exist
  }
  return artifacts;
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
    if (prepared.interactive) {
      callbacks.onLines("system", ["[UI] Session closed: process_error"]);
      return {
        status: "session_closed",
        sessionCloseReason: "process_error",
        browserResults: job.browsers.map((b) => ({
          browser: b,
          status: "session_closed",
          passed: 0,
          failed: 0,
          skipped: 0,
        })),
        startedAt,
        finishedAt,
        durationMs: 0,
        truncated: false,
        error: errMsg,
      };
    }
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
  let uiReadyReported = false;

  return new Promise<PlaywrightExecutionResult>((resolve) => {
    async function finish(
      finalStatus: PlaywrightExecutionResult["status"],
      errMessage?: string,
      shouldKill = false,
      explicitCloseReason?: import("./types.js").PlaywrightSessionCloseReason,
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

      if (prepared.interactive) {
        const effectiveReason: import("./types.js").PlaywrightSessionCloseReason =
          explicitCloseReason ??
          (finalStatus === "cancelled"
            ? "operator_stopped"
            : finalStatus === "timed_out"
              ? "timeout"
              : finalStatus === "failed"
                ? "process_error"
                : "user_closed");

        browserResults.forEach((br) => {
          br.status = "session_closed";
          br.durationMs = durationMs;
        });

        callbacks.onLines("system", [`[UI] Session closed: ${effectiveReason}`]);

        resolve({
          status: "session_closed",
          sessionCloseReason: effectiveReason,
          browserResults,
          startedAt,
          finishedAt,
          durationMs,
          truncated: false,
          error: errMessage,
        });
        return;
      }

      browserResults.forEach((br) => {
        br.status = finalStatus === "passed" ? "passed" : "failed";
        br.durationMs = durationMs;
      });

      const artifacts = await harvestArtifacts(prepared.cwd, job.id);

      resolve({
        status: finalStatus,
        browserResults,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        startedAt,
        finishedAt,
        durationMs,
        truncated: false,
        error: errMessage,
      });
    }

    if (signal) {
      if (signal.aborted) {
        finish(prepared.interactive ? "session_closed" : "cancelled", "Execution cancelled by caller", true, "operator_stopped");
        return;
      }
      abortListener = () => finish(prepared.interactive ? "session_closed" : "cancelled", "Execution cancelled by caller", true, "operator_stopped");
      signal.addEventListener("abort", abortListener);
    }

    if (prepared.timeoutSeconds > 0) {
      timeoutTimer = setTimeout(() => {
        finish(prepared.interactive ? "session_closed" : "timed_out", `Execution timed out after ${prepared.timeoutSeconds} seconds`, true, "timeout");
      }, prepared.timeoutSeconds * 1000);
    }

    function processStream(stream: "stdout" | "stderr", data: Buffer) {
      if (isFinished) return;
      const text = data.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      const redacted = lines.map((l) => redactText(l));

      if (prepared.interactive) {
        for (const line of redacted) {
          if (/https?:\/\/(?:127\.0\.0\.1|localhost):\d+/i.test(line) || /listening on/i.test(line)) {
            if (!uiReadyReported) {
              uiReadyReported = true;
              callbacks.onLines("system", ["[UI] Local Playwright UI ready"]);
            }
          }
        }
        return;
      }

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
      if (!prepared.interactive) {
        processStream("stderr", Buffer.from(err.message));
      }
      finish(prepared.interactive ? "session_closed" : "failed", err.message, false, "process_error");
    });

    child.on("close", (code: number | null) => {
      if (prepared.interactive) {
        finish("session_closed", undefined, false, "user_closed");
      } else {
        const finalStatus = code === 0 ? "passed" : "failed";
        finish(finalStatus, undefined, false);
      }
    });
  });
}
