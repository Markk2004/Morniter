/**
 * ⚠️ CONFIRMED NOT USED for Playwright jobs in the real agent. Real
 * agent/src/playwright-executor.ts's runPlaywrightExecution does its own
 * pass/fail counting with dead-simple per-line substring matching —
 * every stdout/stderr line is checked for "passed" or a checkmark
 * character to increment ALL browsers' passed count, and "failed" / an
 * X character / "Error:" to increment ALL browsers' failed count. No
 * "[i/N]" step parsing, no summary-line parsing, nothing resembling this
 * file's structured PlaywrightRunProgress state machine. This file's
 * earlier "usage unconfirmed" flag is now upgraded to "confirmed
 * unused, at least in this code path" — the real code doesn't need or
 * want the precision this file provides; it takes a much cruder
 * approach and moves on.
 *
 * Playwright live-run progress parser.
 *
 * Parallel to the existing Jest/Vitest/Cypress "Framework Progress
 * Parsers" documented in ARCHITECTURE.md ("extract test counts and
 * completion percentages; unknown frameworks fall back safely without
 * inventing arbitrary progress percentages"). This is that same idea for
 * `playwright test --reporter=line` stdout.
 *
 * Built against REAL captured output (not a guessed format) from two
 * actual runs in this environment:
 *
 *   Running 4 tests using 1 worker
 *
 *   [1/4] e2e/auth.spec.ts:4:7 › auth › login works
 *   [2/4] e2e/auth.spec.ts:5:7 › auth › logout works
 *   [3/4] e2e/auth.spec.ts:8:5 › standalone smoke test
 *   [4/4] e2e/nested.spec.ts:4:9 › outer › inner › deeply nested test
 *     4 passed (614ms)
 *
 * and, for a run with a failure:
 *
 *   Running 2 tests using 1 worker
 *
 *   [1/2] e2e/failing.spec.ts:2:5 › this one fails
 *     1) e2e/failing.spec.ts:2:5 › this one fails ──────────────────
 *     ...error details...
 *   [2/2] e2e/failing.spec.ts:3:5 › this one passes
 *     1 failed
 *       e2e/failing.spec.ts:2:5 › this one fails ────────────────────
 *     1 passed (1.7s)
 *
 * Key observation from the real output: a "N failed" summary line has NO
 * duration suffix, but the LAST summary line always does (e.g.
 * "1 passed (1.7s)") — that's what marks true run completion here, since
 * "[i/N]" progress lines keep incrementing through failures too (failure
 * detail is interleaved, not a separate terminal state).
 *
 * A SECOND thing confirmed only by forcing real concurrency (3 workers,
 * staggered artificial delays so finish order would differ from start
 * order if the counter tracked completions): the "[i/N]" counter turned
 * out to increment in strict dispatch order (1,2,3,4,5,6) regardless of
 * which worker or how long each test took — i.e. it counts tests as they
 * START, not as they FINISH. With multiple workers several tests can be
 * "started" but not yet finished at once, so this number is NOT a safe
 * proxy for "how many are done" the way it would be with a single worker.
 * The field is named `started` below (not `completed`) to avoid silently
 * mislabeling this, and progressPercentage() caps below 100 until `done`
 * is actually true, so a progress bar can never claim finished when it
 * isn't. Line reporter gives no other real-time per-test completion
 * signal — true completion is only knowable from the final summary line.
 */

export interface PlaywrightRunProgress {
  total: number | null;
  /**
   * Count of tests DISPATCHED/STARTED so far, per the "[i/N]" counter —
   * NOT a count of finished tests. With more than one worker this can be
   * ahead of how many tests have actually completed. See file header.
   */
  started: number | null;
  currentLabel: string | null;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  done: boolean;
}

export function createInitialProgress(): PlaywrightRunProgress {
  return {
    total: null,
    started: null,
    currentLabel: null,
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    done: false,
  };
}

const HEADER_PATTERN = /^Running (\d+) tests? using \d+ workers?/;
const STEP_PATTERN = /^\[(\d+)\/(\d+)\]\s+(.+)$/;
const SUMMARY_PATTERN =
  /^\s*(\d+)\s+(passed|failed|flaky|skipped)\b(?:\s*\(([\d.]+)(ms|s|m))?/;

/**
 * Feed one line of stdout into the current progress state, returning the
 * updated state. Unrecognized lines (error stack traces, failure detail
 * blocks, blank lines) are returned unchanged — this deliberately does
 * NOT try to parse everything Playwright prints, only the specific lines
 * that carry progress/summary information, matching the "fall back
 * safely" philosophy for anything it doesn't recognize.
 */
export function ingestPlaywrightLine(
  progress: PlaywrightRunProgress,
  rawLine: string,
): PlaywrightRunProgress {
  const line = rawLine.replace(/\r$/, "");

  const header = line.match(HEADER_PATTERN);
  if (header) {
    return { ...progress, total: Number(header[1]) };
  }

  const step = line.match(STEP_PATTERN);
  if (step) {
    return {
      ...progress,
      started: Number(step[1]),
      total: Number(step[2]),
      currentLabel: step[3].trim(),
    };
  }

  const summary = line.match(SUMMARY_PATTERN);
  if (summary) {
    const count = Number(summary[1]);
    const status = summary[2] as "passed" | "failed" | "flaky" | "skipped";
    const hasDuration = summary[3] !== undefined;
    const updated: PlaywrightRunProgress = { ...progress, [status]: count };
    if (hasDuration) {
      updated.done = true;
    }
    return updated;
  }

  return progress;
}

/**
 * Convenience: process a whole stdout chunk (may contain multiple lines,
 * as arrives from a spawn'd process's data event) in one call.
 */
export function ingestPlaywrightChunk(
  progress: PlaywrightRunProgress,
  chunk: string,
): PlaywrightRunProgress {
  let state = progress;
  for (const line of chunk.split("\n")) {
    state = ingestPlaywrightLine(state, line);
  }
  return state;
}

/**
 * Approximate completion percentage, based on tests STARTED (see
 * PlaywrightRunProgress.started) rather than true completions — the line
 * reporter gives no better real-time signal with multiple workers. This
 * is deliberately capped below 100 until `done` is actually true, so a
 * progress bar can never claim "finished" while the process is still
 * running (which a naive started/total ratio could do, since the last
 * test can be "started" well before it — or slower sibling tests in
 * other workers — actually finish).
 */
export function progressPercentage(
  progress: PlaywrightRunProgress,
): number | null {
  if (progress.done) {
    return 100;
  }
  if (
    progress.total == null ||
    progress.started == null ||
    progress.total === 0
  ) {
    return null;
  }
  const raw = Math.round((progress.started / progress.total) * 100);
  return Math.min(99, raw);
}
