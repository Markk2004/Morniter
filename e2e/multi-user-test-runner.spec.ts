import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

async function makeValidSessionToken(): Promise<string> {
  const secret =
    process.env.SESSION_SIGNING_SECRET ||
    "RoLw5fpZO-N4TBtm-WirNonWWftIrY4fW6pjN8MAF30T1e6bBZWBTh3rP-nvArSY";
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
    });

    // User 2 context, session cookie and tab storage marker
    const contextB = await browser.newContext();
    await contextB.addCookies([
      { name: "project_monitor_session", value: token, url: appUrl },
    ]);
    await contextB.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-user-b");
    });
    const pageB = await contextB.newPage();

    const mockCatalogHandler = async (route: import("@playwright/test").Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presence: { agentId: "agent-win-1", state: "online", lastHeartbeatAt: fixedTime },
          activeJob: sharedActiveJob,
          catalog: {
            version: "1.0.0",
            updatedAt: fixedTime,
            projects: [
              {
                id: "student-tracking",
                name: "Student Tracking System",
                presets: [
                  {
                    id: "cypress-e2e",
                    name: "Cypress E2E Suite",
                    description: "Runs full Cypress tests",
                    commandPreview: "npx cypress run",
                    timeoutSeconds: 300,
                    category: "automated",
                    srsIds: [],
                    risk: "safe",
                    databaseTarget: "none",
                  },
                ],
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
          requesterLabel: "Operator 12345678",
          projectId: "student-tracking",
          presetId: "cypress-e2e",
          presetName: "Cypress E2E Suite",
          status: "running",
          queuedAt: fixedTime,
        };

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(sharedActiveJob),
        });
        return;
      }

      if (url.includes("/jobs/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ job: sharedActiveJob, lines: [], nextSequence: 0 }),
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
    await page.route("**/api/test-runner/catalog*", mockCatalogHandler);
    await page.route("**/api/test-runner/jobs*", mockJobsHandler);

    await pageB.route("**/api/test-runner/lock*", mockLockHandler);
    await pageB.route("**/api/test-runner/catalog*", mockCatalogHandler);
    await pageB.route("**/api/test-runner/jobs*", mockJobsHandler);

    await page.goto(`${appUrl}/monitor/tests`);
    await expect(page.getByText(/Production Test Runner/i)).toBeVisible();
    await expect(page.getByText(/Local Agent Online/i)).toBeVisible();

    await pageB.goto(`${appUrl}/monitor/tests`);
    await expect(pageB.getByText(/Production Test Runner/i)).toBeVisible();
    await expect(pageB.getByText(/Local Agent Online/i)).toBeVisible();

    // User A selects test and launches
    await page.getByLabel("Test command").selectOption("cypress-e2e");
    await page.getByRole("button", { name: "Run selected test" }).click();
    await page.getByRole("button", { name: "Confirm Run" }).click();

    // User A sees running progress with Operator 12345678
    await expect(page.getByText(/Operator 12345678/i)).toBeVisible();

    // User B receives catalog update and sees active job lock
    await expect(pageB.getByText(/Job In Progress/i)).toBeVisible();
    await expect(pageB.getByLabel("Project")).toBeDisabled();
    await expect(pageB.getByLabel("Test command")).toBeDisabled();

    await contextB.close();
  });
});
