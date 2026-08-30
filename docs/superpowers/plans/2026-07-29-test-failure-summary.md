# Test failure summary Implementation Plan

> Status: Completed and verified. Archived from active tracking on 2026-08-30.

> **For agentic workers:** This plan is being executed inline in the current task. Git operations are intentionally omitted; the user will handle them manually.

**Goal:** Add a server-side rules-only failure analyzer that persists a useful cause-and-fix summary on failed test jobs and renders it in the existing test runner.

**Architecture:** A pure analyzer maps job status, completion error, exit code, and retained log lines to a typed `FailureAnalysis`. `completeJob` runs it after the agent has uploaded logs and stores the result on `TestJob`; the existing polling response carries it to `RunProgress`, which renders it inline. No API key, provider, or new package is required.

**Tech Stack:** Next.js App Router, TypeScript, Redis-backed test-runner store, React, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Rules-only analysis; no external AI call and no API key.
- Analyze only redacted, persisted test-runner output.
- Preserve existing job lifecycle and terminal log behavior.
- Do not run git add, git commit, reset, checkout, or other git mutations.

### Task 1: Define the failure analysis contract

**Files:**
- Modify: `src/lib/test-runner/types.ts`
- Test: `tests/unit/test-runner/failure-analysis.test.ts`

**Interfaces:**
- Produce `FailureAnalysis` and `FailureAnalysisCategory` types for the analyzer, store, and UI.
- Add optional `failureAnalysis?: FailureAnalysis` to `TestJob`.

- [x] Add the discriminated category and confidence unions and the `FailureAnalysis` interface.
- [x] Add the optional field to `TestJob` so old Redis jobs remain valid.
- [x] Add typed fixtures in the analyzer test file that compile against the new contract.

### Task 2: Implement deterministic failure rules

**Files:**
- Create: `src/lib/test-runner/failure-analysis.ts`
- Test: `tests/unit/test-runner/failure-analysis.test.ts`

**Interfaces:**
- Consume `TestJobStatus`, `TestLogLine`, and optional completion error/exit code.
- Produce `analyzeTestFailure(input: FailureAnalysisInput): FailureAnalysis`.

- [x] Write failing tests for timeout, agent loss, dependency, environment, connection/Redis, permission, assertion, syntax, and unknown cases.
- [x] Write tests proving status-specific timeout and agent rules win over generic log text.
- [x] Write tests proving evidence is capped at three entries and falls back to error/exit code when logs are empty.
- [x] Implement normalized case-insensitive matching with ordered rules and plain-language recommendations.
- [x] Select concise evidence from matching log lines and the completion error without mutating stored logs.
- [x] Return a low-confidence unknown result when no rule matches.

### Task 3: Persist analysis when a job completes

**Files:**
- Modify: `src/lib/test-runner/store.ts`
- Test: `tests/unit/test-runner/store.test.ts`

**Interfaces:**
- `completeJob` calls `readLogPage(jobId, -1, MAX_LOG_LINES)` and passes the retained lines plus completion result to `analyzeTestFailure` for failure terminal states.
- Passed and cancelled jobs clear/omit `failureAnalysis`.

- [x] Add a store test that appends a connection error, completes the job as failed, and expects the persisted category, cause, and evidence.
- [x] Add a store test that completes a job as passed and expects no failure analysis.
- [x] Read the retained log page before writing the completed job so analysis includes the final batch.
- [x] Persist `failureAnalysis` only for `failed`, `timed_out`, and `agent_lost`, while preserving existing completion fields and lease release behavior.
- [x] Keep old jobs and jobs without logs compatible through the unknown fallback.

### Task 4: Render the summary in the existing progress panel

**Files:**
- Modify: `src/components/test-runner/RunProgress.tsx`
- Test: `tests/components/RunProgress.test.tsx`

**Interfaces:**
- Consume `activeJob.failureAnalysis` and history job `failureAnalysis` from the existing `TestJob` object.
- Render no additional network request and no new route.

- [x] Add component tests for a failed job with analysis, a passed job, and a failed job without analysis.
- [x] Render a compact `Failure summary` block below the existing error notice with cause, fix location, recommendation, evidence, and confidence.
- [x] Render the summary title and fix location as a compact preview inside each matching failed history item so it remains visible after refresh.
- [x] Use existing dark product tokens, semantic rose/amber/cyan colors, readable text sizes, and `aria-live="polite"`.
- [x] Keep the existing cancel control, status badge, progress bar, and raw log terminal behavior unchanged.

### Task 5: Verify the integrated feature

**Files:**
- Review: `src/lib/test-runner/failure-analysis.ts`
- Review: `src/lib/test-runner/store.ts`
- Review: `src/components/test-runner/RunProgress.tsx`

- [x] Run targeted failure-analysis, store, progress, and history tests; all 24 tests pass.
- [x] Run `npm run test`; all 55 files and 232 tests pass.
- [x] Run `npm run typecheck`; no TypeScript errors.
- [x] Run `npm run lint`; no lint errors.
- [x] Run `npm run build`; production build succeeds.
- [x] Report changed files and verification results without performing git operations.
