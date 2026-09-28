import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsAttendancePage } from "../page-objects/attendance.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-04: Attendance Suite", () => {
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

  test("TC-STS-ATT-001: Teacher opens daily attendance screen", async ({ page }) => {
    const attPage = new StsAttendancePage(page);

    await attPage.goto();
    await page.bringToFront();

    await expect(page).toHaveURL(/\/teacher\/attendance/);
    await expect(attPage.heading()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-ATT-002: Teacher sees attendance counts and student check-in rows", async ({ page }) => {
    const attPage = new StsAttendancePage(page);

    await attPage.goto();
    await page.bringToFront();

    await expect(attPage.heading()).toBeVisible();

    // Verify summary metric labels
    await expect(page.getByText("มาเรียน").first()).toBeVisible();
    await expect(page.getByText("ขาดเรียน").first()).toBeVisible();

    // Verify student rows
    await expect(page.getByText("กิตติพงษ์ สุขเกษม")).toBeVisible();
    await expect(page.getByText("ชาญชัย มีสุข")).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-ATT-003: Teacher filters student list by search input", async ({ page }) => {
    const attPage = new StsAttendancePage(page);

    await attPage.goto();
    await page.bringToFront();

    await expect(attPage.heading()).toBeVisible();

    // Search for specific student
    const searchInput = page.getByPlaceholder(/ค้นหาชื่อหรือรหัส/i);
    await searchInput.fill("กิตติพงษ์");

    await expect(page.getByText("กิตติพงษ์ สุขเกษม")).toBeVisible();
    await expect(page.getByText("ชาญชัย มีสุข")).not.toBeVisible();

    await page.waitForTimeout(3000);
  });
});
