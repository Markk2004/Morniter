# Project plan status

Last reviewed: 2026-08-29

This page is the team-facing source of truth for implementation progress. A plan marked "implemented locally" may still require deployment or production verification. Detailed checklists remain in each linked plan.

Historical task checkboxes inside older plans are not retroactively marked complete unless the corresponding implementation and verification can be confirmed. Use the status sections at the top of the active plans and this page for current progress.

## Current release status

- Deployment blocker from the overwritten legacy schema is fixed in the local workspace.
- `npm run typecheck`: passed on 2026-08-29.
- `npm test`: passed, 64 files and 274 tests on 2026-08-29.
- `npm run test-agent:build`: passed on 2026-08-29.
- `npm run build`: passed and generated both legacy and Playwright API routes on 2026-08-29.
- `npm run lint`: failed with 9 errors and 9 warnings. This is the current local release blocker.
- Latest E2E suite and deployed Vercel smoke test have not been verified in this review.

## Active work

### Playwright Automation Workspace

Status: in progress, core implementation exists but is not release-ready.

Completed or present in the workspace:

- separate Playwright request schemas and types;
- Redis job store and bounded store logic;
- browser and agent API routes under `/api/playwright-runner`;
- local-agent catalog and Playwright executor modules;
- Playwright job and browser selectors in the Test UI;
- unit and integration coverage, including the Playwright end-to-end flow at integration level;
- clean TypeScript, agent, test, and Next.js build results.

Remaining:

- fix the 9 lint errors and review all 9 warnings;
- confirm local agent configuration and real STS Playwright execution;
- run browser E2E tests, including failure and recovery paths;
- verify polling/backoff, terminal bounds, cancellation, timeout, and stale-agent recovery in a live environment;
- update production documentation and environment checklist;
- deploy and complete the Vercel production smoke test.

Primary plans:

- [Playwright workspace plan](2026-08-26-playwright-automation-workspace.md)
- [Deploy-readiness plan](2026-08-29-playwright-runner-deploy-readiness.md)

### Immediate release blockers

1. Fix lint errors in `JobHistory.tsx`, `PlaywrightJobSelector.tsx`, the Playwright integration test, and Playwright job-store tests.
2. Re-run lint, typecheck, all tests, agent build, and Next build as one release gate.
3. Run Playwright browser E2E.
4. Test one safe STS job through the deployed Morniter UI with the local agent online.

## Completed locally, production verification still required

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
- [SRS test categories](2026-07-28-srs-test-categories.md): metadata categories are implemented in the legacy preset flow.
- [Vercel and Render diagnostics](2026-07-28-vercel-render-deployment-diagnostics.md): provider diagnostics are implemented; production project/token mapping remains an environment check.
- [Cybersecurity login](2026-07-29-cybersecurity-login.md): session login exists; repeat browser session-close behavior after deployment.
- [Login UI](2026-07-29-login-ui-impeccable.md): redesigned login is implemented; no current release blocker recorded here.
- [Redis usage status](2026-07-29-redis-usage-status.md): status endpoint/UI exists; verify with production Upstash credentials.
- [Test failure summary](2026-07-29-test-failure-summary.md): completed and covered by its plan checklist.

## Completed fix

- [Vercel schema export fix](2026-08-29-fix-vercel-schema-export.md): legacy and Playwright schema modules are separated again; current typecheck, tests, agent build, and Next build pass. Deployment remains gated by the unrelated lint errors listed above.

## Supersession rules

- Do not remove the legacy `/api/test-runner` routes or preset agent until the Playwright production smoke test passes.
- New Playwright work belongs under `/api/playwright-runner` and `monitor:playwright:v1:*` during migration.
- The deploy-readiness plan overrides conflicting migration details in the older Playwright workspace plan, especially proposals to mix legacy and Playwright payloads in one endpoint.
- Git review, commits, pushes, and deployment remain user-managed.
