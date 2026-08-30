# Project plan status

Last reviewed: 2026-08-31

This page is the team-facing source of truth for implementation progress. A plan marked "implemented locally" may still require deployment or production verification. Detailed checklists remain in each linked plan.

Historical task checkboxes inside older plans are not retroactively marked complete unless the corresponding implementation and verification can be confirmed. Use the status sections at the top of the active plans and this page for current progress.

## Current release status

- Deployment blocker from the overwritten legacy schema is fixed in the local workspace.
- `npm run typecheck`: passed on 2026-08-31 (0 errors).
- `npm run lint`: passed on 2026-08-31 (0 errors, 0 warnings).
- `npm test`: passed, 90 files and 380 tests on 2026-08-31.
- `npm run test-agent:build` / `npm run agent:build`: passed on 2026-08-31.
- `npm run build`: passed and generated 26/26 static & dynamic routes on 2026-08-31.
- **Gate A (Native Multi-Runner Automation)**: Implemented locally. Mixed-runner command planning, sequential execution, and single-terminal stream tagging are in place and verified in Vitest. Real ProjectSTS Local Agent smoke test remains required before release.
- **Gate B (Recipe Builder & Safe Mutation)**: Local hardening is implemented and automated checks pass:
  - Explicit `risk` & `recipeId` job metadata on workspace draft runs preventing mutating bypasses (P0).
  - Agent-owned `testTarget` contract with safe catalog exposure (without publishing `baseUrl`).
  - Canonical URL resolution against `testTarget.baseUrl` with strict `productionHostDenylist` enforcement for both draft runs and mutations.
  - Owner-safe mutation leases using unique `leaseToken`, durable sorted set indexing (`monitor:playwright:v1:mutation-claimed:<agentId>`), stale claim reaping, atomic Lua compare-and-delete, and `LEASE_LOST` rejection if active lease expired or disappeared (P1).
  - Durable claimed index failure handling rolling back active lease and restoring queued mutation (P1).
  - Multi-phase filesystem transaction journal (`.morniter-mutation-journal.json`) with `fsync` durable writing, startup crash recovery (`recoverRecipeTransactions`), SHA-256 hash verification before backup removal, and strict corruption error handling (P1, P2 & Standards).
  - Base revision verification via SHA-256 `mapRevision` of `test-automation-map.json`.
- **Production Ready**: Not passed yet. Real ProjectSTS Local Agent smoke test with realtime terminal streaming, installed Chrome/Edge Desktop PWA manual acceptance, and deployed Vercel smoke test remain the required production release gates.

## Active work

### Active UI delivery: Playwright Tutorial Learning Mode

Status: Approved design and implementation plan are complete. Source implementation has not started.

- Plan: [Playwright Tutorial Learning Mode Implementation Plan](2026-08-31-playwright-tutorial-learning-mode.md)
- Design: [Playwright Tutorial Learning Mode Design](../specs/2026-08-31-playwright-tutorial-learning-mode-design.md)

Remaining work:

1. Extend the nine-step tutorial catalog with typed chapter, icon, and visual metadata.
2. Build local SVG icons, code-rendered mini UI diagrams, and chapter navigation without external assets or gradients.
3. Replace the spotlight layout with full-screen Learning mode while preserving storage, keyboard, focus, unavailable-state, and reduced-motion behavior.
4. Verify desktop and 320-pixel layouts, authenticated E2E behavior, and all automated release gates.

### Active release: Playwright Production Release Hardening

Status: Local implementation and automated verification are complete. Production acceptance remains open.

- Plan: [Playwright Production Release Hardening Plan](2026-08-30-playwright-production-release-hardening.md)
- Supporting acceptance plan: [Playwright Production Acceptance Fixes Plan](2026-08-30-playwright-production-acceptance-fixes.md)
- Supporting hardening plan: [Recipe Mutation Production Safety Fixes Plan](2026-08-31-recipe-mutation-production-safety-fixes.md)

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
- Clean automated release gate (typecheck, lint, Vitest 90 files / 380 tests, Agent build, Next.js build, and Playwright E2E).

Remaining for final production sign-off:

1. Start exactly one Local Agent with the updated `sts-playwright` config and run one real ProjectSTS smoke test against a live instance; confirm terminal grows while running and finishes with `logCount > 0`.
2. Manual verification matrix on installed Chrome/Edge Desktop PWA (manifest, standalone display, cat logo icon, session termination on window close, and service-worker cache boundaries).
3. Deploy verified revision to Vercel and complete production smoke test.

## Completed local implementation records

The following plans are complete at the local implementation level and are no longer active work. Their remaining live/deploy checks are tracked under the active release plan and the production verification list below.

### Multi-Runner Automation and Recipe Builder

- Plan: [Multi-Runner Automation and Recipe Builder Plan](2026-08-30-multi-runner-recipe-builder.md)
- Design: [Multi-Runner Automation and Recipe Builder design](../specs/2026-08-30-multi-runner-recipe-builder-design.md)

### Recipe Mutation Production Safety Fixes

- Plan: [Recipe Mutation Production Safety Fixes Plan](2026-08-31-recipe-mutation-production-safety-fixes.md)

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

### ProjectSTS UAT Test Discovery

Status: implemented locally and verified with Agent build, typecheck, lint, full Vitest, and a real local catalog scan. Production Agent and deployed UI verification remain pending.

Completed in this delivery:

- ProjectSTS-owned `test-automation-map.json` with 11 FN-STS categories and explicit mappings for the existing Playwright files;
- Agent manifest validation with relative-path and generated-output containment;
- Multi-runner file discovery for Playwright, generated Playwright, Frontend Node, Backend Jest, and Backend Jest E2E;
- Deterministic path/title/source-ID/keyword matching with confidence metadata;
- Recipe-backed generated Playwright writer with atomic writes and manual-file overwrite protection;
- Catalog `coverageGroups` metadata without absolute ProjectSTS paths;
- Test Explorer runner badges, UAT groups, disabled non-Playwright coverage rows, search, and coverage-gap display;
- Playwright execution cwd resolution from `frontend/playwright.config.ts` when the secure scan root is `E:\ProjectSTS`.

Remaining for complete acceptance:

- Start the updated Local Agent against the real ProjectSTS installation and verify the deployed Morniter UI receives the 11 coverage groups;
- Run one selected existing Playwright file from Explorer and verify realtime Terminal output;
- Add and verify real recipe-backed coverage targets when the project supplies exact route/assertion recipes; the initial manifest intentionally has no guessed generated tests;
- Deploy and repeat the production smoke test.

Design: [Playwright Interactive Tutorial design](../specs/2026-08-30-playwright-interactive-tutorial-design.md)

## Existing features with production verification still required

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
