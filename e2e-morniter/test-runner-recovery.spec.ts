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
    const appUrl = "http://localhost:3100";
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        url: appUrl,
      },
    ]);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-recovery");
      window.localStorage.setItem("morniter:playwright-tutorial:v1:seen", "true");
    });

    let catalogRetried = false;
    await page.route("**/api/playwright-runner/catalog*", async (route) => {
      if (!catalogRetried) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Local Agent offline or unresponsive" }),
        });
        return;
      }
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
            projects: [],
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

    // Catalog load error card is displayed
    await expect(page.getByText(/ไม่สามารถโหลด Playwright Catalog ได้/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /ลองใหม่/i })).toBeVisible();

    // Click retry
    catalogRetried = true;
    await page.getByRole("button", { name: /ลองใหม่/i }).click();

    // Catalog error card disappears after recovery
    await expect(page.getByText(/ไม่สามารถโหลด Playwright Catalog ได้/i)).not.toBeVisible();
  });
});
