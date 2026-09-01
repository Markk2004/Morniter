import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

const E2E_SESSION_SECRET = "e2e-only-session-signing-secret-with-at-least-48-characters";

async function makeValidSessionToken(): Promise<string> {
  const secret = process.env.SESSION_SIGNING_SECRET || E2E_SESSION_SECRET;
  const secretBytes = new TextEncoder().encode(secret);
  return new SignJWT({ scope: "monitor:read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-web")
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .setExpirationTime(Math.floor(Date.now() / 1000) + 8 * 3600)
    .sign(secretBytes);
}

test.describe("Playwright Workspace Balanced Layout (Layout B)", () => {
  test.beforeEach(async ({ page }) => {
    const token = await makeValidSessionToken();
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        url: "http://localhost:3100",
      },
      {
        name: "project_monitor_session",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-layout-test");
      window.localStorage.setItem("morniter:playwright-tutorial:v1:seen", "true");
    });

    // Mock monitor session route
    await page.route("**/api/monitor/session*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        }),
      });
    });

    // Mock lock route (unlocked)
    await page.route("**/api/test-runner/lock*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unlocked: true }),
      });
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
                id: "project-sts",
                name: "ProjectSTS",
                rootLabel: "frontend",
                scanPathLabel: "frontend/e2e",
                capabilities: {
                  browsers: { chromium: true, firefox: true, webkit: true },
                  headed: true,
                  workspaceExecution: true,
                },
                testGroups: [
                  {
                    name: "Authentication",
                    tests: [
                      {
                        id: "pw-login-1",
                        title: "Login with valid credentials",
                        group: "Authentication",
                        relativePath: "frontend/e2e/auth/login.spec.ts",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    // Mock jobs route
    await page.route("**/api/playwright-runner/jobs*", async (route) => {
      if (route.request().method() === "POST") {
        if (route.request().url().includes("/cancel")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "job-e2e-run-1",
            status: "running",
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            target: {
              projectId: "project-sts",
              browsers: ["chromium"],
              mode: "headless",
              source: "tests",
              selectedTestIds: ["pw-login-1"],
            },
            terminalLines: [],
            artifacts: [],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [] }),
      });
    });
  });

  test("renders wide desktop layout (1440x900) bounded to viewport height with internal scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/monitor/tests");

    // 1. Check compact toolbar and unique tutorial targets
    const controlBar = page.getByTestId("workspace-control-bar");
    await expect(controlBar).toBeVisible();
    await expect(page.getByText(/Local Agent Online/i)).toBeVisible();

    // Verify exactly ONE data-tutorial-id="run" in the entire DOM
    const runTargets = page.locator('[data-tutorial-id="run"]');
    await expect(runTargets).toHaveCount(1);

    // 2. Check Explorer and Code side-by-side
    const explorer = page.locator('[data-tutorial-id="select-test"]');
    const code = page.locator('[data-tutorial-id="code"]');
    await expect(explorer).toBeVisible();
    await expect(code).toBeVisible();

    // 3. Check separators (1 vertical, 1 horizontal)
    const separators = page.getByRole("separator");
    await expect(separators).toHaveCount(2);

    // 4. Verify workspace remains bounded within viewport height
    const workspaceBox = await page.getByTestId("balanced-workspace").boundingBox();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.y + workspaceBox!.height).toBeLessThanOrEqual(900);

    // Verify Explorer panel scrolls internally
    const explorerScroll = await page.getByTestId("workspace-explorer-panel").evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(explorerScroll.overflowY).toBe("auto");

    // 5. Test Terminal collapse button accessibility and behavior
    const terminalToggle = page.getByRole("button", { name: /Collapse Terminal/i });
    await expect(terminalToggle).toHaveAttribute("aria-expanded", "true");
    await terminalToggle.click();

    const expandToggle = page.getByRole("button", { name: /Expand Terminal/i });
    await expect(expandToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#terminal-panel-body")).toHaveCount(0);

    // Re-expand terminal
    await expandToggle.click();
    await expect(page.getByRole("button", { name: /Collapse Terminal/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // 6. Verify no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("renders 1024x768 laptop layout bounded to viewport without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/monitor/tests");

    // Toolbar and split layout remain visible
    await expect(page.getByTestId("workspace-control-bar")).toBeVisible();
    await expect(page.getByRole("separator")).toHaveCount(2);

    const workspaceBox = await page.getByTestId("balanced-workspace").boundingBox();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.y + workspaceBox!.height).toBeLessThanOrEqual(768);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("verifies exact 900px (desktop) vs 899px (tabs) boundary transition", async ({ page }) => {
    // At 900px: desktop layout with separators
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/monitor/tests");
    await expect(page.getByRole("separator")).toHaveCount(2);
    await expect(page.getByRole("tablist", { name: /Workspace tabs/i })).toHaveCount(0);

    // At 899px: tabbed layout without separators
    await page.setViewportSize({ width: 899, height: 800 });
    await expect(page.getByRole("separator")).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: /Workspace tabs/i })).toBeVisible();
  });

  test("renders 3-tab layout at 587x762 bounded to viewport height without horizontal overflow or long stack", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 587, height: 762 });
    await page.goto("/monitor/tests");

    // Compact toolbar is visible
    await expect(page.getByTestId("workspace-control-bar")).toBeVisible();

    // Tabs replace desktop resizers
    const tablist = page.getByRole("tablist", { name: /Workspace tabs/i });
    await expect(tablist).toBeVisible();
    await expect(page.getByRole("separator")).toHaveCount(0);

    // Expand Authentication group and select test in Explorer tab
    const authGroup = page.getByText("Authentication");
    await expect(authGroup).toBeVisible();
    await authGroup.click();

    const testCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(testCheckbox).toBeVisible();
    await testCheckbox.check();

    // Switch to Code tab
    const codeTab = page.getByRole("tab", { name: /Code/i });
    await codeTab.click();
    await expect(page.locator('[data-tutorial-id="code"]')).toBeVisible();

    // Verify hidden Explorer panel does not contribute height
    const explorerPanel = page.locator("#tabpanel-explorer");
    await expect(explorerPanel).toBeHidden();

    // Switch to Terminal tab
    const terminalTab = page.getByRole("tab", { name: /Terminal/i });
    await terminalTab.click();
    await expect(page.getByRole("log")).toBeVisible();

    // Switch back to Explorer tab and verify test remains checked
    const explorerTab = page.getByRole("tab", { name: /Explorer/i });
    await explorerTab.click();
    await expect(testCheckbox).toBeChecked();

    // Verify workspace remains bounded within viewport height
    const workspaceBox = await page.getByTestId("balanced-workspace").boundingBox();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.y + workspaceBox!.height).toBeLessThanOrEqual(762);

    // Verify no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("exercises single Run to Cancel action slot lifecycle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/monitor/tests");

    // Expand group and select a test
    await page.getByText("Authentication").click();
    const testCheckbox = page.locator('input[type="checkbox"]').first();
    await testCheckbox.check();

    // Locate the single Run button container
    const runSlot = page.locator('[data-tutorial-id="run"]');
    await expect(runSlot).toHaveCount(1);

    const runBtn = runSlot.getByRole("button", { name: /Run/i });
    await expect(runBtn).toBeEnabled();

    // Trigger run
    await runBtn.click();

    // Cancel button appears in the exact same slot
    const cancelBtn = runSlot.getByRole("button", { name: /Cancel/i });
    await expect(cancelBtn).toBeVisible();

    // Cancel job
    await cancelBtn.click();

    // Terminal remains visible and functional
    await expect(page.locator('[data-tutorial-id="terminal"]')).toBeVisible();
  });

  test("persists preferences and Reset layout restores default dimensions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/monitor/tests");

    // Collapse terminal
    const terminalToggle = page.getByRole("button", { name: /Collapse Terminal/i });
    await terminalToggle.click();
    await expect(page.getByRole("button", { name: /Expand Terminal/i })).toBeVisible();

    // Wait for debounced localStorage write
    await page.waitForTimeout(200);

    // Reload page and check that terminal remains collapsed
    await page.reload();
    await expect(page.getByRole("button", { name: /Expand Terminal/i })).toBeVisible();

    // Click Reset layout button
    const resetBtn = page.getByRole("button", { name: /Reset layout/i });
    await resetBtn.click();

    // Verify terminal expands back to default
    await expect(page.getByRole("button", { name: /Collapse Terminal/i })).toBeVisible();
  });

  test("recovers from expired execution session, unlocks, and streams realtime summary and logs", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    let runSubmissionCount = 0;

    await page.route(/\/api\/playwright-runner\/jobs/, async (route) => {
      const req = route.request();
      if (req.url().includes("/jobs/plw-job-recovery-e2e")) {
        const url = new URL(req.url());
        const cursor = parseInt(url.searchParams.get("cursor") || "0", 10);

        if (cursor === 0) {
          // Batch 1: summary and first stdout line
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              job: {
                id: "plw-job-recovery-e2e",
                status: "running",
                browsers: ["chromium"],
                mode: "headless",
                createdAt: new Date().toISOString(),
              },
              logs: [
                { sequence: 0, timestamp: new Date().toISOString(), stream: "system", message: "[RUN] Project: sts-playwright" },
                { sequence: 1, timestamp: new Date().toISOString(), stream: "system", message: "[RUN] Source: Project tests" },
                { sequence: 2, timestamp: new Date().toISOString(), stream: "system", message: "[RUN] Tests: 1 selected" },
                { sequence: 3, timestamp: new Date().toISOString(), stream: "system", message: "[RUN] Browsers: chromium" },
                { sequence: 4, timestamp: new Date().toISOString(), stream: "system", message: "[RUN] Mode: headless" },
                { sequence: 5, timestamp: new Date().toISOString(), stream: "stdout", message: "Step 1 passed" },
              ],
              nextSequence: 6,
              hasMore: true,
            }),
          });
        }

        // Batch 2: final stdout line and completion
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            job: {
              id: "plw-job-recovery-e2e",
              status: "passed",
              browsers: ["chromium"],
              mode: "headless",
              createdAt: new Date().toISOString(),
            },
            logs: [
              { sequence: 6, timestamp: new Date().toISOString(), stream: "stdout", message: "Step 2 passed" },
              { sequence: 7, timestamp: new Date().toISOString(), stream: "stdout", message: "1 passed" },
            ],
            nextSequence: 8,
            hasMore: false,
          }),
        });
      }

      if (req.method() === "POST") {
        runSubmissionCount += 1;
        if (runSubmissionCount === 1) {
          // First submission fails with 403 EXECUTION_REQUIRED
          return route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              code: "EXECUTION_REQUIRED",
              error: "Execution session expired or invalid",
            }),
          });
        }
        // Second submission succeeds
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "plw-job-recovery-e2e",
            projectId: "sts-playwright",
            source: "project-test",
            status: "running",
            browsers: ["chromium"],
            mode: "headless",
            createdAt: new Date().toISOString(),
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [] }),
      });
    });

    await page.route(/\/api\/test-runner\/auth/, async (route) => {
      return route.fulfill({
        status: 204,
        headers: { "Set-Cookie": "project_monitor_execute=unlocked; Path=/; HttpOnly" },
      });
    });

    await page.goto("/monitor/tests");

    // 1. Expand group and select test
    await page.getByText("Authentication").click();
    const testCheckbox = page.locator('input[type="checkbox"]').first();
    await testCheckbox.check();

    const runSlot = page.locator('[data-tutorial-id="run"]');
    const runBtn = runSlot.getByRole("button", { name: /Run/i });
    await expect(runBtn).toBeEnabled({ timeout: 5000 });

    // 2. Click Run -> 403 EXECUTION_REQUIRED triggers recovery
    const firstPost = page.waitForResponse(
      (res) => res.url().includes("/api/playwright-runner/jobs") && res.request().method() === "POST",
    );
    await runBtn.click();
    await firstPost;

    // 3. Execution Lock card appears with expiry alert
    await expect(page.getByText(/Execution Lock Active/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("alert").filter({ hasText: /Execution permission expired/i })).toBeVisible();
    await expect(runBtn).toBeDisabled();

    // 4. Unlock execution
    await page.route("**/api/test-runner/lock*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unlocked: true }),
      });
    });

    const unlockInput = page.getByPlaceholder(/Group password/i);
    await unlockInput.fill("valid-pass");
    await page.getByRole("button", { name: /Unlock Execution/i }).click();

    // 5. Unlocked -> Run button re-enabled
    await expect(page.getByText(/Execution Lock Active/i)).not.toBeVisible({ timeout: 5000 });
    await expect(runBtn).toBeEnabled();

    // 6. Submit Run again -> succeeds (201)
    const secondPost = page.waitForResponse(
      (res) => res.url().includes("/api/playwright-runner/jobs") && res.request().method() === "POST",
    );
    await runBtn.click();
    await secondPost;

    // 7. Terminal displays safe run summary lines without gaps
    await expect(page.getByText("[RUN] Project: sts-playwright")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("[RUN] Source: Project tests")).toBeVisible();
    await expect(page.getByText("[RUN] Tests: 1 selected")).toBeVisible();
    await expect(page.getByText("[RUN] Browsers: chromium")).toBeVisible();
    await expect(page.getByText("[RUN] Mode: headless")).toBeVisible();

    // 8. Both batches stream completely
    await expect(page.getByText("Step 1 passed")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Step 2 passed")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("1 passed", { exact: true })).toBeVisible({ timeout: 5000 });
  });
});
