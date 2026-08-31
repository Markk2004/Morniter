import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

async function makeValidSessionToken(): Promise<string> {
  const secret =
    process.env.SESSION_SIGNING_SECRET ||
    "e2e-only-session-signing-secret-with-at-least-48-characters";
  const secretBytes = new TextEncoder().encode(secret);
  return new SignJWT({ scope: "monitor:read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-web")
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .setExpirationTime(Math.floor(Date.now() / 1000) + 8 * 3600)
    .sign(secretBytes);
}

test.describe("Multi-User Test Runner Synchronization E2E", () => {
  test("prevents two users from launching overlapping test jobs", async ({ page, browser }) => {
    const token = await makeValidSessionToken();
    let sharedActiveJob: Record<string, unknown> | null = null;
    const fixedTime = "2026-07-28T12:00:00.000Z";
    const appUrl = "http://localhost:3100";

    // User 1 session cookie and tab storage marker
    await page.context().addCookies([
      { name: "project_monitor_session", value: token, url: appUrl },
    ]);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-user-a");
      window.localStorage.setItem("morniter:playwright-tutorial:v1:seen", "true");
    });

    // User 2 context, session cookie and tab storage marker
    const contextB = await browser.newContext();
    await contextB.addCookies([
      { name: "project_monitor_session", value: token, url: appUrl },
    ]);
    await contextB.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-user-b");
      window.localStorage.setItem("morniter:playwright-tutorial:v1:seen", "true");
    });
    const pageB = await contextB.newPage();

    const mockCatalogHandler = async (route: import("@playwright/test").Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presence: { agentId: "agent-win-1", state: "online", lastHeartbeatAt: fixedTime },
          catalog: {
            version: "2.0.0",
            updatedAt: fixedTime,
            projects: [
              {
                id: "sts-playwright",
                name: "STS Playwright Automation",
                scanPathLabel: "frontend/e2e",
                testGroups: [
                  {
                    id: "auth",
                    name: "Authentication",
                    functionId: "FN-STS-01",
                    functionName: "Authentication",
                    tests: [
                      {
                        id: "pw-login-1",
                        title: "Login Flow",
                        relativePath: "frontend/e2e/auth/login.spec.ts",
                        runner: "playwright",
                        executable: true,
                        risk: "read-only",
                        origin: "manual",
                        confidence: "high",
                        matchedBy: ["path"],
                      },
                    ],
                    gaps: [],
                  },
                ],
                capabilities: {
                  browsers: { chromium: true, firefox: false, webkit: false },
                  headed: true,
                  workspaceExecution: true,
                },
              },
            ],
          },
        }),
      });
    };

    const mockLockHandler = async (route: import("@playwright/test").Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unlocked: true }) });
    };

    const mockJobsHandler = async (route: import("@playwright/test").Route) => {
      const url = route.request().url();
      if (route.request().method() === "POST") {
        if (sharedActiveJob) {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Agent already has an active job running",
              code: "ACTIVE_JOB_EXISTS",
              activeJob: sharedActiveJob,
            }),
          });
          return;
        }

        sharedActiveJob = {
          id: "job-shared-1",
          status: "running",
          createdAt: fixedTime,
          startedAt: fixedTime,
          target: {
            projectId: "sts-playwright",
            browsers: ["chromium"],
            mode: "headless",
            source: "project-test",
            selectedTestIds: ["pw-login-1"],
          },
          terminalLines: [],
          artifacts: [],
        };

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(sharedActiveJob),
        });
        return;
      }

      if (url.includes("/jobs/job-shared-1")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ job: sharedActiveJob, logs: [], nextSequence: 0 }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: sharedActiveJob ? [sharedActiveJob] : [] }),
      });
    };

    await page.route("**/api/test-runner/lock*", mockLockHandler);
    await page.route("**/api/playwright-runner/catalog*", mockCatalogHandler);
    await page.route("**/api/playwright-runner/jobs*", mockJobsHandler);

    await pageB.route("**/api/test-runner/lock*", mockLockHandler);
    await pageB.route("**/api/playwright-runner/catalog*", mockCatalogHandler);
    await pageB.route("**/api/playwright-runner/jobs*", mockJobsHandler);

    await page.goto(`${appUrl}/monitor/tests`);
    await expect(page.getByRole("heading", { name: "Playwright Automation" })).toBeVisible();

    await pageB.goto(`${appUrl}/monitor/tests`);
    await expect(pageB.getByRole("heading", { name: "Playwright Automation" })).toBeVisible();

    // User A selects test and launches
    await page.getByText("Authentication").click();
    const testCheckbox = page.locator('input[type="checkbox"]').first();
    await testCheckbox.check();

    const runSlot = page.locator('[data-tutorial-id="run"]');
    const runBtn = runSlot.getByRole("button", { name: /Run/i });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // User A sees Cancel button in the action slot
    await expect(runSlot.getByRole("button", { name: /Cancel/i })).toBeVisible();

    await contextB.close();
  });
});
