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

test.describe("Multi-Runner Automation and Recipe Builder E2E", () => {
  test("renders Test Explorer with runner filter chips and Recipe Builder trigger", async ({ page }) => {
    const token = await makeValidSessionToken();
    const appUrl = "http://localhost:3100";
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        url: appUrl,
      },
    ]);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-recipe-builder");
      window.localStorage.setItem("morniter:playwright-tutorial:v1:seen", "true");
    });

    // Mock catalog route with multi-runner coverage groups
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
                testTarget: {
                  id: "projectsts-uat",
                  label: "ProjectSTS UAT",
                  allowMutating: true,
                },
                reusableFlows: [
                  {
                    id: "flow-login",
                    name: "Login as UAT user",
                    description: "Standard login",
                    actions: [],
                  },
                ],
                testGroups: [
                  {
                    id: "grp-auth",
                    name: "Authentication",
                    functionId: "FN-STS-01",
                    functionName: "Authentication",
                    tests: [
                      {
                        id: "test-pw-1",
                        title: "Login spec",
                        relativePath: "frontend/e2e/auth/login.spec.ts",
                        runner: "playwright",
                        executable: true,
                        risk: "read-only",
                        origin: "manual",
                        confidence: "high",
                        matchedBy: ["path"],
                      },
                      {
                        id: "test-jest-1",
                        title: "Auth unit test",
                        relativePath: "backend/src/auth.spec.ts",
                        runner: "jest",
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

    await page.route("**/api/test-runner/lock*", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ unlocked: true }) });
    });

    await page.route("**/api/playwright-runner/jobs*", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ jobs: [] }) });
    });

    await page.goto("/monitor/tests");

    // Filter chips present
    await expect(page.getByRole("button", { name: "All" })).toBeVisible({ timeout: 10000 });

    // Code Workspace has Create Draft trigger
    await expect(page.getByRole("button", { name: /Create Draft/i })).toBeVisible();

    // Click Create Draft -> Recipe Builder panel opens
    await page.getByRole("button", { name: /Create Draft/i }).click();
    await expect(page.getByTestId("recipe-builder-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Recipe Builder/i })).toBeVisible();

    // Close Recipe Builder
    await page.getByRole("button", { name: "✕ Close" }).click();
    await expect(page.getByTestId("recipe-builder-panel")).not.toBeVisible();
  });
});
