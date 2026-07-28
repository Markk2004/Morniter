import child_process from "node:child_process";
import { resolveExecutable } from "./config.js";
import { redactLogLine } from "./redact.js";
import type { ResolvedPreset, ExecutionResult, ExecutionStatus } from "./types.js";

export function killProcessTree(pid: number, platform = process.platform): void {
  if (platform === "win32") {
    try {
      child_process.execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } catch {
      // Ignore if process already exited
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Ignore
      }
    }
  }
}

export async function runPreset(
  preset: ResolvedPreset,
  callbacks: {
    onLines: (stream: "stdout" | "stderr" | "system", lines: string[]) => void;
    onStarted?: (pid: number) => void;
  },
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const startedAt = new Date().toISOString();
  const startTimeMs = Date.now();
  const executable = resolveExecutable(preset.command);

  let status: ExecutionStatus = "passed";
  let exitCode: number | null = null;
  const truncated = false;
  let errorMessage: string | undefined;

  const secretsToRedact = Object.values(preset.env);

  let isAborted = false;
  let isTimedOut = false;

  return new Promise<ExecutionResult>((resolve) => {
    callbacks.onLines("system", [
      `[Morniter] Executing preset "${preset.name}" (${preset.command} ${preset.args.join(" ")})`,
      `[Morniter] Working directory: ${preset.cwd}`,
    ]);

    const child = child_process.spawn(executable, preset.args, {
      cwd: preset.cwd,
      env: { ...process.env, ...preset.env },
      shell: false,
    });

    if (child.pid && callbacks.onStarted) {
      callbacks.onStarted(child.pid);
    }

    // Line buffering for stdout & stderr
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flushStream = (stream: "stdout" | "stderr", text: string, isFinal = false) => {
      const rawLines = text.split(/\r?\n/);
      if (!isFinal) {
        const remainder = rawLines.pop() ?? "";
        if (stream === "stdout") stdoutBuffer = remainder;
        if (stream === "stderr") stderrBuffer = remainder;
      }
      const validLines = rawLines.filter((l) => l.trim().length > 0);
      if (validLines.length > 0) {
        const redacted = validLines.map((line) => redactLogLine(line, secretsToRedact));
        callbacks.onLines(stream, redacted);
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf-8");
      flushStream("stdout", stdoutBuffer);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf-8");
      flushStream("stderr", stderrBuffer);
    });

    const timeoutTimer = setTimeout(() => {
      isTimedOut = true;
      status = "timed_out";
      errorMessage = `Execution timed out after ${preset.timeoutSeconds} seconds`;
      callbacks.onLines("system", [`[Morniter] ${errorMessage}`]);
      if (child.pid) {
        killProcessTree(child.pid);
      }
    }, preset.timeoutSeconds * 1000);

    const onSignalAbort = () => {
      isAborted = true;
      status = "cancelled";
      errorMessage = "Execution cancelled by request";
      callbacks.onLines("system", [`[Morniter] ${errorMessage}`]);
      if (child.pid) {
        killProcessTree(child.pid);
      }
    };

    if (signal) {
      if (signal.aborted) {
        onSignalAbort();
      } else {
        signal.addEventListener("abort", onSignalAbort, { once: true });
      }
    }

    child.on("error", (err) => {
      status = "failed";
      errorMessage = `Failed to spawn executable "${executable}": ${err.message}`;
      callbacks.onLines("system", [`[Morniter] ${errorMessage}`]);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);

      if (stdoutBuffer) flushStream("stdout", stdoutBuffer, true);
      if (stderrBuffer) flushStream("stderr", stderrBuffer, true);

      exitCode = code;
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startTimeMs;

      if (!isAborted && !isTimedOut) {
        if (code === 0) {
          status = "passed";
          callbacks.onLines("system", [`[Morniter] Process exited successfully with code 0 (${durationMs}ms)`]);
        } else {
          status = "failed";
          callbacks.onLines("system", [`[Morniter] Process exited with failure code ${code} (${durationMs}ms)`]);
        }
      }

      resolve({
        status,
        exitCode,
        startedAt,
        finishedAt,
        durationMs,
        truncated,
        error: errorMessage,
      });
    });
  });
}
