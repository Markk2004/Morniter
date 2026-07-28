import { spawnPresetProcess, terminateProcessTree } from "./process-adapter";
import { redactText } from "./redact";
import type { ResolvedPreset, ExecutionResult } from "./types";

export interface LogCallback {
  onLines?: (stream: "stdout" | "stderr" | "system", lines: string[]) => void;
}

export async function runPreset(
  preset: ResolvedPreset,
  callback?: LogCallback,
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  let child: ReturnType<typeof spawnPresetProcess>;
  try {
    child = spawnPresetProcess(preset);
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const errorMessage = err instanceof Error ? err.message : "Failed to spawn process";
    if (callback?.onLines) {
      callback.onLines("stderr", [errorMessage]);
    }
    return {
      status: "failed",
      exitCode: null,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedAtDate.getTime(),
      truncated: false,
      error: errorMessage,
    };
  }

  let isFinished = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;

  return new Promise<ExecutionResult>((resolve) => {
    function finish(
      finalStatus: ExecutionResult["status"],
      code: number | null,
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
        terminateProcessTree(child.pid);
      }

      const finishedAtDate = new Date();
      const finishedAt = finishedAtDate.toISOString();
      const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();

      resolve({
        status: finalStatus,
        exitCode: code,
        startedAt,
        finishedAt,
        durationMs,
        truncated: false,
        error: errMessage,
      });
    }

    if (signal) {
      if (signal.aborted) {
        finish("cancelled", null, "Execution cancelled by caller", true);
        return;
      }
      abortListener = () => finish("cancelled", null, "Execution cancelled by caller", true);
      signal.addEventListener("abort", abortListener);
    }

    if (preset.timeoutSeconds > 0) {
      timeoutTimer = setTimeout(() => {
        finish("timed_out", null, `Execution timed out after ${preset.timeoutSeconds} seconds`, true);
      }, preset.timeoutSeconds * 1000);
    }

    function processStream(stream: "stdout" | "stderr", data: Buffer) {
      if (isFinished) return;
      const text = data.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      const redacted = lines.map((l) => redactText(l));
      if (redacted.length > 0 && callback?.onLines) {
        callback.onLines(stream, redacted);
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
      finish("failed", null, err.message, false);
    });

    child.on("close", (code: number | null) => {
      const finalStatus = code === 0 ? "passed" : "failed";
      finish(finalStatus, code, undefined, false);
    });
  });
}
