import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsDashboardPage } from "../page-objects/dashboard.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-08: Dashboard & Navigation Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);
  });

  test("TC-STS-DASH-TEACHER: Teacher dashboard displays classroom metrics and quick links", async ({ page }) => {
    const loginPage = new StsLoginPage(page);
    const dashPage = new StsDashboardPage(page);
    const creds = DEMO_CREDENTIALS.teacher;

    await loginPage.goto();
    await page.bringToFront();
    await loginPage.login(creds.username, creds.password);

    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
    await expect(dashPage.heading()).toBeVisible();

    // Verify key elements on Teacher Dashboard
    await expect(page.getByText(/ห้องเรียน|ม\.3/i).first()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-DASH-DIRECTOR: School Director dashboard displays school-wide statistics", async ({ page }) => {
    const loginPage = new StsLoginPage(page);
    const dashPage = new StsDashboardPage(page);
    const creds = DEMO_CREDENTIALS.director;

    await loginPage.goto();
    await page.bringToFront();
    await loginPage.login(creds.username, creds.password);

    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
    await expect(dashPage.heading()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-DASH-ADMIN: School Admin reaches admin console", async ({ page }) => {
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS["school-admin"];

    await loginPage.goto();
    await page.bringToFront();
    await loginPage.login(creds.username, creds.password);

    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });

    await page.waitForTimeout(3000);
  });
});
