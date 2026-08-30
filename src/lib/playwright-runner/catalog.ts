import type { PlaywrightTestDescriptor } from "./types";

/**
 * ⚠️ LIKELY SUPERSEDED — real agent/src/playwright-catalog.ts exists
 * (confirmed by agent/src/runner.ts's real import:
 *   import { buildPlaywrightCatalogFromConfig, detectBrowserCapabilities }
 *     from "./playwright-catalog.js";
 * ) with a completely different export surface than this file
 * (buildPlaywrightCatalogFromConfig/detectBrowserCapabilities vs this
 * file's parsePlaywrightListOutput). Same pattern as job-store-logic.ts
 * and redaction.ts earlier in this project: don't drop this in over the
 * real file. The real one is async (`await
 * buildPlaywrightCatalogFromConfig(config)`), takes the whole
 * AgentConfig (not raw --list JSON output), and presumably produces the
 * full nested PlaywrightCatalog shape directly — i.e. it may already
 * solve the "flat scan -> nested catalog" assembly gap this file never
 * did. Content not yet seen.
 *
 * Playwright catalog scanner (Task 2.2).
 *
 * Parses the output of `playwright test --list --reporter=json`, run on
 * the agent machine, into the stable PlaywrightTestDescriptor[] the
 * catalog publishes to the server. This is what lets the browser send
 * only opaque `testIds` (never file paths) per the Task 0.1/0.2 contract.
 *
 * Verified against a real @playwright/test 1.62.1 fixture (nested
 * describe blocks + a standalone top-level test) — see accompanying test
 * run. Two things confirmed empirically rather than assumed:
 *   - each spec already carries Playwright's own `id`, e.g.
 *     "d748ac400d08b85935ef-9cca8f2a3e58bcb91748", which is DETERMINISTIC
 *     across repeated `--list` invocations for unchanged source. This is
 *     reused directly as the catalog testId instead of computing a
 *     separate hash — one less thing that can drift from what Playwright
 *     itself considers a test's identity.
 *   - `suite.file` on the top-level (per-file) suite is already relative
 *     to testDir (e.g. "auth.spec.ts"), matching what
 *     resolveTestFilePath() in agent-security-config.ts expects.
 */

interface RawPlaywrightSpec {
  id: string;
  title: string;
  file: string;
  line: number;
}

interface RawPlaywrightSuite {
  title: string;
  file: string;
  specs?: RawPlaywrightSpec[];
  suites?: RawPlaywrightSuite[];
}

interface RawPlaywrightListError {
  message: string;
  location?: { file?: string; line?: number; column?: number };
}

interface RawPlaywrightListOutput {
  suites?: RawPlaywrightSuite[];
  errors?: RawPlaywrightListError[];
}

export interface CatalogScanError {
  file?: string;
  message: string;
}

export interface CatalogScanResult {
  tests: PlaywrightTestDescriptor[];
  errors: CatalogScanError[];
}

const TEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function walkSuite(
  suite: RawPlaywrightSuite,
  relativePath: string,
  groupPath: string[],
  out: PlaywrightTestDescriptor[],
): void {
  for (const spec of suite.specs ?? []) {
    if (!TEST_ID_PATTERN.test(spec.id)) {
      // Defensive: skip anything whose id doesn't match the shape our
      // TestIdSchema (schemas.ts) expects, rather than publishing a
      // testId the job-creation endpoint would reject anyway.
      continue;
    }
    out.push({
      id: spec.id,
      title: spec.title,
      group: groupPath.length > 0 ? groupPath.join(" > ") : "(root)",
      relativePath,
      line: spec.line,
    });
  }

  for (const child of suite.suites ?? []) {
    walkSuite(child, relativePath, [...groupPath, child.title], out);
  }
}

/**
 * Parse the raw JSON object produced by
 * `playwright test --list --reporter=json` into a flat list of
 * PlaywrightTestDescriptor, ALONGSIDE any per-file scan errors.
 *
 * Critically, this does NOT treat "suites: []" as "zero tests" without
 * checking "errors" first — confirmed necessary against a real payload
 * where every spec file failed to load (an ESM/CJS require() mismatch on
 * the "jose" package) and Playwright reported `suites: [], errors: [...]`
 * for a project that in fact has 5 test files. Silently returning an
 * empty descriptor list in that case would make a broken catalog scan
 * indistinguishable from a genuinely empty project — a caller (route
 * handler, UI) needs `errors` to tell those apart, the same way this
 * codebase's ProviderSnapshot carries `error` alongside possibly-partial
 * `events` rather than replacing them.
 *
 * Throws only if the top-level shape is unrecognized (not even a
 * `suites` or `errors` key) — that indicates Playwright's reporter format
 * itself changed, not a per-file test error, and should be treated as
 * "catalog scan failed outright" by the caller.
 */
export function parsePlaywrightListOutput(raw: unknown): CatalogScanResult {
  if (
    typeof raw !== "object" ||
    raw === null ||
    (!("suites" in raw) && !("errors" in raw))
  ) {
    throw new Error("unrecognized playwright --list --reporter=json output");
  }

  const parsed = raw as RawPlaywrightListOutput;
  const tests: PlaywrightTestDescriptor[] = [];

  for (const fileSuite of parsed.suites ?? []) {
    walkSuite(fileSuite, fileSuite.file, [], tests);
  }

  const errors: CatalogScanError[] = (parsed.errors ?? []).map((e) => ({
    file: e.location?.file,
    message: e.message,
  }));

  return { tests, errors };
}
