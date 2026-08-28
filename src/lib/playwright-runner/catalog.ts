import type { PlaywrightTestDescriptor } from "./types";

/**
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

interface RawPlaywrightListOutput {
  suites?: RawPlaywrightSuite[];
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
 * PlaywrightTestDescriptor. Throws if the top-level shape is unrecognized
 * (e.g. Playwright changed its reporter format in a future version) —
 * callers should treat that as "catalog scan failed", not silently
 * publish an empty/partial catalog.
 */
export function parsePlaywrightListOutput(
  raw: unknown,
): PlaywrightTestDescriptor[] {
  if (typeof raw !== "object" || raw === null || !("suites" in raw)) {
    throw new Error("unrecognized playwright --list --reporter=json output");
  }

  const parsed = raw as RawPlaywrightListOutput;
  const out: PlaywrightTestDescriptor[] = [];

  for (const fileSuite of parsed.suites ?? []) {
    // Top-level suite = one per file; its own "specs" are top-level tests
    // in that file (no enclosing describe), "suites" are describe blocks.
    walkSuite(fileSuite, fileSuite.file, [], out);
  }

  return out;
}
