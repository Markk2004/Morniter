import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsCasesPage } from "../page-objects/cases.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-05: Student Cases Suite", () => {
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

  test("TC-STS-CASE-001: Teacher views cases directory with status & severity badges", async ({ page }) => {
    const casesPage = new StsCasesPage(page);

    await casesPage.goto();
    await page.bringToFront();

    await expect(page).toHaveURL(/\/teacher\/cases/);
    await expect(casesPage.heading()).toBeVisible();

    // Verify case number and student name from mock
    await expect(page.getByText("CASE-2026-001")).toBeVisible();
    await expect(page.getByText("ชาญชัย มีสุข").first()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-CASE-002: Teacher navigates to create case form", async ({ page }) => {
    const casesPage = new StsCasesPage(page);

    await casesPage.goto();
    await page.bringToFront();

    await casesPage.createButton().click();
    await expect(page).toHaveURL(/\/teacher\/cases\/create/);

    // Form elements should be visible
    await expect(casesPage.studentCombobox()).toBeVisible();
    await expect(page.locator("input#title")).toBeVisible();
    await expect(page.locator("textarea#description")).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-CASE-003: Teacher submits new student case and navigates back to case directory", async ({ page }) => {
    const casesPage = new StsCasesPage(page);

    await casesPage.gotoCreate();
    await page.bringToFront();

    await casesPage.fillForm({
      studentName: "กิตติพงษ์",
      title: "นักเรียนมีพฤติกรรมเสี่ยงด้านสุขภาพจิต",
      description: "สังเกตพบนักเรียนมีความเครียดและแยกตัวจากกลุ่มเพื่อนในคาบเรียน",
      severity: "medium",
    });

    await casesPage.submit();

    // Should redirect back to cases list and show new case
    await expect(page).toHaveURL(/\/teacher\/cases/, { timeout: 15_000 });
    await expect(page.getByText("CASE-2026-002").first()).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(3000);
  });
});
