import { z } from "zod";
import path from "node:path";
import { BrowserNameSchema } from "./schemas";

/**
 * ⚠️ CONFIRMED SUPERSEDED — real agent/src/playwright-executor.ts
 * (preparePlaywrightExecution) does its OWN inline validation directly
 * against the AgentConfig object, using resolveInsideRoot/
 * scanPlaywrightTests from playwright-catalog.js for path handling and
 * a much simpler buildSafeTestEnv function for env — it does not call
 * anything from a module shaped like this one. This file is not wired
 * into anything real and, based on the inline logic seen, likely never
 * will be in its current form. Kept only as a corrected reference for
 * the CONFIG SHAPE (which does match AgentPlaywrightProjectConfig
 * exactly) and its two default-value bugs are now fixed below, but
 * don't expect this module itself to be imported by real code.
 *
 * Also confirmed NOT enforced anywhere in the real execution path:
 * `allowedBaseUrls` is a real field on the type, but
 * preparePlaywrightExecution never reads or checks it. Either it's
 * enforced somewhere else not yet seen, or it's a not-yet-implemented
 * field. assertBaseUrlAllowed below remains speculative.
 *
 * Also confirmed: the real env blocklist (BLOCKED_ENV_KEYS in
 * playwright-executor.ts) is much narrower than this file's — just 5
 * exact names (TEST_RUNNER_AGENT_TOKEN, UPSTASH_REDIS_REST_TOKEN,
 * SESSION_SIGNING_SECRET, GROUP_ACCESS_PASSWORD_HASH,
 * TEST_RUNNER_PASSWORD_HASH), no pattern-based matching at all — this
 * file's broader ENV_NAME_DENY_PATTERNS is stricter than real behavior,
 * not identical to it. And the real default timeout fallback is
 * `pw.maxTimeoutSeconds || 600` (600s) — this schema leaves
 * maxTimeoutSeconds without a hardcoded default since the fallback is
 * applied in executor code, not the config schema itself in the real
 * system either.
 *
 * REVISED against real evidence — agent/src/types.ts (pasted directly
 * from the real repo) exports `AgentPlaywrightProjectConfig`, and its
 * shape is meaningfully different from this file's earlier version:
 *
 *   export interface AgentPlaywrightProjectConfig {
 *     enabled?: boolean;
 *     workspaceRoot: string;
 *     testRoot?: string;
 *     config?: string;
 *     allowedBrowsers?: ("chromium" | "firefox" | "webkit")[];
 *     allowHeaded?: boolean;
 *     allowWorkspaceExecution?: boolean;
 *     maxTimeoutSeconds?: number;
 *     envAllowlist?: string[];
 *     allowedBaseUrls?: string[];
 *   }
 *
 * Concretely, versus the earlier version of this file:
 *   - field is `workspaceRoot` + separate optional `testRoot`, NOT a
 *     single combined `testDir` — this actually matches this file's
 *     very first draft (before it got collapsed into `testDir` in a
 *     later revision), so the original instinct was closer to right.
 *   - `allowedBrowsers` is OPTIONAL here, not required/min(1) — a
 *     project with it omitted presumably falls back to some agent-wide
 *     default, not "no browsers allowed".
 *   - THREE fields this file never had at all:
 *       `enabled?` — lets a project opt out of Playwright entirely
 *       `config?` — path to a project-specific playwright.config.ts
 *       `allowWorkspaceExecution?` — gates whether "workspace" (ad-hoc
 *         code) jobs are permitted for this project at all, separate
 *         from allowHeaded
 *       `allowedBaseUrls?` — a real security control this file
 *         completely missed: restricts what URLs ad-hoc workspace code
 *         may navigate to. Exact enforcement point is NOT evidenced by
 *         agent/src/types.ts alone (it's only a type, not the code that
 *         reads it) — see assertBaseUrlAllowed's comment below for the
 *         reasonable-but-unconfirmed interpretation used here.
 *
 * Where this actually integrates: agent/src/ (a real, separate
 * compilation unit from src/lib/playwright-runner/ — confirmed by
 * multiple pieces of evidence throughout this conversation, e.g. the
 * duplicated ID_REGEX). This file is NOT wired into that real code; it's
 * a corrected reference implementation matching the confirmed type,
 * pending the actual config-loading/validation code from agent/src/
 * (e.g. wherever AgentConfigSchema or equivalent lives on the agent
 * side) being shared.
 */

const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const EnvVarNameSchema = z.string().regex(ENV_VAR_NAME_PATTERN, {
  message: "env var names must be UPPER_SNAKE_CASE",
});

/**
 * Matches AgentPlaywrightProjectConfig from agent/src/types.ts field for
 * field. `projectId` is NOT part of that real interface (it's implied by
 * nesting under a project entry, same as job-store's real
 * AgentProjectConfig.playwright) — added here only as an explicit param
 * to the functions below rather than a schema field, so this module's
 * functions don't need the caller to thread project id separately.
 */
export const PlaywrightProjectSecurityConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    workspaceRoot: z.string().min(1),
    testRoot: z.string().optional(),
    config: z.string().optional(),
    allowedBrowsers: z.array(BrowserNameSchema).optional(),
    allowHeaded: z.boolean().optional(),
    allowWorkspaceExecution: z.boolean().optional(),
    maxTimeoutSeconds: z.number().int().min(1).max(1800).optional(),
    envAllowlist: z.array(EnvVarNameSchema).optional(),
    allowedBaseUrls: z.array(z.string().url()).optional(),
  })
  .strict();

export type PlaywrightProjectSecurityConfig = z.infer<
  typeof PlaywrightProjectSecurityConfigSchema
>;

const DEFAULT_TEST_ROOT = "e2e";
const DEFAULT_MAX_TIMEOUT_SECONDS = 300;

/**
 * Resolve a client-supplied relative test path against the project's
 * configured workspaceRoot + testRoot (testRoot defaults to "e2e" to
 * match the existing playwright.config.ts testDir, same default as
 * before), and verify the result cannot escape it.
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

  const testRootAbs = path.resolve(
    config.workspaceRoot,
    config.testRoot ?? DEFAULT_TEST_ROOT,
  );
  const resolved = path.resolve(testRootAbs, relativePath);

  const relationToRoot = path.relative(testRootAbs, resolved);
  const escapesRoot =
    relationToRoot.startsWith("..") || path.isAbsolute(relationToRoot);

  if (escapesRoot) {
    throw new Error("test path resolves outside the allowed test root");
  }

  return resolved;
}

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
 * Build the environment object to pass to a spawned Playwright process.
 * envAllowlist is now optional (matching the real type) — treated as
 * "no extra env vars allowed" when omitted, same as an empty array.
 */
export function buildAllowedEnv(
  config: PlaywrightProjectSecurityConfig,
  processEnv: NodeJS.ProcessEnv,
  baseline: string[] = ["PATH", "PATHEXT", "SystemRoot", "TEMP", "TMP"],
): Record<string, string> {
  const result: Record<string, string> = {};
  const allowedNames = new Set([...baseline, ...(config.envAllowlist ?? [])]);

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
 * Validate a requested browser/mode pair. allowedBrowsers being optional
 * now means "no restriction beyond the agent's own capabilities" when
 * omitted — NOT "nothing allowed" (that would make the field's
 * optionality pointless). allowHeaded/allowWorkspaceExecution default to
 * false when omitted (fail-closed for the two boolean gates, since those
 * genuinely could go either way and false is the safer default absent
 * evidence of the real fallback).
 */
/**
 * CONFIRMED against real agent/src/playwright-executor.ts
 * (preparePlaywrightExecution). The earlier version of this function
 * had BOTH defaults backwards — a genuine correctness bug, not just a
 * location/naming mismatch like catalog.ts/command-builder.ts:
 *
 *   Real: `const allowedBrowsers = pw.allowedBrowsers || ["chromium"];`
 *     — omitted allowedBrowsers defaults to CHROMIUM ONLY, not
 *     "unrestricted" as this function previously assumed.
 *   Real: `if (job.mode === "headed" && pw.allowHeaded === false)`
 *     — headed mode is ALLOWED unless allowHeaded is explicitly false.
 *     Omitted/undefined allowHeaded means headed IS allowed — the
 *     opposite of this function's earlier fail-closed default.
 *
 * If this function is ever actually used, it must fail the same way
 * the real code does, not a safer-seeming but factually wrong default.
 */
export function assertBrowserModeAllowed(
  config: PlaywrightProjectSecurityConfig,
  browsers: readonly string[],
  mode: "headless" | "headed",
): void {
  const allowedBrowsers = config.allowedBrowsers ?? ["chromium"];
  const disallowed = browsers.filter(
    (browser) => !allowedBrowsers.includes(browser as never),
  );
  if (disallowed.length > 0) {
    throw new Error(
      `browser(s) not allowed for this project: ${disallowed.join(", ")}`,
    );
  }
  if (mode === "headed" && config.allowHeaded === false) {
    throw new Error("headed mode is not allowed for this project");
  }
}

/**
 * CONFIRMED against real agent/src/playwright-executor.ts: `if
 * (pw.allowWorkspaceExecution === false) throw ...` — same fail-open
 * pattern as allowHeaded above. Omitted means ALLOWED, only an explicit
 * `false` blocks it. Previous version of this function had this
 * backwards too.
 */
export function assertWorkspaceExecutionAllowed(
  config: PlaywrightProjectSecurityConfig,
): void {
  if (config.allowWorkspaceExecution === false) {
    throw new Error(
      "workspace (ad-hoc code) execution is not allowed for this project",
    );
  }
}

/**
 * Check a target base URL against the project's allowedBaseUrls.
 *
 * UNCONFIRMED ENFORCEMENT POINT: agent/src/types.ts only proves this
 * FIELD exists on the config, not how/where it's actually checked. The
 * most plausible use (given "workspace" jobs run arbitrary test author
 * code that could navigate anywhere) is validating an intended baseURL
 * — supplied alongside the job, or extracted from the workspace code's
 * own playwright.config.ts equivalent / BASE_URL usage — against this
 * allowlist before the job runs. That extraction step is NOT built here
 * (it would require parsing the submitted code, which is a much bigger
 * task than this function). This only does the allowlist COMPARISON
 * once a candidate URL is known by some other means; wiring in the
 * actual "how do we know what URL the code will hit" logic is still
 * open. Matches by origin (scheme + host + port), not exact string
 * equality, since e.g. "https://example.com" should reasonably allow
 * "https://example.com/login".
 */
export function assertBaseUrlAllowed(
  config: PlaywrightProjectSecurityConfig,
  targetUrl: string,
): void {
  if (!config.allowedBaseUrls || config.allowedBaseUrls.length === 0) {
    // No restriction configured. Whether an EMPTY/omitted list should
    // instead mean "nothing allowed" (fail-closed) rather than "no
    // restriction" is itself unconfirmed — flagged rather than guessed
    // silently either way.
    return;
  }

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    throw new Error("target URL is invalid");
  }

  const allowed = config.allowedBaseUrls.some((allowedUrl) => {
    try {
      const allowedOrigin = new URL(allowedUrl).origin;
      return target.origin === allowedOrigin;
    } catch {
      return false;
    }
  });

  if (!allowed) {
    throw new Error(
      `target URL is not in the project's allowedBaseUrls: ${target.origin}`,
    );
  }
}
