import { z } from "zod";
import path from "node:path";
import { BrowserNameSchema } from "./schemas";

// DUPLICATION NOTE: same as schemas.ts — the legacy ID_REGEX's file path
// hasn't been located yet, so this is redeclared locally rather than left
// on a guessed import. Consolidate once found (see schemas.ts for the
// grep command to locate it).
const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Agent-side security config for Playwright jobs (Tasks 0.3 / 0.4).
 *
 * INTEGRATION NOTE: this is a new, self-contained module. It has not yet
 * been wired into the existing agent config loader for
 * test-runner.config.local.json (that file wasn't available at the time
 * this was written). Once that loader is shared, the intent is:
 *   - add an optional `playwright` section per project entry validated by
 *     `PlaywrightProjectSecurityConfigSchema` below
 *   - call `resolveTestFilePath` / `buildAllowedEnv` from wherever the
 *     agent currently resolves a preset's cwd/env before spawning, using
 *     the SAME cross-spawn + taskkill.exe process adapter already in use
 *     for preset jobs (Task 1.6) — this module does not spawn anything
 *     itself, it only validates and resolves inputs.
 *
 * Everything here is local-config-only: none of these fields are ever
 * accepted from the browser (see schemas.ts / PlaywrightJobRequestSchema,
 * which only carries projectId + testIds|code + browsers + mode).
 */

// --- Task 0.3: per-project security config -------------------------------

/**
 * Env var names must look like env var names — this is a syntactic check,
 * not a secrecy check. The actual secrecy filtering happens in
 * buildAllowedEnv via ENV_NAME_DENY_PATTERNS below.
 */
const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

const EnvVarNameSchema = z.string().regex(ENV_VAR_NAME_PATTERN, {
  message: "env var names must be UPPER_SNAKE_CASE",
});

export const PlaywrightProjectSecurityConfigSchema = z
  .object({
    projectId: z.string().regex(ID_REGEX),
    // Absolute path on the agent machine. Comes from local config only —
    // never derived from client input.
    workspaceRoot: z.string().min(1),
    // Path relative to workspaceRoot that project-test jobs may read from.
    // Defaults to "e2e" to match the existing playwright.config.ts testDir.
    testRoot: z.string().min(1).default("e2e"),
    allowedBrowsers: z.array(BrowserNameSchema).min(1),
    allowHeaded: z.boolean().default(false),
    maxTimeoutSeconds: z.number().int().min(1).max(1800).default(300),
    // Task 0.4 — see below.
    envAllowlist: z.array(EnvVarNameSchema).default([]),
  })
  .strict();

export type PlaywrightProjectSecurityConfig = z.infer<
  typeof PlaywrightProjectSecurityConfigSchema
>;

/**
 * Resolve a client-supplied relative test path against the project's
 * configured test root, and verify the result cannot escape it.
 *
 * Rejects:
 *   - absolute paths (POSIX or Windows-style, e.g. "/etc/passwd", "C:\\...")
 *   - traversal via "..", including after normalization
 *     (e.g. "foo/../../secret.spec.ts")
 *   - null bytes
 *
 * Returns the resolved absolute path, or throws with a message safe to
 * surface to the caller (it never echoes the configured workspaceRoot).
 */
export function resolveTestFilePath(
  config: PlaywrightProjectSecurityConfig,
  relativePath: string,
): string {
  if (relativePath.includes("\0")) {
    throw new Error("test path is invalid");
  }
  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:[\\/]/.test(relativePath)) {
    throw new Error("test path must be relative");
  }

  const testRootAbs = path.resolve(config.workspaceRoot, config.testRoot);
  const resolved = path.resolve(testRootAbs, relativePath);

  const relationToRoot = path.relative(testRootAbs, resolved);
  const escapesRoot =
    relationToRoot.startsWith("..") || path.isAbsolute(relationToRoot);

  if (escapesRoot) {
    throw new Error("test path resolves outside the allowed test root");
  }

  return resolved;
}

// --- Task 0.4: environment allowlisting -----------------------------------

/**
 * Defense in depth against operator misconfiguration of envAllowlist.
 *
 * This is deliberately NOT a blunt substring match on words like
 * "PASSWORD" or "TOKEN" — this project's own UAT presets legitimately
 * use STS_UAT_PASSWORD (see README.md), so a generic "*PASSWORD*" block
 * would break a real, intended use case rather than catch a real threat.
 *
 * Instead this targets two things specifically:
 *   1. The exact names of known system/infra secrets already documented
 *      in this repo's README.md / CLAUDE.md (session signing secret,
 *      group + execution password hashes, agent bearer token, Redis
 *      REST credentials) — these must never reach a spawned test
 *      process under any project's envAllowlist.
 *   2. Generic infra-secret *shapes* that should never legitimately be
 *      a per-project test fixture credential, e.g. a signing secret, a
 *      bcrypt hash, a database connection string, a cloud provider API
 *      key, or anything explicitly named as a private key / credential.
 *
 * A project-specific test credential like STS_UAT_PASSWORD or a future
 * STS_UAT_TOKEN is intentionally NOT caught here — those are gated by
 * requiring explicit per-project envAllowlist entry instead, which is a
 * deliberate operator decision rather than an accidental leak.
 */
const KNOWN_SYSTEM_SECRET_NAMES = new Set([
  "GROUP_ACCESS_PASSWORD_HASH",
  "SESSION_SIGNING_SECRET",
  "TEST_RUNNER_PASSWORD_HASH",
  "TEST_RUNNER_AGENT_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
]);

const ENV_NAME_DENY_PATTERNS: RegExp[] = [
  /SIGNING_SECRET/,
  /_API_KEY$/,
  /^API_KEY$/,
  /AGENT_TOKEN/,
  /DATABASE_URL/,
  /CONNECTION_STRING/,
  /_HASH$/,
  /REDIS/,
  /PRIVATE_KEY/,
  /SERVICE_ROLE/,
  /CREDENTIAL/,
];

function isDeniedEnvName(name: string): boolean {
  if (KNOWN_SYSTEM_SECRET_NAMES.has(name)) {
    return true;
  }
  return ENV_NAME_DENY_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Build the environment object to pass to a spawned Playwright process:
 * only names in the project's envAllowlist, intersected with what's
 * actually present in the agent process's own environment, minus anything
 * matching the deny patterns above — plus a minimal safe baseline
 * (PATH-equivalent) so the spawned process can actually run.
 *
 * This never returns process.env directly, and never includes a variable
 * whose name was not explicitly allowlisted by local config.
 */
export function buildAllowedEnv(
  config: PlaywrightProjectSecurityConfig,
  processEnv: NodeJS.ProcessEnv,
  baseline: string[] = ["PATH", "PATHEXT", "SystemRoot", "TEMP", "TMP"],
): Record<string, string> {
  const result: Record<string, string> = {};

  const allowedNames = new Set([...baseline, ...config.envAllowlist]);

  for (const name of allowedNames) {
    if (isDeniedEnvName(name)) {
      continue;
    }
    const value = processEnv[name];
    if (typeof value === "string") {
      result[name] = value;
    }
  }

  return result;
}

/**
 * Validate a requested browser/mode pair against a project's security
 * config before a job is dispatched to this agent. Throws a message safe
 * to surface to the client.
 */
export function assertBrowserModeAllowed(
  config: PlaywrightProjectSecurityConfig,
  browsers: readonly string[],
  mode: "headless" | "headed",
): void {
  const disallowed = browsers.filter(
    (browser) => !config.allowedBrowsers.includes(browser as never),
  );
  if (disallowed.length > 0) {
    throw new Error(
      `browser(s) not allowed for this project: ${disallowed.join(", ")}`,
    );
  }
  if (mode === "headed" && !config.allowHeaded) {
    throw new Error("headed mode is not allowed for this project");
  }
}
