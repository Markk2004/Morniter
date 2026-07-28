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

test.describe("Historical Deployments & Adaptive Polling E2E", () => {
  test("displays historical deployment events created before opening the page", async ({ page }) => {
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
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-historical");
    });

    // Mock API responses for snapshot and diagnostics
    await page.route("**/api/monitor/snapshot*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          refreshAfterSeconds: 60,
          partial: false,
          providers: [
            {
              source: "vercel",
              fetchedAt: new Date().toISOString(),
              stale: false,
              services: [
                {
                  source: "vercel",
                  service: "frontend-app",
                  status: "healthy",
                  checkedAt: new Date().toISOString(),
                },
              ],
              events: [],
            },
          ],
          events: [
            {
              id: "vercel-dep_hist_1",
              source: "vercel",
              service: "frontend-app",
              type: "deployment",
              severity: "info",
              status: "READY",
              message: "Deployment app-123 (dep_hist_1): state is READY",
              occurredAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(), // 6 hours ago
              stage: "deploy",
              deploymentId: "dep_hist_1",
              resourceId: "prj_hist_1",
              diagnosticAvailable: true,
              commitSha: "f1a2b3c4d5e6",
              commitMessage: "feat: add user profile page",
              branch: "main",
              commitAuthor: "Developer",
            },
          ],
        }),
      });
    });

    await page.route("**/api/monitor/diagnostics*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          eventId: "vercel-dep_hist_1",
          summary: "Vercel deployment status is READY",
          lines: [
            {
              id: "log-1",
              stage: "build",
              level: "info",
              message: "Build completed successfully",
              occurredAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
            },
          ],
          truncated: false,
        }),
      });
    });

    await page.goto("/monitor");

    // Click Refresh to load mocked snapshot immediately
    await page.getByRole("button", { name: "Refresh", exact: true }).click();

    // Verify header live badge is 60s
    await expect(page.getByText(/LIVE \(60s\)/i)).toBeVisible();

    // Verify historical event commit details and status
    await expect(page.getByText(/feat: add user profile page/i)).toBeVisible();
    await expect(page.getByText("[main]")).toBeVisible();

    // Verify View deployment log button works for READY event
    const logButton = page.getByRole("button", { name: /view deployment log/i });
    await expect(logButton).toBeVisible();
    await logButton.click();

    // Verify log lines loaded
    await expect(page.getByText(/Build completed successfully/i)).toBeVisible();
  });

  test("manual refresh sends force=1 query parameter", async ({ page }) => {
    let capturedUrl = "";
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
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-refresh");
    });

    await page.route("**/api/monitor/snapshot*", async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          refreshAfterSeconds: 60,
          partial: false,
          providers: [],
          events: [],
        }),
      });
    });

    await page.goto("/monitor");

    const refreshButton = page.getByRole("button", { name: "Refresh", exact: true });
    await refreshButton.click();

    expect(capturedUrl).toContain("force=1");
  });

  test("displays INCIDENT (20s) when snapshot is unhealthy", async ({ page }) => {
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
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-incident");
    });

    await page.route("**/api/monitor/snapshot*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          refreshAfterSeconds: 20,
          partial: true,
          providers: [],
          events: [],
        }),
      });
    });

    await page.goto("/monitor");

    // Click Refresh to load mocked snapshot immediately
    await page.getByRole("button", { name: "Refresh", exact: true }).click();

    await expect(page.getByText(/INCIDENT \(20s\)/i)).toBeVisible();
  });
});
