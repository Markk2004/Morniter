# Playwright Production Acceptance Fixes Implementation Plan

> **For agentic workers:** Execute this plan task-by-task and keep every checkbox current. Do not perform Git operations; the repository owner handles them manually.

**Goal:** Close the remaining verification gaps around realtime terminal output, deterministic Tutorial E2E coverage, and installed Desktop PWA behavior so the Playwright workspace can be marked production-ready using reproducible evidence.

**Architecture:** Keep Tutorial behavior local to the browser and keep the Local Agent as the only process that executes ProjectSTS tests. Reuse the realtime-delivery work already specified in the production hardening plan, then run browser tests against an isolated Next.js server whose authentication hash is derived from a test-only environment password. Treat installed-PWA checks as a separate release gate because Vitest and ordinary browser E2E cannot prove standalone installation behavior.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, Playwright, bcryptjs, Upstash Redis, Chrome/Edge Desktop PWA

## Global Constraints

- Do not send absolute workspace or test paths to the frontend.
- Do not weaken project allowlists, path containment, authentication, execution locks, or Local Agent ownership rules.
- Do not store production passwords, password hashes, Redis credentials, or Agent tokens in source control.
- Tutorial navigation must not create, cancel, or mutate Playwright jobs.
- Do not add a new polling loop for Tutorial or PWA verification.
- Realtime logs must be acknowledged before removal from the Local Agent queue.
- A release claim requires recorded command output and a manual installed-PWA result.
- Do not run `git add`, `git commit`, `git pull`, or `git push`; the repository owner performs Git operations manually.

---

## Current Baseline

The following review findings are already implemented and must not be rewritten:

- `usePlaywrightRunner` exposes `catalogError` and `PlaywrightWorkspace` passes it to `usePlaywrightTutorial`.
- Tutorial Arrow-key navigation, focus trapping, focus restoration, Escape dismissal, background `inert`, and `prefers-reduced-motion` handling exist.
- Corresponding Vitest component coverage exists.
- `STATUS.md` already distinguishes local Vitest completion from pending Playwright E2E and installed-PWA verification.

Remaining gates:

1. Complete Task 0 of `2026-08-30-playwright-production-release-hardening.md` and prove realtime output with a real ProjectSTS job.
2. Make authenticated Tutorial E2E deterministic and independent of a developer's production secrets.
3. Run the complete automated verification suite without a dev-server port collision or silently skipped authenticated test.
4. Verify installation, icon, storage, session, and cache behavior in an installed Chrome/Edge Desktop PWA.
5. Update status only from captured evidence.

---

### Task 1: Complete the Mandatory Realtime Terminal Gate

**Files:**
- Follow and update: `docs/superpowers/plans/2026-08-30-playwright-production-release-hardening.md:25`
- Modify only as required by that plan: `agent/src/log-batcher.ts`
- Modify only as required by that plan: `agent/src/client.ts`
- Modify only as required by that plan: `agent/src/runner.ts`
- Modify only as required by that plan: `agent/src/single-instance.ts`
- Modify only as required by that plan: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Test: `tests/unit/test-agent/single-instance.test.ts`
- Test: `tests/unit/test-agent/log-batcher.test.ts`
- Test: `tests/unit/test-agent/playwright-runner.test.ts`
- Test: `tests/integration/playwright-runner-agent-routes.test.ts`
- Test: `tests/integration/playwright-runner-e2e-flow.test.ts`

**Interfaces:**
- Consumes: the existing Agent poll/report protocol and job log sequence cursor.
- Produces: acknowledged log batches that remain retryable until accepted, drain before terminal job completion, appear in sequence through `/api/playwright-runner/jobs/[id]`, and single-instance protection per `agentId`.

- [x] **Step 1: Mark Task 0 in the existing release-hardening plan as the active prerequisite**

Do not duplicate its implementation into this document. Work through every unchecked Task 0 step in `2026-08-30-playwright-production-release-hardening.md` before continuing to Task 2 here.

- [x] **Step 2: Run the focused automated gate**

Run:

```powershell
npx vitest run `
  tests/unit/test-agent/single-instance.test.ts `
  tests/unit/test-agent/log-batcher.test.ts `
  tests/unit/test-agent/playwright-runner.test.ts `
  tests/integration/playwright-runner-agent-routes.test.ts `
  tests/integration/playwright-runner-e2e-flow.test.ts
npm run test-agent:build
npm run typecheck
```

Expected: every command exits with code `0`; no test accepts removal of an unacknowledged batch, duplicated sequence values, or completion before the final log drain.

- [ ] **Step 3: Prove realtime delivery with one safe ProjectSTS test**

Start exactly one Local Agent using the `sts-playwright` catalog. From `/monitor/tests`, select one short ProjectSTS smoke test and run Chromium headless. Record evidence that:

```text
queued -> running -> terminal lines increase while running -> passed/failed
logCount > 0
sequences are strictly increasing
no duplicate terminal line appears after refresh
```

Expected: Terminal updates before the job reaches its final status. If output appears only after completion, Task 1 remains incomplete.

- [x] **Step 4: Prove Agent ID collision rejection and reconnect safety**

Verify that two Agent processes cannot run concurrently with the same `agentId`:
1. Start the first Agent instance with `agentId="windows-local-agent-1"`.
2. Attempt to start a second Agent instance on the same machine with the identical `agentId="windows-local-agent-1"`.
3. Confirm that the second Agent process exits immediately with an explicit single-instance error message.
4. Confirm that the first Agent remains the active owner, continues polling, and no job is claimed twice.
5. Interrupt the first Agent after an output batch, restart it once, and verify that unacknowledged lines retry cleanly without duplication and the job reaches a terminal state.

Expected: no lost lines, exactly one active process owning the `agentId`, and no double-claimed jobs.

---

### Task 2: Make Authenticated Tutorial E2E Deterministic

**Files:**
- Modify: `playwright.config.ts`
- Modify: `e2e/monitor.spec.ts`
- Test: `e2e/monitor.spec.ts`

**Interfaces:**
- Consumes: `E2E_GROUP_PASSWORD`, `SESSION_SIGNING_SECRET`, `/api/auth/login`, `/api/playwright-runner/catalog`, `/api/playwright-runner/jobs`, and `/api/test-runner/lock`.
- Produces: an authenticated Tutorial browser test that cannot silently pass by skipping during release checks, does not fail the standard public E2E run, and does not require production credentials or a live Local Agent catalog.

- [x] **Step 1: Make Playwright config derive a test-only bcrypt hash at runtime**

At the top of `playwright.config.ts`, import bcrypt and validate the dedicated E2E password when `PLAYWRIGHT_AUTH_E2E=1`:

```ts
import bcrypt from "bcryptjs";
import { defineConfig, devices } from "@playwright/test";

const e2ePassword = process.env.E2E_GROUP_PASSWORD;
const runAuthenticatedE2E = process.env.PLAYWRIGHT_AUTH_E2E === "1";

if (runAuthenticatedE2E && !e2ePassword) {
  throw new Error("E2E_GROUP_PASSWORD is required when PLAYWRIGHT_AUTH_E2E=1");
}

const e2ePasswordHash = bcrypt.hashSync(
  e2ePassword ?? "disabled-authenticated-e2e-password",
  4,
);

const E2E_SESSION_SECRET =
  "e2e-only-session-signing-secret-with-at-least-48-characters";
```

Configure `webServer.env` with:

```ts
env: {
  SESSION_SIGNING_SECRET:
    process.env.SESSION_SIGNING_SECRET ?? E2E_SESSION_SECRET,
  GROUP_ACCESS_PASSWORD_HASH: e2ePasswordHash,
},
```

Keep `reuseExistingServer: false` by default so E2E never attaches to a developer server with different environment values. Allow opt-in reuse only if it is explicit:

```ts
reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
```

- [x] **Step 2: Design explicit Public vs Authenticated test blocks**

In `e2e/monitor.spec.ts`, separate unauthenticated visitor tests from the authenticated tutorial test using distinct `test.describe` blocks:

```ts
import { test, expect } from "@playwright/test";

test.describe("Public E2E Flow", () => {
  test("redirects unauthenticated visitor from /monitor to /login", async ({ page }) => {
    await page.goto("/monitor");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/group password/i)).toBeVisible();
  });

  test("shows generic error on wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/group password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /access workspace/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authenticated Tutorial E2E Flow", () => {
  const authE2EEnabled = process.env.PLAYWRIGHT_AUTH_E2E === "1";
  test.skip(!authE2EEnabled, "Run with PLAYWRIGHT_AUTH_E2E=1 for authenticated Tutorial E2E");

  test("opens Tutorial once, exercises keyboard/focus, persists in storage, and never mutates runner state", async ({ page }) => {
    const password = process.env.E2E_GROUP_PASSWORD;
    expect(password, "E2E_GROUP_PASSWORD must be set when PLAYWRIGHT_AUTH_E2E=1").toBeTruthy();

    const mutationRequests: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      const isForbiddenMutation =
        request.method() === "POST" &&
        (path === "/api/playwright-runner/jobs" ||
          /^\/api\/playwright-runner\/jobs\/[^/]+\/cancel$/.test(path) ||
          path === "/api/test-runner/lock");
      if (isForbiddenMutation) mutationRequests.push(path);
    });

    // Mock only read-only catalog/job endpoints for deterministic E2E
    await page.route("**/api/playwright-runner/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presence: {
            state: "online",
            agentId: "e2e-agent",
            lastHeartbeatAt: new Date().toISOString(),
          },
          catalog: {
            version: "2.0.0",
            updatedAt: new Date().toISOString(),
            projects: [
              {
                id: "sts-playwright",
                name: "STS Playwright Automation",
                scanPathLabel: "frontend/e2e",
                testGroups: [
                  {
                    name: "Authentication",
                    tests: [
                      {
                        id: "test-auth-login",
                        title: "Login Flow",
                        group: "Authentication",
                        relativePath: "e2e/auth/login.spec.ts",
                      },
                    ],
                  },
                ],
                capabilities: {
                  browsers: { chromium: true, firefox: false, webkit: false },
                  headed: false,
                  workspaceExecution: true,
                },
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/playwright-runner/jobs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: '{"jobs":[]}' });
        return;
      }
      await route.continue();
    });

    // Real login flow
    await page.goto("/login");
    await page.getByLabel(/group password/i).fill(password!);
    await page.getByRole("button", { name: /access workspace/i }).click();
    await expect(page).toHaveURL(/\/monitor(?:\/|$)/, { timeout: 15000 });

    await page.goto("/monitor/tests");
    await expect(page).toHaveURL(/\/monitor\/tests/, { timeout: 15000 });

    // Clear tutorial state to ensure first-visit auto-open triggers
    await page.evaluate((key) => localStorage.removeItem(key), "morniter:playwright-tutorial:v1:seen");
    await page.reload();

    const dialog = page.getByRole("dialog", { name: /Playwright Automation Tutorial/i });
    await expect(dialog).toBeVisible();

    // Focus containment & keyboard navigation
    await expect
      .poll(() =>
        page.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          return Boolean(dlg?.contains(document.activeElement));
        }),
      )
      .toBe(true);

    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText("ขั้นตอน 2 จาก 9")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByText("ขั้นตอน 1 จาก 9")).toBeVisible();

    // Step forward to end
    for (let step = 1; step < 9; step += 1) {
      await dialog.getByRole("button", { name: /Next Step/i }).click();
    }
    await dialog.getByRole("button", { name: /Finish/i }).click();
    await expect(dialog).toBeHidden();

    // Assert persistence
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("morniter:playwright-tutorial:v1:seen")))
      .toBe("true");

    // Reload and assert remains hidden
    await page.reload();
    await expect(dialog).toBeHidden();

    // Manual reopen and Escape focus restoration
    const tutorialButton = page.getByRole("button", { name: /เปิด Tutorial/i });
    await tutorialButton.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(tutorialButton).toBeFocused();

    expect(mutationRequests, "Tutorial must remain read-only").toEqual([]);
  });
});
```

Behavior:
1. Standard unauthenticated run (`npm run test:e2e`): runs public tests and cleanly skips the authenticated block without failing.
2. Authenticated release gate (`PLAYWRIGHT_AUTH_E2E=1` with `E2E_GROUP_PASSWORD`): runs all tests with 0 skipped and 0 failed.
3. If `PLAYWRIGHT_AUTH_E2E=1` is provided without `E2E_GROUP_PASSWORD`, `playwright.config.ts` fails before test execution, preventing silent skips.

- [x] **Step 3: Stub only runner-read APIs, not authentication**

Before navigating to `/login`, add deterministic read-only routes using the complete typed `AgentPresence` contract:

```ts
await page.route("**/api/playwright-runner/catalog", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      presence: {
        state: "online",
        agentId: "e2e-agent",
        lastHeartbeatAt: new Date().toISOString(),
      },
      catalog: {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        projects: [
          {
            id: "sts-playwright",
            name: "STS Playwright Automation",
            scanPathLabel: "frontend/e2e",
            testGroups: [
              {
                name: "Authentication",
                tests: [
                  {
                    id: "test-auth-login",
                    title: "Login Flow",
                    group: "Authentication",
                    relativePath: "e2e/auth/login.spec.ts",
                  },
                ],
              },
            ],
            capabilities: {
              browsers: { chromium: true, firefox: false, webkit: false },
              headed: false,
              workspaceExecution: true,
            },
          },
        ],
      },
    }),
  });
});

await page.route("**/api/playwright-runner/jobs", async (route) => {
  if (route.request().method() === "GET") {
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"jobs":[]}' });
    return;
  }
  await route.continue();
});
```

Do not stub `/api/auth/login`; the test must prove the real cookie/session flow.

- [x] **Step 4: Wait for authentication before opening Test Workspace**

Keep the existing URL assertion immediately after clicking `Access workspace`:

```ts
await page.getByRole("button", { name: /access workspace/i }).click();
await expect(page).toHaveURL(/\/monitor(?:\/|$)/, { timeout: 15000 });
await page.goto("/monitor/tests");
await expect(page).toHaveURL(/\/monitor\/tests/, { timeout: 15000 });
```

Then clear only `morniter:playwright-tutorial:v1:seen`, reload, and wait for both the catalog response and Tutorial dialog. Do not clear cookies or execution-lock state inside this test.

- [x] **Step 5: Run authenticated E2E using direct PowerShell command**

On Windows, run the authenticated test directly with PowerShell environment variables without adding extra unneeded npm dependencies:

```powershell
$env:PLAYWRIGHT_AUTH_E2E='1'
$env:E2E_GROUP_PASSWORD='<set interactively; do not commit>'
npx playwright test e2e/monitor.spec.ts --project=chromium
```

Expected: three tests run, zero skipped, zero failed.

---

### Task 3: Extend Browser Acceptance Assertions

**Files:**
- Modify: `e2e/monitor.spec.ts`
- Test: `e2e/monitor.spec.ts`

**Interfaces:**
- Consumes: the deterministic authenticated setup from Task 2.
- Produces: browser-level evidence for one-time display, keyboard navigation, focus containment, reduced state mutation, and persistence.

- [x] **Step 1: Assert keyboard navigation and focus containment**

After the dialog opens, assert the active element is inside the dialog, then exercise keyboard navigation:

```ts
await expect
  .poll(() => page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog?.contains(document.activeElement));
  }))
  .toBe(true);

await page.keyboard.press("ArrowRight");
await expect(dialog.getByText("ขั้นตอน 2 จาก 9")).toBeVisible();
await page.keyboard.press("ArrowLeft");
await expect(dialog.getByText("ขั้นตอน 1 จาก 9")).toBeVisible();
```

- [x] **Step 2: Assert storage persistence and focus restoration**

After finishing, verify:

```ts
await expect.poll(() => page.evaluate(() =>
  localStorage.getItem("morniter:playwright-tutorial:v1:seen"),
)).toBe("true");

await page.reload();
await expect(dialog).toBeHidden();
const tutorialButton = page.getByRole("button", { name: /เปิด Tutorial/i });
await tutorialButton.click();
await page.keyboard.press("Escape");
await expect(tutorialButton).toBeFocused();
```

- [x] **Step 3: Assert no mutation request occurred**

Retain the existing request listener and expand the forbidden set only to actual mutation endpoints. At the end assert:

```ts
expect(mutationRequests, "Tutorial must remain read-only").toEqual([]);
```

Do not classify catalog, job history, or job-detail GET requests as mutations.

- [x] **Step 4: Run the focused browser test twice**

Run the authenticated E2E command twice without changing source files.

Expected: both runs pass with zero retries and zero skipped tests. A pass that requires retry is treated as flaky and does not close this task.

---

### Task 4: Run the Complete Automated Release Gate

**Files:**
- Read: `package.json`
- Read: `playwright.config.ts`
- Record results in: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: reproducible automated evidence tied to the current working tree.

- [x] **Step 1: Confirm the E2E port is free**

Run:

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue
```

Expected: no listener. If a process is present, identify it before stopping it; do not terminate an unknown process.

- [x] **Step 2: Run static and unit verification**

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run test-agent:build
```

Expected: all commands exit `0`. Record the actual Vitest file/test counts instead of copying an older count.

- [x] **Step 3: Run Playwright E2E without skips**

Run the Task 2 authenticated command with a test-only password supplied in the shell.

Expected:

```text
3 passed
0 failed
0 skipped
```

If the server cannot start, capture the exact port/process error and leave this task unchecked.

- [x] **Step 4: Inspect Playwright artifacts on failure**

For any failed test, inspect `playwright-report/`, trace, screenshot, and video when present. Fix the first causal failure and rerun the focused spec before rerunning the full suite.

---

### Task 5: Verify Installed Desktop PWA Behavior

**Files:**
- Read: `src/app/manifest.ts`
- Read: `src/components/PwaRegistration.tsx`
- Read: `public/sw.js`
- Read: `src/lib/auth/session.ts`
- Update: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Consumes: the deployed HTTPS production URL and current PWA manifest/service worker.
- Produces: a manual acceptance record for installability, icon, standalone layout, cache boundary, and login lifecycle.

- [ ] **Step 1: Verify browser installability**

In current Chrome or Edge, open the deployed HTTPS URL, open Application tools, and confirm:

```text
Manifest loads without error
display = standalone
start_url resolves
192x192 and 512x512 icons load
service worker is activated and controlling the page
```

Expected: the browser offers Install and the installed app uses the configured cat logo rather than the fallback `M` icon.

- [ ] **Step 2: Verify standalone Tutorial lifecycle**

Install and open the PWA. Clear the Tutorial key once, log in, and open `/monitor/tests`.

Expected:

```text
Tutorial opens after successful catalog load
dialog fits at 640px and 1440px desktop widths
finishing stores morniter:playwright-tutorial:v1:seen=true
closing and reopening the PWA does not reopen Tutorial
manual Tutorial button opens it again
```

- [ ] **Step 3: Verify authentication lifecycle**

Close every PWA window and reopen it.

Expected: behavior matches the product requirement that closing the tab/program requires a new login. If the previous session survives, record it as an authentication blocker rather than changing service-worker caching.

- [ ] **Step 4: Verify cache boundaries and update behavior**

In Application tools, confirm `/api/*`, `/login`, and `/monitor/*` responses are not served from the service-worker cache. Deploy a harmless visible version change and confirm the installed PWA receives it after reload/relaunch without clearing all browser data.

Expected: static icons may be cached; authenticated HTML and API data remain network-driven; the new deployment replaces stale UI.

---

### Task 6: Reconcile Plans and Release Status

**Files:**
- Modify: `docs/superpowers/plans/STATUS.md`
- Reconcile completed Tutorial evidence in `docs/superpowers/plans/STATUS.md`; the completed implementation plan has been removed from active documentation.
- Modify checkboxes only: `docs/superpowers/plans/2026-08-30-playwright-production-release-hardening.md`
- Modify checkboxes only: `docs/superpowers/plans/2026-08-30-playwright-production-acceptance-fixes.md`

**Interfaces:**
- Consumes: recorded evidence from Tasks 1–5.
- Produces: one truthful team-facing source of remaining work.

- [x] **Step 1: Update checkboxes from evidence only**

Mark a checkbox complete only when its exact command or manual verification has passed. Do not infer Playwright E2E success from Vitest success, and do not infer installed-PWA success from manifest unit tests.

- [x] **Step 2: Replace stale test counts**

In `STATUS.md`, record the actual output from the latest complete run in this form:

```text
Vitest: <files passed>, <tests passed>
Playwright: <passed>, <failed>, <skipped>
Agent build: passed/failed
Installed Desktop PWA: passed/blocked, browser and version
Realtime ProjectSTS smoke: passed/blocked, final status and logCount
```

- [x] **Step 3: Apply the final release decision**

Use exactly one status:

```text
Production-ready
```

only when Tasks 1–5 all pass. Otherwise use:

```text
Implemented locally; production acceptance blocked by: <specific unchecked gates>
```

Never include passwords, hashes, tokens, absolute ProjectSTS paths, or Redis credentials in the status document.

---

## Final Acceptance Checklist

- [ ] Realtime ProjectSTS output appears while the job is running and completes with `logCount > 0`.
- [ ] Unacknowledged Agent batches retry without log loss or duplication.
- [x] Exactly one Local Agent owns each `agentId`; attempting to start a duplicate Agent process with the same ID fails immediately and prevents double claiming.
- [x] Typecheck, lint, Vitest, Agent build, and Playwright E2E all pass.
- [x] Authenticated Tutorial E2E reports zero skipped tests when `PLAYWRIGHT_AUTH_E2E=1` and passes twice without retries.
- [x] Standard unauthenticated E2E run (`npm run test:e2e`) passes and cleanly skips the authenticated suite without errors.
- [x] Tutorial creates no runner mutation requests.
- [ ] Installed Chrome/Edge PWA shows the correct icon and standalone layout.
- [ ] Installed PWA honors Tutorial persistence, login lifecycle, and service-worker cache boundaries.
- [x] `STATUS.md` contains current evidence and lists every remaining blocker.

## Self-Review Result

- Spec coverage: all outstanding findings from the 2026-08-30 review map to Tasks 1–6.
- Duplicate-work check: Catalog gating, Arrow keys, focus management, and reduced-motion implementation are explicitly treated as completed baseline work.
- Security check: E2E authentication derives a test hash at runtime; no production secret or raw credential is committed.
- Test integrity check: authenticated E2E cannot be reported as complete when skipped, unauthenticated runs skip gracefully without failing, and installed-PWA verification remains a separate manual gate.
- Single-instance integrity: Agent ID collisions are explicitly guarded against and tested.
- Placeholder scan: no implementation step is left as `TBD`, generic error handling, or an undefined follow-up.
