import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsTrackingPage } from "../page-objects/tracking.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-07: Student Observations & Tracking Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as teacher first
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-TRK-001: Teacher opens student tracking map view", async ({ page }) => {
    const trkPage = new StsTrackingPage(page);

    await trkPage.goto();
    await page.bringToFront();

    await expect(page).toHaveURL(/\/teacher\/tracking/);
    await expect(trkPage.heading()).toBeVisible();

    // Verify student names in the tracking list
    await expect(page.getByText("กิตติพงษ์ สุขเกษม")).toBeVisible();
    await expect(page.getByText("ชาญชัย มีสุข")).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-TRK-002: Teacher searches student on tracking list", async ({ page }) => {
    const trkPage = new StsTrackingPage(page);

    await trkPage.goto();
    await page.bringToFront();

    await trkPage.searchInput().fill("กิตติพงษ์");

    await expect(page.getByText("กิตติพงษ์ สุขเกษม")).toBeVisible();
    await expect(page.getByText("ชาญชัย มีสุข")).not.toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-TRK-003: Teacher filters tracking view by risk level", async ({ page }) => {
    const trkPage = new StsTrackingPage(page);

    await trkPage.goto();
    await page.bringToFront();

    // Select medium risk (ชาญชัย มีสุข has 4 absences -> medium risk)
    await trkPage.filterByRisk("เสี่ยงปานกลาง");

    // ชาญชัย มีสุข has risk_level: 'medium'
    await expect(page.getByText("ชาญชัย มีสุข").first()).toBeVisible();
    // กิตติพงษ์ has risk_level: 'low'
    await expect(page.getByText("กิตติพงษ์ สุขเกษม")).not.toBeVisible();

    await page.waitForTimeout(3000);
  });
});
