import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsUsersPage } from "../page-objects/users.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-02: User Management Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as platform-admin
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS["platform-admin"];
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-USER-001: Platform Admin views users directory with KPI cards and table rows", async ({ page }) => {
    const usersPage = new StsUsersPage(page);

    await usersPage.goto();
    await page.bringToFront();

    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(usersPage.heading()).toBeVisible();

    // Verify user table and sample users are listed
    await expect(page.getByText("สมชาย ผู้ดูแลระบบ (Admin)").first()).toBeVisible();
    await expect(page.getByText("สมหญิง ครูประจำชั้น (Teacher)").first()).toBeVisible();

    // Verify Add User button is present
    await expect(usersPage.addUserButton()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-USER-002: Platform Admin filters users by status and search input", async ({ page }) => {
    const usersPage = new StsUsersPage(page);

    await usersPage.goto();
    await page.bringToFront();

    // Filter by search input
    await usersPage.searchInput().fill("สมหญิง");
    await page.waitForTimeout(600); // debounce

    await expect(page.getByText("สมหญิง ครูประจำชั้น (Teacher)").first()).toBeVisible();
    await expect(page.getByText("สมชาย ผู้ดูแลระบบ (Admin)")).not.toBeVisible();

    // Clear search
    await usersPage.searchInput().fill("");
    await page.waitForTimeout(600);
    await expect(page.getByText("สมชาย ผู้ดูแลระบบ (Admin)").first()).toBeVisible();

    // Filter by Suspended KPI button
    const suspendedBtn = usersPage.kpiSuspendedButton().first();
    if (await suspendedBtn.isVisible()) {
      await suspendedBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText("ระงับ บัญชีชั่วคราว (Suspended)").first()).toBeVisible();
    }

    await page.waitForTimeout(3000);
  });

  test("TC-STS-USER-003: Platform Admin opens Add User modal and inspects fields", async ({ page }) => {
    const usersPage = new StsUsersPage(page);

    await usersPage.goto();
    await page.bringToFront();

    await usersPage.addUserButton().click();
    await expect(usersPage.modal()).toBeVisible();

    // Check modal fields
    await expect(usersPage.fullNameInput()).toBeVisible();
    await expect(usersPage.usernameInput()).toBeVisible();

    // Close modal
    await usersPage.cancelButton().click();
    await expect(usersPage.modal()).not.toBeVisible();

    await page.waitForTimeout(3000);
  });
});
