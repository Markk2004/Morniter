import { spawnProcessCommand, terminateProcessTree } from "./process-adapter.js";
import { redactText } from "./redact.js";
import type { NativeRunner } from "./types.js";
import type { NativeExecutionGroup } from "./native-runner-plan.js";

export interface NativeGroupResult {
  runner: NativeRunner;
  executionProfileId: string;
  status: "passed" | "failed" | "cancelled" | "timed_out";
  testIds: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode?: number;
  error?: string;
}

const RUNNER_LOG_TAGS: Record<NativeRunner, string> = {
  playwright: "PLAYWRIGHT",
  "generated-playwright": "PLAYWRIGHT",
  "node-test": "NODE",
  jest: "JEST",
  "jest-e2e": "JEST-E2E",
};

export async function runNativeExecutionGroup(
  group: NativeExecutionGroup,
  callbacks: {
    onLines: (stream: "stdout" | "stderr" | "system", lines: string[]) => void;
    onStarted?: (pid: number) => void;
  },
  signal?: AbortSignal,
): Promise<NativeGroupResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const tag = RUNNER_LOG_TAGS[group.runner] || group.runner.toUpperCase();

  callbacks.onLines("system", [`[${tag}] Running ${group.testIds.length} test(s) with ${group.runner}...`]);

  let child: ReturnType<typeof spawnProcessCommand>;
  try {
    child = spawnProcessCommand(group.command, group.args, group.cwd, group.env);
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const errMsg = err instanceof Error ? err.message : `Failed to spawn process for ${group.runner}`;
    callbacks.onLines("stderr", [`[${tag}] ${errMsg}`]);
    return {
      runner: group.runner,
      executionProfileId: group.executionProfileId,
      status: "failed",
      testIds: group.testIds,
      startedAt,
      finishedAt,
      durationMs: 0,
      error: errMsg,
    };
  }

  if (child.pid && callbacks.onStarted) {
    callbacks.onStarted(child.pid);
  }

  let isFinished = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;

  return new Promise<NativeGroupResult>((resolve) => {
    function finish(
      finalStatus: NativeGroupResult["status"],
      exitCode?: number,
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

      const finishedAtDate = new Date();
      const finishedAt = finishedAtDate.toISOString();
      const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();

      resolve({
        runner: group.runner,
        executionProfileId: group.executionProfileId,
        status: finalStatus,
        testIds: group.testIds,
        startedAt,
        finishedAt,
        durationMs,
        exitCode,
        error: errMessage,
      });
    }

    if (signal) {
      if (signal.aborted) {
        finish("cancelled", undefined, "Execution cancelled by caller", true);
        return;
      }
      abortListener = () => finish("cancelled", undefined, "Execution cancelled by caller", true);
      signal.addEventListener("abort", abortListener);
    }

    if (group.timeoutSeconds > 0) {
      timeoutTimer = setTimeout(() => {
        finish("timed_out", undefined, `Execution timed out after ${group.timeoutSeconds}s`, true);
      }, group.timeoutSeconds * 1000);
    }

    function processStream(stream: "stdout" | "stderr", data: Buffer) {
      if (isFinished) return;
      const text = data.toString("utf-8");
      const rawLines = text.split(/\r?\n/).filter((l) => l.length > 0);
      const taggedLines = rawLines.map((l) => `[${tag}] ${redactText(l)}`);

      if (taggedLines.length > 0) {
        callbacks.onLines(stream, taggedLines);
      }
    }

    if (child.stdout) {
      child.stdout.on("data", (data: Buffer) => processStream("stdout", data));
    }
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => processStream("stderr", data));
    }

    child.on("error", (err: Error) => {
      callbacks.onLines("stderr", [`[${tag}] Process error: ${err.message}`]);
      finish("failed", undefined, err.message, false);
    });

    child.on("close", (code: number | null) => {
      const finalCode = code ?? (signal?.aborted ? 1 : 0);
      const finalStatus = finalCode === 0 ? "passed" : "failed";
      finish(finalStatus, finalCode, undefined, false);
    });
  });
}
