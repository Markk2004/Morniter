# Project plan status

Last reviewed: 2026-08-30

This page is the team-facing source of truth for implementation progress. A plan marked "implemented locally" may still require deployment or production verification. Detailed checklists remain in each linked plan.

Historical task checkboxes inside older plans are not retroactively marked complete unless the corresponding implementation and verification can be confirmed. Use the status sections at the top of the active plans and this page for current progress.

## Current release status

- Deployment blocker from the overwritten legacy schema is fixed in the local workspace.
- `npm run typecheck`: passed on 2026-08-30.
- `npm test`: passed, 71 files and 289 tests on 2026-08-30.
- `npm run test-agent:build`: passed on 2026-08-30.
- `npm run build`: passed and generated legacy and Playwright routes on 2026-08-30.
- `npm run lint`: passed on 2026-08-30.
- ProjectSTS discovery: passed, 3 real Playwright tests in 3 folder groups.
- ProjectSTS smoke: passed, 3/3 tests against a temporary local frontend server.
- ProjectSTS smoke with configured `webServer`: passed, 3/3 tests.
- Playwright catalog: Agent published `sts-playwright` with Authentication, Monitor, and Students groups.
- Execution Lock: now uses the same `GROUP_ACCESS_PASSWORD_HASH` as Monitor login.
- Realtime terminal delivery: release blocker; a real failed `sts-playwright` job was observed with `logCount: 0`, so Agent upload reliability must be fixed before further smoke or deployment work.
- Deployed Vercel smoke test and a real job through the online Local Agent have not been verified in this review.

## Active work

### Active delivery: Playwright Production Release Hardening

Status: in progress; realtime terminal log delivery is the mandatory first blocker. Local implementation and the independent ProjectSTS smoke pass, but production job verification must wait for reliable Agent log delivery.

Completed or present in the workspace:

- separate Playwright request schemas and types;
- Redis job store and bounded store logic;
- browser and agent API routes under `/api/playwright-runner`;
- local-agent catalog and Playwright executor modules;
- Playwright job and browser selectors in the Test UI;
- unit and integration coverage, including the Playwright end-to-end flow at integration level;
- clean TypeScript, agent, test, and Next.js build results.

Remaining:

- fix acknowledged Agent log batching, bounded retry, final browser reconciliation, and duplicate-Agent protection before all other tasks;
- run one real ProjectSTS job through the online Local Agent;
- run browser recovery paths, including failure, cancel, timeout, and Agent reconnect;
- verify polling/backoff, terminal bounds, cancellation, timeout, and stale-agent recovery in a live environment;
- update production documentation and environment checklist;
- deploy and complete the Vercel production smoke test.

Primary plan:

- [Production release hardening plan](2026-08-30-playwright-production-release-hardening.md)
- [Previous deploy-readiness plan](2026-08-29-playwright-runner-deploy-readiness.md)

### Immediate release blockers

1. Restore realtime terminal delivery: retain unacknowledged batches, retry safely, drain before completion, reconcile final browser logs, and prevent two local Agents from sharing one `agentId`.
2. Pass the focused log batching, Agent runner, route, and end-to-end tests plus Agent build and typecheck.
3. Start exactly one Local Agent with the updated `sts-playwright` config and confirm its catalog contains the 3 groups.
4. Run one safe ProjectSTS smoke test through Morniter and confirm the terminal updates while running and finishes with `logCount > 0`.
5. Run cancel, timeout, Agent offline, and reconnect checks.
6. Deploy the exact verified source revision and repeat the production smoke test.

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
- [Login UI](2026-07-29-login-ui-impeccable.md): redesigned login is implemented; no current release blocker recorded here.
- [Redis usage status](2026-07-29-redis-usage-status.md): status endpoint/UI exists; verify with production Upstash credentials.

## Completed plans removed from active tracking

The following plan files remain in this folder as history, but are no longer part of active work:

- [SRS test categories](2026-07-28-srs-test-categories.md)
- [Test failure summary](2026-07-29-test-failure-summary.md)
- [Vercel schema export fix](2026-08-29-fix-vercel-schema-export.md)
- [Playwright IDE UI](2026-08-30-playwright-automation-ide-ui.md)

## Completed fix

- [Vercel schema export fix](2026-08-29-fix-vercel-schema-export.md): legacy and Playwright schema modules are separated again; current typecheck, tests, agent build, lint, and Next build pass.

## Supersession rules

- Do not remove the legacy `/api/test-runner` routes or preset agent until the Playwright production smoke test passes.
- New Playwright work belongs under `/api/playwright-runner` and `monitor:playwright:v1:*` during migration.
- The deploy-readiness plan overrides conflicting migration details in the older Playwright workspace plan, especially proposals to mix legacy and Playwright payloads in one endpoint.
- Git review, commits, pushes, and deployment remain user-managed.
