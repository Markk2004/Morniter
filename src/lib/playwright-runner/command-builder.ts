import fs from "node:fs/promises";
import path from "node:path";

/**
 * Playwright command builder — Phase 1.
 *
 * Intended to compile as part of the agent/ project (same compilation unit
 * as config.ts, resolveExecutable, resolvePreset), NOT the Next.js app —
 * this does real filesystem writes and constructs spawn() argv, which only
 * makes sense running on the agent machine. Exact target path unconfirmed;
 * placed here pending confirmation (see closing note).
 *
 * Design constraint carried over from Task 0.1/0.2: nothing in this module
 * accepts a raw shell string. It only ever builds an argv ARRAY for
 * spawn(executable, args, { shell: false }) — the same safe-exec pattern
 * this repo already uses for preset jobs.
 */

export type BrowserName = "chromium" | "firefox" | "webkit";
export type BrowserMode = "headless" | "headed";

// Duplicated from config.ts's resolveExecutable rather than imported —
// same cross-compilation-unit reasoning as ID_REGEX (see prior discussion).
export function resolveExecutable(
  command: string,
  platform = process.platform,
): string {
  if (platform === "win32") {
    const lower = command.toLowerCase();
    if (
      (lower === "npm" || lower === "npx") &&
      !lower.endsWith(".cmd") &&
      !lower.endsWith(".exe")
    ) {
      return `${command}.cmd`;
    }
  }
  return command;
}

export interface BuildPlaywrightArgsInput {
  /**
   * Already-resolved, already-validated relative test file paths (from
   * resolveTestFilePath in agent-security-config.ts) — NOT raw testIds
   * and NOT client input. This function trusts its caller to have done
   * that resolution/containment check already; it does no path safety
   * checking of its own beyond refusing to build a command with zero
   * paths and zero code.
   */
  testFilePaths: string[];
  browsers: BrowserName[];
  mode: BrowserMode;
  timeoutSeconds: number;
}

/**
 * Build the argv array for `npx playwright test ...`. Returns
 * { executable, args } for spawn(executable, args, { shell: false }).
 */
export function buildPlaywrightArgs(input: BuildPlaywrightArgsInput): {
  executable: string;
  args: string[];
} {
  if (input.testFilePaths.length === 0) {
    throw new Error("at least one test file path is required");
  }
  if (input.browsers.length === 0) {
    throw new Error("at least one browser is required");
  }
  if (input.timeoutSeconds < 1 || input.timeoutSeconds > 1800) {
    throw new Error("timeoutSeconds out of allowed range");
  }

  const args: string[] = ["playwright", "test", ...input.testFilePaths];

  for (const browser of input.browsers) {
    args.push("--project", browser);
  }

  if (input.mode === "headed") {
    args.push("--headed");
  }

  args.push("--timeout", String(input.timeoutSeconds * 1000));
  args.push("--reporter=line");

  return {
    executable: resolveExecutable("npx"),
    args,
  };
}

// --- Workspace (ad-hoc code) materialization --------------------------

/**
 * Job IDs are generated server-side (UUID-shaped) — this is a syntactic
 * guard against a malformed/malicious id ever being used to build a
 * filesystem path, not the primary source of trust.
 */
const JOB_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Write ad-hoc "workspace" test code to a file the Playwright CLI can run,
 * inside a dedicated subfolder of the project's configured testDir.
 *
 * Path containment: the resulting path is verified to stay inside
 * `${testDir}/__workspace__` the same way resolveTestFilePath verifies
 * project-test paths stay inside testDir — duplicated here narrowly
 * (single join + relative check) rather than pulling in the whole
 * agent-security-config module, since this only ever constructs one
 * specific filename this function itself generates (not client input).
 */
export async function writeWorkspaceTestFile(
  testDir: string,
  jobId: string,
  code: string,
): Promise<string> {
  if (!JOB_ID_PATTERN.test(jobId)) {
    throw new Error("invalid job id");
  }

  const workspaceDir = path.resolve(testDir, "__workspace__");
  const filePath = path.resolve(workspaceDir, `${jobId}.spec.ts`);

  const relationToRoot = path.relative(workspaceDir, filePath);
  if (relationToRoot.startsWith("..") || path.isAbsolute(relationToRoot)) {
    // Should be unreachable given JOB_ID_PATTERN, but fail closed anyway.
    throw new Error("resolved workspace test path escaped the workspace root");
  }

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(filePath, code, "utf-8");

  return filePath;
}

/**
 * Best-effort cleanup after a workspace job completes. Failures are
 * swallowed (logged by the caller if desired) — a leftover temp spec file
 * is a cleanliness issue, not a security issue, since it's scoped under
 * __workspace__/<jobId>.spec.ts and reused paths overwrite rather than
 * accumulate unboundedly per job.
 */
export async function cleanupWorkspaceTestFile(
  filePath: string,
): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // best-effort; ignore
  }
}
