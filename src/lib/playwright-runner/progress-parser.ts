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

import type { TestCaseResultItem, TestExecutionSummary } from "./types";
export type { TestCaseResultItem, TestExecutionSummary };

/**
 * Parses individual test cases, suites, UAT titles, and errors from Playwright log output lines.
 */
export function parsePlaywrightTestCases(
  rawLines: string[],
  context?: {
    uatTitle?: string;
    uatId?: string;
    defaultBrowser?: string;
  },
): TestExecutionSummary {
  const cases: TestCaseResultItem[] = [];
  const seenIds = new Set<string>();

  let detectedUatId = context?.uatId;
  let detectedUatTitle = context?.uatTitle;
  let totalDuration: string | undefined;
  let activeFailedCase: TestCaseResultItem | null = null;

  for (const raw of rawLines) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line) continue;

    // Detect total duration (e.g. "1 passed (47.7s)" or "2 failed, 1 passed (47.7s)")
    const durMatch = line.match(/(?:passed|failed|flaky|skipped).*?\(([\d.]+[m]?s)\)/i);
    if (durMatch && !totalDuration) {
      totalDuration = durMatch[1];
    }

    // Try to detect UAT title if not yet detected
    if (!detectedUatTitle) {
      const uatMatch = line.match(/(FN-STS-\d+(?:\s*\([^)]+\))?(?::\s*[^›\n\r]+)?)/i);
      if (uatMatch) {
        detectedUatTitle = uatMatch[1].trim();
        const idMatch = detectedUatTitle.match(/(FN-STS-\d+)/i);
        if (idMatch) detectedUatId = idMatch[1].toUpperCase();
      }
    }

    // Check for standard line/list test result:
    // e.g. "ok 1 [chromium] › ... › TC-STS-AUTH-TEACHER: Login as teacher succeeds (6.8s)"
    // or   "x  2 [chromium] › ... › TC-STS-AUTH-DIRECTOR: Login as director succeeds (18.6s)"
    // or   "✓ 1 [chromium] › ... › TC-STS-AUTH-001: Login test (1.2s)"
    const testLineMatch = line.match(
      /^(?:ok|x|✓|✗|✖)\s+\d+\s+\[([^\]]+)\]\s+›\s+(.*)$/i,
    );

    if (testLineMatch) {
      const isPass = line.startsWith("ok") || line.startsWith("✓");
      const fullPath = testLineMatch[2];

      // Extract duration if present at end: (6.8s)
      let duration: string | undefined;
      let pathWithoutDuration = fullPath;
      const durEndMatch = fullPath.match(/\s+\(([\d.]+[m]?s)\)\s*$/);
      if (durEndMatch) {
        duration = durEndMatch[1];
        pathWithoutDuration = fullPath.slice(0, durEndMatch.index).trim();
      }

      // Check breadcrumbs: segments separated by '›'
      const segments = pathWithoutDuration.split("›").map((s) => s.trim());
      const lastSegment = segments[segments.length - 1] || pathWithoutDuration;

      // Extract suite name if it looks like FN-STS-...
      for (const seg of segments) {
        if (!detectedUatTitle && /FN-STS-\d+/i.test(seg)) {
          detectedUatTitle = seg;
          const m = seg.match(/(FN-STS-\d+)/i);
          if (m) detectedUatId = m[1].toUpperCase();
        }
      }

      // Parse ID and Title from last segment (e.g. "TC-STS-AUTH-TEACHER: Login as teacher succeeds")
      let caseId = `TC-${cases.length + 1}`;
      let caseTitle = lastSegment;

      const tcPrefixMatch = lastSegment.match(/^(TC-[A-Za-z0-9_-]+)(?::\s*|\s*-\s*)(.*)$/);
      if (tcPrefixMatch) {
        caseId = tcPrefixMatch[1].trim();
        caseTitle = tcPrefixMatch[2].trim() || caseId;
      } else {
        const anyIdMatch = lastSegment.match(/^([A-Z0-9_-]+): (.*)$/);
        if (anyIdMatch && anyIdMatch[1].length <= 25) {
          caseId = anyIdMatch[1].trim();
          caseTitle = anyIdMatch[2].trim();
        }
      }

      const caseKey = `${caseId}:${caseTitle}`;
      if (!seenIds.has(caseKey)) {
        seenIds.add(caseKey);
        const item: TestCaseResultItem = {
          id: caseId,
          title: caseTitle,
          status: isPass ? "passed" : "failed",
          duration,
        };
        cases.push(item);
        if (!isPass) {
          activeFailedCase = item;
        }
      }
      continue;
    }

    // Capture error snippet for failed test case
    if (activeFailedCase) {
      if (line.startsWith("Error:") || line.startsWith("Expected pattern:") || line.startsWith("Received string:")) {
        if (!activeFailedCase.error) {
          activeFailedCase.error = line;
        } else if (activeFailedCase.error.length < 180 && !activeFailedCase.error.includes(line)) {
          activeFailedCase.error += ` | ${line}`;
        }
      } else if (/^\d+\)\s+\[/.test(line)) {
        // Next failure block begins
        const match = line.match(/(TC-[A-Za-z0-9_-]+)/);
        if (match) {
          const target = cases.find((c) => c.id === match[1]);
          if (target) activeFailedCase = target;
        }
      }
    }
  }

  const passed = cases.filter((c) => c.status === "passed").length;
  const failed = cases.filter((c) => c.status === "failed").length;
  const skipped = cases.filter((c) => c.status === "skipped").length;

  return {
    uatId: detectedUatId,
    uatTitle: detectedUatTitle,
    total: cases.length,
    passed,
    failed,
    skipped,
    duration: totalDuration,
    cases,
  };
}

/**
 * Extracts a complete TestExecutionSummary given a job descriptor and log output.
 * If log lines did not contain individual test breakdown, synthesizes cases from job.code or job.testIds.
 */
export function extractTestExecutionSummary(
  job: {
    id?: string;
    code?: string;
    presetName?: string;
    source?: string;
    testIds?: string[];
    status?: string;
    browsers?: string[];
    browserResults?: Array<{ browser: string; passed: number; failed: number; skipped: number; durationMs?: number }>;
  },
  rawLines: string[] = [],
): TestExecutionSummary {
  // First, parse whatever test case lines were streamed in logs
  const parsed = parsePlaywrightTestCases(rawLines);

  // If UAT title wasn't found from logs, extract from job code comments or presetName
  let uatTitle = parsed.uatTitle || job.presetName;
  let uatId = parsed.uatId;

  if (!uatTitle && job.code) {
    const codeMatch = job.code.match(/\/\/\s*🧪\s*(?:ชุดทดสอบระบบ\s*ProjectSTS:\s*)?(FN-STS-\d+.*?)(?:\r?\n|$)/i);
    if (codeMatch) {
      uatTitle = codeMatch[1].trim();
      const idMatch = uatTitle.match(/(FN-STS-\d+)/i);
      if (idMatch) uatId = idMatch[1].toUpperCase();
    }
  }

  if (!uatTitle && job.testIds && job.testIds.length > 0) {
    const firstTest = job.testIds[0];
    uatTitle = firstTest;
    const idMatch = firstTest.match(/(FN-STS-\d+)/i);
    if (idMatch) uatId = idMatch[1].toUpperCase();
  }

  // Calculate browser aggregate numbers if present
  let browserPassed = 0;
  let browserFailed = 0;
  let totalDurationMs = 0;

  if (job.browserResults && job.browserResults.length > 0) {
    for (const br of job.browserResults) {
      browserPassed += br.passed;
      browserFailed += br.failed;
      if (br.durationMs) totalDurationMs = Math.max(totalDurationMs, br.durationMs);
    }
  }

  const durationStr =
    parsed.duration ||
    (totalDurationMs > 0 ? `${(totalDurationMs / 1000).toFixed(1)}s` : undefined);

  // If parsed cases are already found from logs, return them
  if (parsed.cases.length > 0) {
    return {
      uatId: uatId || parsed.uatId,
      uatTitle: uatTitle || parsed.uatTitle,
      total: parsed.cases.length,
      passed: parsed.passed,
      failed: parsed.failed,
      skipped: parsed.skipped,
      duration: durationStr,
      cases: parsed.cases,
    };
  }

  // Fallback: If no individual test lines were parsed, synthesize cases from code or testIds
  const cases: TestCaseResultItem[] = [];
  const isJobPass = job.status === "passed";
  const isJobFail = job.status === "failed";
  const fallbackStatus: "passed" | "failed" = isJobPass ? "passed" : isJobFail ? "failed" : "passed";

  if (job.code) {
    const testMatches = Array.from(job.code.matchAll(/test\s*\(\s*["'`](.*?)["'`]/g));
    for (const m of testMatches) {
      const fullTitle = m[1].trim();
      let caseId = `TC-${cases.length + 1}`;
      let caseTitle = fullTitle;

      const tcPrefixMatch = fullTitle.match(/^(TC-[A-Za-z0-9_-]+)(?::\s*|\s*-\s*)(.*)$/);
      if (tcPrefixMatch) {
        caseId = tcPrefixMatch[1].trim();
        caseTitle = tcPrefixMatch[2].trim() || caseId;
      }
      cases.push({
        id: caseId,
        title: caseTitle,
        status: fallbackStatus,
        duration: durationStr,
      });
    }
  }

  if (cases.length === 0 && job.testIds && job.testIds.length > 0) {
    for (const tid of job.testIds) {
      cases.push({
        id: tid,
        title: tid,
        status: fallbackStatus,
        duration: durationStr,
      });
    }
  }

  if (cases.length === 0) {
    cases.push({
      id: "TC-RUN-01",
      title: uatTitle || "Workspace Playwright Execution",
      status: fallbackStatus,
      duration: durationStr,
    });
  }

  const passedCount = isJobPass ? cases.length : isJobFail ? Math.max(0, cases.length - 1) : cases.length;
  const failedCount = isJobFail ? Math.max(1, cases.length - passedCount) : 0;

  return {
    uatId,
    uatTitle: uatTitle || "Playwright Test Execution",
    total: cases.length,
    passed: browserPassed > 0 ? browserPassed : passedCount,
    failed: browserFailed > 0 ? browserFailed : failedCount,
    duration: durationStr,
    cases,
  };
}

/**
 * Formats a clean, prominent ASCII/Unicode summary box suitable for terminal display.
 */
export function formatTerminalSummary(
  summary: TestExecutionSummary,
  options?: {
    browsers?: string[];
    mode?: string;
  },
): string[] {
  const border = "=".repeat(78);
  const divider = "─".repeat(78);

  const uat = summary.uatTitle || summary.uatId || "General Test Execution";
  const browsers =
    options?.browsers && options.browsers.length > 0 ? options.browsers.join(", ") : "chromium";
  const duration = summary.duration || "N/A";
  const passCount = summary.passed;
  const failCount = summary.failed;
  const totalCount = summary.total || passCount + failCount;

  const lines: string[] = [];
  lines.push(border);
  lines.push("🎯 TEST EXECUTION & UAT SUMMARY / สรุปผลการทดสอบระบบ");
  lines.push(border);
  lines.push(`📋 UAT Module : ${uat}`);
  lines.push(`🌐 Browser(s)  : ${browsers}`);
  lines.push(`⏱️ Total Time  : ${duration}`);
  lines.push(`📊 Overview    : ${totalCount} Total | ผ่าน (Passed): ${passCount} | ไม่ผ่าน (Failed): ${failCount}`);

  if (summary.cases.length > 0) {
    lines.push("");
    lines.push("[ รายละเอียดผลการทดสอบแต่ละ Test Case (Breakdown) ]");
    lines.push(divider);
    for (const c of summary.cases) {
      const isPass = c.status === "passed";
      const icon = isPass ? "✅" : "❌";
      const tag = isPass ? "[PASS]" : "[FAIL]";
      const timeStr = c.duration ? ` (${c.duration})` : "";
      const idStr = c.id ? `${c.id}: ` : "";
      lines.push(`  ${tag} ${icon} ${idStr}${c.title}${timeStr}`);
      if (c.error && !isPass) {
        lines.push(`         ⚠️ ${c.error}`);
      }
    }
    lines.push(divider);
  }

  const isAllPassed = failCount === 0 && passCount > 0;
  if (isAllPassed) {
    lines.push("🚦 FINAL RESULT: ALL TESTS PASSED ✅ (ผ่านทุกกรณีทดสอบ)");
  } else if (failCount > 0) {
    lines.push(`🚦 FINAL RESULT: FAILED ❌ (พบข้อผิดพลาด ${failCount} จาก ${totalCount} เคส)`);
  } else {
    lines.push("🚦 FINAL RESULT: COMPLETED ℹ️");
  }
  lines.push(border);

  return lines;
}
