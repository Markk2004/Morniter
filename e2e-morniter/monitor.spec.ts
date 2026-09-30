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

test.describe("Authenticated Tutorial Learning Mode E2E Flow", () => {
  const authE2EEnabled = process.env.PLAYWRIGHT_AUTH_E2E === "1";
  test.skip(!authE2EEnabled, "Run with PLAYWRIGHT_AUTH_E2E=1 for authenticated Tutorial E2E");

  test("opens Learning Mode once, exercises rail and mobile responsive layout, persists in storage, and never mutates runner state", async ({ page }) => {
    const password = process.env.E2E_GROUP_PASSWORD;
    expect(password, "E2E_GROUP_PASSWORD must be set for authenticated E2E").toBeTruthy();

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

    const learningRegion = page.getByRole("region", { name: /Playwright Automation Learning Mode/i });
    await expect(learningRegion).toBeVisible();
    await expect(page.getByTestId("tutorial-learning-stage")).toBeVisible();

    // Verify 320px viewport without horizontal overflow
    await page.setViewportSize({ width: 320, height: 720 });
    await expect(page.getByTestId("tutorial-learning-stage")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.keyboard.press("ArrowRight");
    await expect(learningRegion.getByText("ขั้นตอน 2 จาก 9")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(learningRegion.getByText("ขั้นตอน 1 จาก 9")).toBeVisible();

    // Step forward to end
    for (let step = 1; step < 9; step += 1) {
      await learningRegion.getByRole("button", { name: /Next Step/i }).click();
    }
    await learningRegion.getByRole("button", { name: /เริ่มใช้งาน/i }).click();
    await expect(learningRegion).toBeHidden();

    // Assert persistence
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("morniter:playwright-tutorial:v1:seen")))
      .toBe("true");

    // Reload and assert remains hidden
    await page.reload();
    await expect(learningRegion).toBeHidden();

    // Manual reopen and Escape focus restoration
    const tutorialButton = page.getByRole("button", { name: /เปิด Tutorial/i });
    await tutorialButton.click();
    await expect(learningRegion).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(learningRegion).toBeHidden();
    await expect(tutorialButton).toBeFocused();

    expect(mutationRequests, "Tutorial must remain read-only").toEqual([]);
  });
});
