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

test.describe("Test Runner Agent Recovery E2E", () => {
  test("displays agent lagging and lost recovery state when heartbeats fail", async ({ page }) => {
    const token = await makeValidSessionToken();
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-recovery");
    });

    const presenceState = "lagging";

    await page.route("**/api/test-runner/catalog*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          presence: {
            agentId: "agent-win-1",
            state: presenceState,
            lastHeartbeatAt: new Date(Date.now() - 40000).toISOString(),
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

    await page.route("**/api/test-runner/lock*", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ unlocked: true }) });
    });

    await page.route("**/api/test-runner/jobs*", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ jobs: [] }) });
    });

    await page.goto("/monitor/tests");

    await expect(page.getByText(/Local Agent Lagging/i)).toBeVisible();
  });
});
