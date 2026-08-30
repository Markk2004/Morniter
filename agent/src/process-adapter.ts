import spawn from "cross-spawn";
import childProcess from "node:child_process";
import type { ResolvedPreset } from "./types";

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

export function spawnProcessCommand(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
) {
  const executable = resolveExecutable(command);
  return spawn(executable, args, {
    cwd,
    env: { ...process.env, ...env },
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
