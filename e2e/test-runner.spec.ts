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

test.describe("Test Runner Console E2E", () => {
  test("displays Test Runner workspace and unlocks execution session", async ({ page }) => {
    const token = await makeValidSessionToken();
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);

    // Mock catalog route
    await page.route("**/api/test-runner/catalog*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presence: {
            agentId: "agent-win-1",
            state: "online",
            lastHeartbeatAt: new Date().toISOString(),
          },
          catalog: {
            version: "1.0.0",
            updatedAt: new Date().toISOString(),
            projects: [
              {
                id: "student-tracking",
                name: "Student Tracking System",
                presets: [
                  {
                    id: "cypress-e2e",
                    name: "Cypress E2E Suite",
                    description: "Run Cypress end-to-end suite",
                    commandPreview: "npx cypress run",
                    timeoutSeconds: 300,
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    // Mock lock route
    await page.route("**/api/test-runner/lock*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unlocked: false }),
      });
    });

    // Mock jobs route
    await page.route("**/api/test-runner/jobs*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ jobs: [] }),
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "job-mock-1",
            projectId: "student-tracking",
            presetId: "cypress-e2e",
            presetName: "Cypress E2E Suite",
            status: "running",
            queuedAt: new Date().toISOString(),
          }),
        });
      }
    });

    // Mock auth route
    await page.route("**/api/test-runner/auth*", async (route) => {
      await route.fulfill({
        status: 204,
        headers: {
          "set-cookie": "project_monitor_execute=mock_exec; Path=/; HttpOnly; SameSite=Strict",
        },
      });
    });

    await page.goto("/monitor/tests");

    // Verify top navigation links
    await expect(page.getByRole("link", { name: "Tests" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/Local Agent Online/i)).toBeVisible();
    await expect(page.getByText(/Cypress E2E Suite/i)).toBeVisible();
    await expect(page.getByText(/npx cypress run/i)).toBeVisible();

    // Verify unlock execution card
    await expect(page.getByText(/Execution Lock Active/i)).toBeVisible();
    await page.getByPlaceholder(/Execution password/i).fill("secret-pass");
    await page.getByRole("button", { name: "Unlock Execution", exact: true }).click();

    // Click navigation to Logs and back to Tests
    await page.getByRole("link", { name: "Logs" }).click();
    await expect(page).toHaveURL(/\/monitor$/);

    await page.getByRole("link", { name: "Tests" }).click();
    await expect(page).toHaveURL(/\/monitor\/tests$/);
  });
});
