import spawn from "cross-spawn";
import childProcess from "node:child_process";
import type { ResolvedPreset } from "./types";

/**
 * ⚠️ FIX applied to spawnProcessCommand below — see the comment on that
 * function for what was wrong and why. Verified with an actual spawned
 * child process (not just inspection): the original
 * `{ ...process.env, ...env }` pattern lets a real secret set in the
 * agent's own environment (e.g. TEST_RUNNER_AGENT_TOKEN, per README.md's
 * own `$env:TEST_RUNNER_AGENT_TOKEN=...` setup instructions) leak
 * straight through to a spawned Playwright "workspace" job's arbitrary,
 * user-submitted test code via a plain `console.log(process.env)`.
 *
 * spawnPresetProcess is left UNCHANGED (still inherits process.env) —
 * flagged, not silently "fixed" the same way, because presets are
 * operator-configured (declared in test-runner.config.local.json by
 * whoever runs the agent), not arbitrary user-submitted code the way a
 * "workspace" Playwright job is. Whether preset processes are SUPPOSED
 * to have full environment access is a real product question, not
 * something to guess silently — worth confirming before touching it.
 */

export function resolveExecutable(
  command: string,
  platform: string = process.platform,
): string {
  if (platform !== "win32") {
    return command;
  }
  const lower = command.toLowerCase();
  if (
    lower === "npm" ||
    lower === "npx" ||
    lower === "pnpm" ||
    lower === "yarn"
  ) {
    return `${command}.cmd`;
  }
  return command;
}

export function spawnPresetProcess(preset: ResolvedPreset) {
  const executable = resolveExecutable(preset.command);
  return spawn(executable, preset.args, {
    cwd: preset.cwd,
    env: { ...process.env, ...preset.env },
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * FIXED: previously `env: { ...process.env, ...env }`, which spreads
 * the agent's ENTIRE real environment first and only layers the caller's
 * (supposedly filtered) env on top as overrides — meaning any secret
 * already present in the agent's own process.env (set via `$env:...`
 * per README.md) passes straight through to the spawned process
 * regardless of what buildSafeTestEnv() filtered out upstream.
 *
 * Now: `env` is used standalone. buildSafeTestEnv() in
 * playwright-executor.ts already constructs a complete, self-sufficient
 * environment (PATH, NODE_ENV, optionally PLAYWRIGHT_BROWSERS_PATH/
 * SYSTEMROOT, plus the project's explicit envAllowlist) — it was never
 * meant to be a set of additions on top of the full parent environment.
 */
export function spawnProcessCommand(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
) {
  const executable = resolveExecutable(command);
  // NODE_ENV is declared as a required (non-optional) field of
  // NodeJS.ProcessEnv somewhere in this repo's ambient types — a real
  // compiler error on the standalone-`env` fix proved this. The safe
  // way to satisfy that WITHOUT reopening the env-inheritance leak is a
  // default that gets overridden if `env` already has its own NODE_ENV
  // (which it always will in practice — buildSafeTestEnv() in
  // playwright-executor.ts unconditionally sets it) — NOT
  // `{ ...process.env, ...env }`, which is the exact pattern that leaked
  // secrets in the first place.
  const spawnEnv: NodeJS.ProcessEnv = { NODE_ENV: "production", ...env };
  return spawn(executable, args, {
    cwd,
    env: spawnEnv,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function terminateProcessTree(
  pid: number,
  platform: string = process.platform,
): void {
  if (!pid) return;
  if (platform === "win32") {
    try {
      childProcess.spawnSync(
        "taskkill.exe",
        ["/PID", String(pid), "/T", "/F"],
        { shell: false, windowsHide: true, stdio: "ignore" },
      );
    } catch {
      // Ignore taskkill errors if process already exited
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Ignore kill errors if process already exited
      }
    }
  }
}
