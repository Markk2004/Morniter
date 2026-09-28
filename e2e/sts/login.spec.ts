import { test, expect } from "@playwright/test";
import { StsLoginPage } from "./page-objects/login.page";
import { DEMO_CREDENTIALS, STS_ROLES, type StsRole } from "./fixtures/auth-data";

test.describe("ProjectSTS Authentication Suite (Run from project-monitor)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test for fresh session
    await page.context().clearCookies();

    // Route mocking for /api/auth/login to enable autonomous running without database dependencies
    await page.route("**/api/auth/login", async (route) => {
      let postData: { username?: string; password?: string } | null = null;
      try {
        postData = route.request().postDataJSON();
      } catch {
        postData = null;
      }
      const { username, password } = postData || {};

      if (password === "changeme") {
        const roleEntry = Object.values(DEMO_CREDENTIALS).find(
          (c) => c.username === username,
        );
        const roleEnum = roleEntry ? roleEntry.roleEnum : "TEACHER";

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "mock-jwt-token-from-monitor",
            user: {
              id: 99,
              username,
              name: `UAT User (${username})`,
              role: roleEnum,
              schoolId: 1,
            },
          }),
        });
      }

      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }),
      });
    });
  });

  for (const role of STS_ROLES) {
    const creds = DEMO_CREDENTIALS[role];
    test(`TC-STS-AUTH-${role.toUpperCase()}: Login as ${role} succeeds and redirects`, async ({ page }) => {
      const loginPage = new StsLoginPage(page);

      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      await loginPage.login(creds.username, creds.password);

      // Verify redirected away from /login
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });

      // Visual pause so user can inspect the logged-in screen in headed mode
      await page.waitForTimeout(4_000);
    });
  }

  test("TC-STS-AUTH-INVALID: Invalid credentials displays an error alert", async ({ page }) => {
    const loginPage = new StsLoginPage(page);

    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    await loginPage.login("invalid_user", "wrong_pass_123");

    await expect(loginPage.alertMessage()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await page.waitForTimeout(3_000);
  });

  test("TC-STS-AUTH-EMPTY: Empty username/password submission is rejected", async ({ page }) => {
    const loginPage = new StsLoginPage(page);

    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    await loginPage.submitButton().click();

    await expect(loginPage.alertMessage()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);

    await page.waitForTimeout(3_000);
  });
});
