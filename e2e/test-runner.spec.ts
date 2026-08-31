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

test.describe("Test Runner Console E2E", () => {
  test("displays Test Runner workspace and unlocks execution session", async ({ page }) => {
    const token = await makeValidSessionToken();
    const appUrl = "http://localhost:3100";
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        url: appUrl,
      },
    ]);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-test-runner");
      window.localStorage.setItem("morniter:playwright-tutorial:v1:seen", "true");
    });

    // Mock catalog route
    await page.route("**/api/playwright-runner/catalog*", async (route) => {
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
            version: "2.0.0",
            updatedAt: new Date().toISOString(),
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
                        id: "login-test",
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
    });

    // Mock lock route
    let isUnlocked = false;
    await page.route("**/api/test-runner/lock*", async (route) => {
      if (route.request().method() === "POST") {
        isUnlocked = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ unlocked: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unlocked: isUnlocked }),
      });
    });

    // Mock auth route
    await page.route("**/api/test-runner/auth*", async (route) => {
      isUnlocked = true;
      await route.fulfill({
        status: 204,
        headers: {
          "set-cookie": "project_monitor_execute=mock_exec; Path=/; HttpOnly; SameSite=Strict",
        },
      });
    });

    // Mock jobs route
    await page.route("**/api/playwright-runner/jobs*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [] }),
      });
    });

    await page.goto("/monitor/tests");

    // Verify top navigation links
    await expect(page.getByRole("link", { name: "Tests" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Playwright Automation" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Authentication/i })).toBeVisible();

    // Verify unlock execution card
    await expect(page.getByText(/Execution Lock Active/i)).toBeVisible();
    await page.getByPlaceholder(/Group password/i).fill("secret-pass");
    await page.getByRole("button", { name: "Unlock Execution", exact: true }).click();

    // Verify unlock card disappears
    await expect(page.getByText(/Execution Lock Active/i)).not.toBeVisible();

    // Click navigation to Logs and back to Tests
    await page.getByRole("link", { name: "Logs" }).click();
    await expect(page).toHaveURL(/\/monitor$/);

    await page.getByRole("link", { name: "Tests" }).click();
    await expect(page).toHaveURL(/\/monitor\/tests$/);
  });
});
