# Project plan status

Last reviewed: 2026-09-01

This page is the team-facing source of truth for implementation progress. A plan marked "implemented locally" may still require deployment or production verification. Detailed checklists remain in each linked plan.

Historical task checkboxes inside older plans are not retroactively marked complete unless the corresponding implementation and verification can be confirmed. Use the status sections at the top of the active plans and this page for current progress.

## Current release status

- Deployment blocker from the overwritten legacy schema is fixed in the local workspace.
- `npm run typecheck`: passed on 2026-09-01 (0 errors).
- `npm run lint`: passed on 2026-09-01 (0 errors, 0 warnings).
- `npm test`: passed, 100 files and 434 tests on 2026-09-01.
- `npx playwright test`: passed, 17 tests with 1 expected skip across all 8 spec files on 2026-09-01.
- `npm run test-agent:build` / `npm run agent:build`: passed on 2026-09-01.
- `npm run build`: passed and generated 26/26 static & dynamic routes on 2026-09-01.
- **Playwright Interactive UI Session**: Fully implemented locally and verified (Selected-test Playwright UI `--ui` `--ui-host=127.0.0.1` `--ui-port=0` on Local Agent desktop, single browser enforcement, Agent-exclusive session with active lease maintenance up to 30 minutes, idempotently terminated process tree on operator `Stop UI`, user window close, timeout, or process error, mapped terminal status `session_closed` with reason `user_closed | operator_stopped | timeout | process_error`, local loopback URL suppression emitting `[UI] Local Playwright UI ready`, workspace controls with operator guidance banner and 30-min badge, 85 Vitest test files with 411 passing tests, clean TypeScript typecheck, clean lint, and production Next.js build).
- **Playwright Realtime Terminal Recovery**: Fully implemented locally and verified (Inclusive next-unread sequence log cursor in Redis store, automatic recovery from expired execution session `403 EXECUTION_REQUIRED` with accessible alert and unlock panel, safe run summary metadata emission `[RUN] Project | Source | Tests | Browsers | Mode` excluding paths and secrets, bounded final log reconciliation [250ms polling, up to 3 attempts, hasMore continuation], authenticated recovery E2E test, and real Local Agent smoke test passing 8/8 sequential log deliveries).
- **Playwright Workspace Balanced Layout (Layout B)**: Fully implemented locally and verified (Compact horizontal control bar with single Run/Cancel slot and source switcher, strictly bounded viewport height [`h-dvh`] with internal scroll, resizable Explorer [280–440px], full Code Space main column, resizable & collapsible Terminal with accessible `<button>` toggle and effect-driven unread logs tracking [default 240px, min 160px–60% vh], 3-tab layout on narrow viewports [< 900px, 587px] where hidden panels have zero layout contribution, smooth `requestAnimationFrame` dragging with unmount cleanup, safe versioned localStorage persistence, Reset layout action, and zero horizontal document overflow across 1440px, 1024px, 900px, 899px, and 587px viewports).
- **Source-Assisted Playwright Draft Import**: Fully implemented locally and verified (Direct import of `@playwright/test` files, 1-click draft seed `Draft 🪄` on non-Playwright tests and gaps, pure source analyzer engine deriving routes, locators, actions, assertions, and reusable flows with evidence and confidence tags, Recipe Builder step review, isolated browser Draft Run verification requirement, atomic save to `frontend/e2e/generated/`, manual test protection, and immediate catalog refresh into Generated Playwright).
- **Test Explorer Reviewable Matches**: Fully implemented locally and verified (`พร้อมทดสอบ` / `ควรตรวจสอบการจับคู่` confidence partitioning, 10-item incremental limits, `รายละเอียด` inline match details panel, search across full catalog, runner filtering, and legacy backwards compatibility).
- **Test Explorer Sheet Function Labels**: Fully implemented locally and verified (`functionId · functionName` headings, `ตรงกับ Sheet` badge, and multi-field search filtering).
- **Playwright Tutorial Learning Mode**: Fully implemented locally and verified across unit, component, responsive 320px, and E2E suites (17/17 tests passing across all 8 spec files).
- **Gate A (Native Multi-Runner Automation)**: Implemented locally. Mixed-runner command planning, sequential execution, and single-terminal stream tagging are in place and verified in Vitest, Playwright E2E, and real ProjectSTS Local Agent smoke test. Deployed UI verification remains required before release.
- **Gate B (Recipe Builder & Safe Mutation)**: Local hardening is implemented and automated checks pass:
  - Explicit `risk` & `recipeId` job metadata on workspace draft runs preventing mutating bypasses (P0).
  - Agent-owned `testTarget` contract with safe catalog exposure (without publishing `baseUrl`).
  - Canonical URL resolution against `testTarget.baseUrl` with strict `productionHostDenylist` enforcement for both draft runs and mutations.
  - Owner-safe mutation leases using unique `leaseToken`, durable sorted set indexing (`monitor:playwright:v1:mutation-claimed:<agentId>`), stale claim reaping, atomic Lua compare-and-delete, and `LEASE_LOST` rejection if active lease expired or disappeared (P1).
  - Durable claimed index failure handling rolling back active lease and restoring queued mutation (P1).
  - Multi-phase filesystem transaction journal (`.morniter-mutation-journal.json`) with `fsync` durable writing, startup crash recovery (`recoverRecipeTransactions`), SHA-256 hash verification before backup removal, and strict corruption error handling (P1, P2 & Standards).
  - Base revision verification via SHA-256 `mapRevision` of `test-automation-map.json`.
- Real ProjectSTS Local Agent smoke test passed on 2026-09-01 after fixing executor path resolution; the job reached `passed` and delivered terminal lines while running.
- **Production Ready**: Not signed off. Vercel project `jk-godz/morniter` has a Ready production deployment from commit `7ab536e` at `https://monitorsoftdeath.vercel.app`; `/login`, `/manifest.webmanifest`, and `/sw.js` return HTTP 200 there, while the unassigned `https://morniter.vercel.app` alias returns 404. Local authenticated Agent smoke passes; deployed authenticated runner smoke, installed PWA acceptance, and provider/session checks remain.

## Active work

### Active feature: Multi-scenario Playwright function generation

Status: Design approved and implementation plan ready. Implementation has not started.

- Design: [Multi-scenario Playwright function generation design](../specs/2026-09-01-multi-scenario-playwright-function-generation-design.md)
- Plan: [Multi-scenario Playwright function generation implementation plan](2026-09-01-multi-scenario-playwright-function-generation.md)
- Scope: select one mapped ProjectSTS Sheet/UAT function, scan bounded related source and tests, propose up to 10 evidence-backed browser scenarios, review and run selected scenarios sequentially, and atomically save only passing scenarios without exposing local paths or overwriting manual tests.

### Completed: Playwright Interactive UI Session

Status: Fully implemented locally and verified. Typecheck, lint, full Vitest test suite (85 test files / 411 tests passed), agent build, Next.js build, and integration tests pass.

- Design: [Playwright interactive UI session design](../specs/2026-09-01-playwright-interactive-ui-session-design.md)
- Plan: [Playwright interactive UI session implementation plan](2026-09-01-playwright-interactive-ui-session.md)

Completed in local source:
1. Defined interactive job contract: `RunMode = "headless" | "headed" | "interactive"`, `PlaywrightSessionCloseReason = "user_closed" | "operator_stopped" | "timeout" | "process_error"`, and terminal status `session_closed`.
2. Added command preparation in Local Agent: `--ui`, `--ui-host=127.0.0.1`, `--ui-port=0`, single browser, and `project-test` source validation.
3. Handled process lifecycle: 30-minute timeout limit, loopback URL and raw server stdout filtering, emitting `[UI] Local Playwright UI ready` and `[UI] Session closed: <reason>`.
4. Persisted session closure and lease management in Redis store: idempotent terminal transitions and automatic stale reaping to `session_closed`.
5. Added interactive UI controls in Playwright Workspace: `Open Interactive UI` / `Stop UI` actions, single-browser enforcement, operator guidance banner, 30-min limit badge, and close reason descriptions.

### Completed: Playwright realtime terminal recovery

Status: Fully implemented locally and verified. Typecheck, lint, 100-file/434-test Vitest suite, 8-file/17-pass/1-skip Playwright E2E suite, real Local Agent smoke job (8/8 logs sequential delivery), and 26-route Next.js production build pass.

- Design: [Playwright realtime terminal recovery design](../specs/2026-09-01-playwright-realtime-terminal-recovery-design.md)
- Plan: [Playwright realtime terminal recovery implementation plan](2026-09-01-playwright-realtime-terminal-recovery.md)

Completed in local source:
1. Standardized incremental log cursor as next-unread sequence in Redis store (`readPlaywrightLogPage`) preventing omitted lines across multi-batch pagination.
2. Handled `403 EXECUTION_REQUIRED` in `usePlaywrightRunner`, automatically returning the workspace to locked, rendering an accessible expiry alert, and disabling Run until unlocked.
3. Implemented safe run summary in Local Agent (`buildSafeRunSummary`) emitting structured `[RUN]` metadata lines before test child process spawn, strictly excluding local paths, cwds, drive letters, agent tokens, and secrets.
4. Implemented bounded final log reconciliation in `usePlaywrightRunner` (250ms polling, up to 3 empty attempts, `hasMore` continuation) ensuring complete log drain upon job completion.
5. Added authenticated Playwright E2E test covering session expiry recovery, unlock, summary streaming, and log reconciliation; verified full release gates (434 unit/integration tests and 17 browser E2E tests).

### Completed: Playwright Tutorial Learning Mode

Status: Fully implemented locally and verified. Typecheck, lint, 100-file/429-test Vitest suite, 8-file/16-pass/1-skip Playwright E2E suite, and the 26-route production build pass.

- Design: [Playwright Tutorial Learning Mode Design](../specs/2026-08-31-playwright-tutorial-learning-mode-design.md)

Completed in local source:

1. Extended nine-step tutorial catalog with typed chapters (`เตรียมระบบ`, `เลือกการทดสอบ`, `รันและตรวจผล`), icons, and visual identifiers.
2. Implemented fixed outline SVG icons (`TutorialIcon.tsx`) and code-rendered mini UI diagrams (`TutorialVisual.tsx`) without external dependencies or gradients.
3. Replaced spotlight overlay with full-screen Learning mode (`PlaywrightTutorial.tsx`) containing 240px desktop rail and mobile bottom sheet (`TutorialStepRail.tsx`).
4. Implemented directional CSS transitions (`PlaywrightTutorial.module.css`): Next slides left, Previous slides right, direct selection fades, reduced-motion disables movement.
5. Separated Close (does not mark seen) from Skip and Finish (marks seen in localStorage) and suppressed first-open during active test runs.
6. Fixed navigation focus restoration so changing steps no longer returns focus to the Tutorial trigger.
7. Added runner-owned unavailable-state input so targets hidden while Learning mode is active are not incorrectly reported unavailable.
8. Migrated all 5 legacy E2E test files to the Playwright workspace contract, achieving 16 passing and 1 expected skipped Playwright test.
9. Fully verified with `PLAYWRIGHT_AUTH_E2E=1` and mobile 320px viewport without horizontal overflow.

### Active release: Production Release Closeout

Status: Local implementation and automated verification are complete. Production acceptance remains open.

- Plan: [Production Release Closeout Plan](2026-09-01-production-release-closeout.md)

Completed in local source:

- Separate Playwright request schemas and types (`schemas.ts`, `types.ts`);
- Redis job store and bounded store logic (`job-store.ts`);
- Browser and agent API routes under `/api/playwright-runner/*`;
- Local-agent catalog and Playwright executor modules;
- Realtime terminal delivery hardening:
  - `agent/src/log-batcher.ts`: Log batches retained until HTTP upload acknowledged; bounded exponential retry;
  - `agent/src/client.ts`: Safe error diagnostics reporting without exposing tokens, paths, or secrets;
  - `agent/src/runner.ts`: Initial system start log emission and log drain before job completion;
  - `agent/src/single-instance.ts`: Windows-safe process liveness check and single-instance lock per `agentId`;
  - `src/components/playwright-runner/usePlaywrightRunner.ts`: Bounded final log reconciliation upon reaching terminal state;
- Deterministic authenticated E2E test suite in `playwright.config.ts` and `e2e/monitor.spec.ts`:
  - Test-only bcrypt hash derived at runtime via `E2E_GROUP_PASSWORD`;
  - Public `/login` flow with real cookies and sessions;
  - Read-only stubs for catalog and job queries;
  - Keyboard navigation (`ArrowRight`, `ArrowLeft`) & focus containment assertions;
  - Focus restoration on Escape dismissal to trigger button;
  - Storage persistence assertion (`morniter:playwright-tutorial:v1:seen="true"`);
  - Zero mutation requests assertion (`expect(mutationRequests).toEqual([])`);
- Clean automated release gate (typecheck, lint, Vitest 100 files / 429 tests, Agent build, Next.js build, and Playwright E2E with 16 passed and 1 expected skipped).

Remaining for final production sign-off:

1. Confirm that the Ready deployment contains the latest verified local revision; Git push and Vercel deployment remain manual operator actions.
2. Manual verification matrix on installed Chrome/Edge Desktop PWA (manifest, standalone display, cat logo icon, session termination on window close, and service-worker cache boundaries).
3. Complete the deployed Vercel smoke test, including authenticated catalog/job access and production environment variables.

## Completed local implementation records

The following plans are complete at the local implementation level and are no longer active work. Their remaining live/deploy checks are tracked under the active release plan and the production verification list below.

### Multi-Runner Automation and Recipe Builder

- Design: [Multi-Runner Automation and Recipe Builder design](../specs/2026-08-30-multi-runner-recipe-builder-design.md)

### Recipe Mutation Production Safety Fixes

### Playwright Interactive Tutorial

Status: Fully implemented and verified locally via Vitest (component & hook tests) and Playwright E2E (browser & accessibility tests).

Completed in this delivery:

- Typed 9-step tutorial catalog in `src/components/playwright-runner/tutorial/tutorial-steps.ts`;
- Catalog error gating in `usePlaywrightRunner.ts` (`catalogError: boolean`) preventing auto-open on failed catalog requests;
- First-visit auto-open and `localStorage` persistence hook `usePlaywrightTutorial.ts`;
- Accessible spotlight modal `PlaywrightTutorial.tsx` with progress bar, step navigation, Arrow key controls (`ArrowRight`/`ArrowDown`/`ArrowLeft`/`ArrowUp`), focus trapping, focus restoration, `prefers-reduced-motion` scroll adaptation, Escape dismissal, and background `#playwright-workspace-root` `inert` management;
- Tutorial header trigger button and 9 stable `data-tutorial-id` wrappers integrated into `PlaywrightWorkspace.tsx`;
- Unavailable state detection (`data-tutorial-state="unavailable"` and 0-dimension detection) displaying friendly fallback explanations;
- Unit and component test suites passing in Vitest (79 test files, 321 tests passed);
- Deterministic browser E2E test passing in Playwright (`e2e/monitor.spec.ts`);
- Non-caching boundary verified in Service Worker (`public/sw.js`).

### Completed local implementation: ProjectSTS UAT Test Discovery

Status: implemented locally and verified with Agent build, typecheck, lint, full Vitest, real local catalog scan, and one real ProjectSTS Playwright smoke job with realtime terminal delivery. Remaining acceptance work is consolidated in Task 5 of the active release plan.

Completed in this delivery:

- ProjectSTS-owned `test-automation-map.json` with 11 FN-STS categories and explicit mappings for the existing Playwright files;
- Agent manifest validation with relative-path and generated-output containment;
- Multi-runner file discovery for Playwright, generated Playwright, Frontend Node, Backend Jest, and Backend Jest E2E;
- Deterministic path/title/source-ID/keyword matching with confidence metadata;
- Recipe-backed generated Playwright writer with atomic writes and manual-file overwrite protection;
- Catalog `coverageGroups` metadata without absolute ProjectSTS paths;
- Test Explorer runner badges, UAT groups, disabled non-Playwright coverage rows, search, and coverage-gap display;
- Playwright execution cwd resolution from `frontend/playwright.config.ts` when the secure scan root is `E:\ProjectSTS`.

Design: [Playwright Interactive Tutorial design](../specs/2026-08-30-playwright-interactive-tutorial-design.md)

## Historical implementation references

The following feature plans retain implementation context. Their remaining live checks are consolidated in Tasks 2–4 of the active Production Release Closeout plan.

- [Initial Project Monitor](2026-07-25-project-monitor-implementation.md): provider dashboard and authentication architecture are present; retain production provider smoke checks.
- [Aiven status alerts](2026-07-28-aiven-status-alerts.md): implementation exists; verify live power-off and log-error behavior against Aiven.
- [Historical deployment logs](2026-07-28-historical-deployment-logs.md): history loading exists; verify latest Vercel and Render events after opening a new session.
- [Local Test Runner Agent](2026-07-28-local-test-runner-agent.md): legacy preset agent is implemented and builds; keep it during Playwright migration.
- [Cache and loading readiness](2026-07-28-production-cache-loading-readiness.md): loading controls are implemented; repeat multi-user and slow-provider checks after Playwright UI changes.
- [Multi-user test selector](2026-07-28-production-multi-user-test-selector.md): core lease, selector, bounded polling, and shared job behavior are implemented; production concurrency and lease-recovery checks remain.
- [Test Runner navigation](2026-07-28-production-test-runner-navigation.md): Logs and Tests routes and production runner workspace exist; the Playwright workspace now extends this work.
- [ProjectSTS and Aiven database target](2026-07-28-projectsts-aiven-defaultdb-test-runner.md): configured behavior exists; verify production displays `student_tracking` and STS target values.
- [Desktop PWA](2026-07-28-pwa-desktop-installation.md): manifest and install route are present; repeat installed-app icon and update-cache checks after deployment.
- [Render timeout handling](2026-07-28-render-provider-timeout.md): timeout handling exists; verify against a real slow Render response.
- [Vercel and Render diagnostics](2026-07-28-vercel-render-deployment-diagnostics.md): provider diagnostics are implemented; production project/token mapping remains an environment check.
- [Cybersecurity login](2026-07-29-cybersecurity-login.md): session login exists; repeat browser session-close behavior after deployment.
- [Redis usage status](2026-07-29-redis-usage-status.md): status endpoint/UI exists; verify with production Upstash credentials.

## Supersession rules

- Do not remove the legacy `/api/test-runner` routes or preset agent until the Playwright production smoke test passes.
- New Playwright work belongs under `/api/playwright-runner` and `monitor:playwright:v1:*` during migration.
- The deploy-readiness plan overrides conflicting migration details in the older Playwright workspace plan, especially proposals to mix legacy and Playwright payloads in one endpoint.
- Git review, commits, pushes, and deployment remain user-managed.
