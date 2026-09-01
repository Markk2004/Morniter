# Production Release Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Git operations remain manual and must not be run automatically.

**Goal:** Close the remaining production verification work for Morniter and release the verified Playwright runner so the deployed app can monitor ProjectSTS and execute read-only tests with realtime terminal logs.

**Architecture:** Keep the existing `/api/playwright-runner` contract, Upstash queue, Local Agent, and ProjectSTS allowlist. This closeout validates the existing implementation across the correct Vercel deployment, installed desktop PWA, provider integrations, and the real ProjectSTS workspace. No new test-generation behavior is added without an explicit recipe and real source evidence.

**Tech Stack:** Next.js, TypeScript, Vitest, Playwright, Windows Local Agent, Upstash Redis, Vercel, Render, Aiven, Desktop PWA.

## Global Constraints

- Do not modify the monitored ProjectSTS application source or its data; run only the existing read-only Playwright smoke tests.
- Keep the security contract: project allowlist, path containment, relative paths in browser payloads, secret redaction, and no raw client shell commands.
- Use one Local Agent instance per `agentId`; do not run duplicate `windows-local-agent-1` processes.
- The current verified ProjectSTS paths are `workspaceRoot: E:\\ProjectSTS`, `testRoot: frontend/e2e`, and `config: frontend/playwright.config.ts`.
- Git add, commit, push, and deployment approval are manual operator actions.

---

### Task 1: Deploy the verified revision to the correct Vercel project

**Files:**
- Verify: `package.json`
- Verify: `next.config.ts`
- Verify: `public/manifest.webmanifest`
- Verify: `public/sw.js`
- Update: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Produces: a Vercel deployment where `/login`, `/manifest.webmanifest`, `/sw.js`, and `/api/playwright-runner/catalog` resolve from the same verified revision.

- [x] **Step 1: Confirm the local release gates before deployment**

  Verified on 2026-09-01: `npm run typecheck`, `npm run lint`, `npm test` (429 passed), `npm run agent:build`, and `npm run build` passed. `npx playwright test` passed with 16 passed and 1 expected skipped test.

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run agent:build
npm run build
npx playwright test
```

Expected: typecheck, lint, build, and Agent build exit 0; Vitest has 429 passing tests; Playwright has 16 passing and 1 skipped with 0 failures.

- [ ] **Step 2: Push the verified revision and deploy it to the Vercel project `jk-godz/morniter`**

The operator performs Git and Vercel actions manually. Confirm the deployment uses the Morniter project, not the monitored STS project, and that the production environment contains the existing Morniter variables without printing their values. The current production domain shown in Vercel is `https://monitorsoftdeath.vercel.app`; `morniter.vercel.app` is not assigned to this project.

- [x] **Step 3: Verify the public deployment endpoints**

  Verified on 2026-09-01 against `https://monitorsoftdeath.vercel.app`: `/login`, `/manifest.webmanifest`, and `/sw.js` returned HTTP 200; the catalog route returned HTTP 401 without a session as expected. The manifest parsed with `display: standalone`, `start_url: /monitor`, and two icons.

Run:

```powershell
Invoke-WebRequest -UseBasicParsing https://monitorsoftdeath.vercel.app/login
Invoke-WebRequest -UseBasicParsing https://monitorsoftdeath.vercel.app/manifest.webmanifest
Invoke-WebRequest -UseBasicParsing https://monitorsoftdeath.vercel.app/sw.js
```

Expected: all three return HTTP 200. The current production domain passes this public endpoint check; the alias `morniter.vercel.app` remains a separate domain-mapping issue.

### Task 2: Run the production smoke test with ProjectSTS

**Files:**
- Run: `scripts/smoke-test-live-agent.mjs`
- Verify: `test-runner.config.local.json`
- Verify: `agent/src/playwright-executor.ts`

**Interfaces:**
- Consumes: `sts-playwright` catalog, one existing ProjectSTS Playwright test, and the `windows-local-agent-1` queue worker.
- Produces: a passed job with terminal lines delivered while status is `running` and a final `logCount` greater than zero.

- [x] **Step 1: Start exactly one Agent with the current configuration**

  Verified on 2026-09-01 with one `windows-local-agent-1` process polling the local server. The configured Agent was online during the smoke run.

Run in a dedicated PowerShell window:

```powershell
$env:TEST_RUNNER_CONFIG = 'E:\\project-monitor\\test-runner.config.local.json'
npm run test-agent
```

Expected: one `windows-local-agent-1` process reports `started polling`; a second process must refuse to start.

- [x] **Step 2: Run the read-only smoke test**

  Verified on 2026-09-01 with `node scripts/smoke-test-live-agent.mjs`: ProjectSTS catalog reported 3 Playwright tests, the job reached `passed`, two terminal lines were delivered while running, and persisted `logCount` was 2.

Run:

```powershell
node scripts/smoke-test-live-agent.mjs
```

Expected output includes:

```text
Catalog Presence: ... state: 'online'
Discovered 3 tests in sts-playwright
[TERMINAL ...] Running 1 test using 1 worker
[TERMINAL ...] 1 passed (...)
[Smoke Test PASS] Real ProjectSTS Job Completed!
Final Status: passed
Persisted Redis logCount: 2
```

- [ ] **Step 3: Confirm the Test Explorer contract from the deployed UI**

Using an authenticated session, select `ProjectSTS` and verify that Explorer loads the Agent catalog, groups tests from `frontend/e2e` into Authentication, Monitor, and Students, allows one checkbox selection, and displays the same terminal lines produced by the smoke job.

### Task 3: Complete installed Desktop PWA acceptance

**Files:**
- Verify: `public/manifest.webmanifest`
- Verify: `public/sw.js`
- Verify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: the deployed HTTPS application.
- Produces: an installed Chrome/Edge desktop app with correct branding and bounded cache behavior.

- [ ] **Step 1: Install the deployed app in Chrome and Edge**

Open `https://monitorsoftdeath.vercel.app/monitor`, use the browser install action, and launch the installed app. Expected: the app opens in standalone mode and shows the cat logo rather than the old `M` icon.

- [x] **Step 2: Verify manifest and service-worker assets**

  Verified on 2026-09-01 against the deployed HTTPS domain. Manifest and service worker returned HTTP 200 and the manifest contained valid standalone PWA metadata and two icons.

Expected: manifest has a valid `name`, `start_url`, `display: standalone`, HTTPS-safe icon URLs, and the service worker loads with HTTP 200.

- [ ] **Step 3: Verify session and cache boundaries**

Close the installed app window, reopen it, and confirm login is required again. Deploy a changed revision, reopen the installed app, and confirm the new asset version is loaded without retaining stale login or runner data.

### Task 4: Verify production provider and session behavior

**Files:**
- Verify: `src/app/api/monitor/snapshot/route.ts`
- Verify: `src/app/api/monitor/diagnostics/route.ts`
- Verify: `src/app/api/monitor/redis-status/route.ts`
- Verify: `src/app/api/auth/login/route.ts`
- Update: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Consumes: production environment variables and provider APIs.
- Produces: evidence that provider status, historical logs, diagnostics, Redis health, login expiry, and multi-user leases work after deployment.

- [ ] **Step 1: Verify Vercel and Render project mapping**

Expected: the UI shows the monitored STS project/deployment, not the Morniter project itself. A failed deployment/event exposes provider status, reason, and relevant log details without exposing tokens.

- [ ] **Step 2: Verify Aiven service and database target**

Expected: the UI reports the configured Aiven service state, shows non-running or powered-off state, and displays `student_tracking` as the database target where applicable. It must not label the target as `defaultdb`.

- [ ] **Step 3: Verify history, cache, and loading behavior**

Open a fresh session after a deployment has occurred while Morniter was closed. Expected: the latest Vercel/Render events are loaded, loading indicators settle once, and no polling loop continues after unmount or logout.

- [ ] **Step 4: Verify login and concurrent execution**

Close the tab/app and reopen it. Expected: login is required again. Use two authenticated sessions to launch the same test; expected: one job runs and the other receives the existing active-job/lease response without duplicate execution.

- [ ] **Step 5: Verify Redis health without exposing credentials**

Expected: Redis status reports healthy/unhealthy state and safe diagnostics only. The response must contain no REST token, session secret, agent token, filesystem path, or raw environment value.

### Task 5: Close ProjectSTS UAT coverage gaps

**Files:**
- Verify: `E:\\ProjectSTS\\test-automation-map.json`
- Verify: `agent/src/playwright-catalog.ts`
- Verify: `agent/src/project-test-discovery.ts`
- Verify: `src/components/playwright-runner/TestExplorer.tsx`

**Interfaces:**
- Consumes: real ProjectSTS test files and explicit UAT mappings.
- Produces: coverage-aware catalog entries that remain truthful about executable versus review-only coverage.

- [x] **Step 1: Re-scan all supported ProjectSTS test roots**

  Verified locally on 2026-09-01. The Agent scanned the configured ProjectSTS roots and published the Playwright catalog for `frontend/e2e`; the real smoke run consumed the resulting catalog without absolute paths.

Expected: Playwright files are discovered from `frontend/e2e`, grouped by folder, and non-Playwright Jest/Node files remain visible only as non-executable coverage evidence.

- [x] **Step 2: Verify all eleven UAT function groups**

  Verified locally on 2026-09-01 through the ProjectSTS automation map and catalog metadata. Function-group matching remains source/map-backed; no guessed test names are exposed.

Expected: the catalog publishes the configured UAT groups and their matching confidence without absolute paths or guessed test names.

- [ ] **Step 3: Add only recipe-backed generated coverage**

Create a generated Playwright spec only when the map has an exact route/assertion recipe and the source project provides the required evidence. Validate the generated file with `npx playwright test <relative-spec> --config frontend/playwright.config.ts --list` before exposing it as executable.

- [ ] **Step 4: Re-run the deployed Explorer acceptance**

Expected: changing ProjectSTS refreshes the catalog, category labels remain stable, source opens from the relative path, and selected executable tests run through the same Agent queue.

### Task 6: Record evidence and retire this plan

**Files:**
- Update: `docs/superpowers/plans/STATUS.md`
- Update: `docs/superpowers/plans/2026-09-01-production-release-closeout.md`

- [x] **Step 1: Record each acceptance result with date and command/evidence**

  Local gates, public endpoint checks, catalog discovery, and real Agent execution evidence are recorded above. Manual installed-PWA and production-authenticated checks remain intentionally unchecked.

Mark a task complete only after its expected result is observed. Keep any failed provider or deployment response next to the affected task rather than marking it passed.

- [ ] **Step 2: Confirm the production exit criteria**

All of the following must be true:

- Vercel `/login`, manifest, service worker, and authenticated runner routes return successfully.
- ProjectSTS Local Agent is online and one real read-only Playwright job passes with realtime terminal lines.
- Desktop PWA install, icon, standalone mode, session reset, and cache update checks pass.
- Provider mapping, historical events, diagnostics, Aiven `student_tracking`, Redis health, login expiry, and concurrent lease behavior pass.
- No secrets, absolute paths, or raw client commands appear in browser responses.

- [ ] **Step 3: Remove this plan only after every exit criterion passes**

The plan is closed only when the verified revision is live and the deployed smoke test passes. Until then, keep this single closeout plan as the source of truth.
