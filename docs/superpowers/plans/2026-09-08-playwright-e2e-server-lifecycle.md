# Playwright E2E server lifecycle implementation plan

> **For agentic workers:** This plan was executed inline. Git operations remain manual.

**Goal:** Ensure Playwright E2E runs start and stop the local Next.js server reliably on Windows without hanging during teardown or leaving port 3100 occupied.

**Implementation:** Replaced Playwright's `webServer` plugin for this workflow with explicit global setup and teardown. Setup starts the Next entrypoint directly, waits for HTTP readiness, and records only its numeric PID. Teardown terminates that PID's process tree and treats an already-exited process as successful cleanup.

**Verification:**

- Unauthenticated redirect test passed twice consecutively.
- Full browser suite passed 23 tests with 1 expected skip.
- No teardown timeout was reported.
- TypeScript typecheck passed.

**Files:**

- `e2e/global-setup.ts`
- `e2e/global-teardown.ts`
- `playwright.config.ts`
- `docs/superpowers/plans/STATUS.md`

