# Vercel Schema Export Fix Implementation Plan

> **For agentic workers:** Execute inline and track with checkboxes. Git operations are intentionally omitted because the user manages Git manually.

**Goal:** Restore the legacy test-runner schema file overwritten by the latest Playwright schema change so Vercel can compile while the project continues migrating to the new runner.

**Architecture:** Keep the two runner schema modules isolated. Legacy routes import `src/lib/test-runner/schemas.ts`; the new system imports `src/lib/playwright-runner/schemas.ts`. The deployment fix restores the overwritten legacy file and does not alter the new Playwright architecture.

**Tech Stack:** Next.js, TypeScript, Zod, Vitest, Vercel production build

## Verification Status (2026-08-29)

- [x] Root cause confirmed against latest commit `8ef9a55`: Playwright schema content was duplicated over the legacy module.
- [x] `src/lib/test-runner/schemas.ts` contains the legacy route contracts again.
- [x] The new architecture keeps Playwright validation at `src/lib/playwright-runner/schemas.ts`.
- [x] Focused unit/integration verification passes: 3 files, 12 tests.
- [x] `npm run lint`, `npm run typecheck`, and `npm run build` exit 0.

### Later workspace review (2026-08-29)

- The schema fix remains valid: typecheck, 64 test files/274 tests, Agent build, and Next build pass.
- Repository lint now fails with 9 errors introduced or exposed by later Playwright UI/store work. This does not reopen the schema bug, but it blocks the next deployment until corrected.
- Treat the successful lint statement above as the result at the time this schema fix was completed, not the current repository-wide release status.

## Global Constraints

- Preserve all existing legacy exports and validation rules.
- Preserve the new Playwright schemas only in `src/lib/playwright-runner/schemas.ts`.
- Do not weaken `.strict()` request validation or allow command/cwd/env input.
- Do not change API route paths or request payloads.
- Do not run Git commands.

### Task 1: Restore the Correct Module Boundary

**Files:**
- Modify: `tests/unit/test-runner/schemas.test.ts`
- Restore: `src/lib/test-runner/schemas.ts`
- Verify: `src/lib/playwright-runner/schemas.ts`

- [x] Confirm commit `8ef9a55` accidentally duplicated Playwright schemas into `src/lib/test-runner/schemas.ts`.
- [x] Restore legacy exports including `PollRequestSchema`, `AppendLogBatchSchema`, `AgentHeartbeatSchema`, `CompleteJobSchema`, and `CreateJobSchema`.
- [x] Leave the new Playwright schemas in `src/lib/playwright-runner/schemas.ts`.
- [x] Run `npx vitest run tests/unit/test-runner/schemas.test.ts`.

### Task 2: Verify the Deployment Boundary

**Files:**
- Verify: `src/app/api/test-runner/agent/poll/route.ts`
- Verify: `src/app/api/test-runner/agent/jobs/[jobId]/heartbeat/route.ts`
- Verify: `src/app/api/test-runner/agent/jobs/[jobId]/logs/route.ts`
- Verify: `src/app/api/test-runner/agent/jobs/[jobId]/complete/route.ts`
- Verify: `src/app/api/test-runner/jobs/route.ts`

- [x] Run `npm run typecheck`.
- [x] Run the test-runner unit and integration tests.
- [x] Run `npm run build` and confirm all test-runner API routes compile.
- [x] Record the root cause and verification result in this plan.

## Self-Review

- [x] Legacy and Playwright schemas remain in separate modules.
- [x] No route imports a missing symbol.
- [x] No validation rule was removed.
- [x] Production build exits 0.
