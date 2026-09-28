import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsReportsPage } from "../page-objects/reports.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-06: Case Reports & Export Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as director
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.director;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-REP-001: Director views Reports Workspace and configures report query", async ({ page }) => {
    const reportsPage = new StsReportsPage(page);

    await reportsPage.gotoDirector();
    await page.bringToFront();

    await expect(page).toHaveURL(/\/director\/reports/);
    await expect(reportsPage.generateButton()).toBeVisible();

    // Verify report type selector is visible
    await expect(reportsPage.reportTypeTrigger()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-REP-002: Director generates report preview and inspects results table", async ({ page }) => {
    const reportsPage = new StsReportsPage(page);

    await reportsPage.gotoDirector();
    await page.bringToFront();

    // Click generate preview button
    await reportsPage.generateButton().click();

    // Table and mock rows should appear
    await expect(reportsPage.previewTable()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("CASE-2026-001").first()).toBeVisible();
    await expect(page.getByText("กิตติพงษ์ สุขเกษม").first()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-REP-003: Director triggers export for Excel and PDF downloads", async ({ page }) => {
    const reportsPage = new StsReportsPage(page);

    await reportsPage.gotoDirector();
    await page.bringToFront();

    // First generate preview so export buttons become active
    await reportsPage.generateButton().click();
    await expect(reportsPage.previewTable()).toBeVisible({ timeout: 10_000 });

    // Verify export buttons are present
    const excelBtn = reportsPage.exportExcelButton().first();
    const pdfBtn = reportsPage.exportPdfButton().first();

    await expect(excelBtn).toBeVisible();
    await expect(pdfBtn).toBeVisible();

    // Trigger excel download
    await excelBtn.click();
    await expect(page.getByText(/ดาวน์โหลดรายงาน XLSX สำเร็จ|ดาวน์โหลดรายงาน EXCEL สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

    // Trigger PDF download
    await pdfBtn.click();
    await expect(page.getByText(/ดาวน์โหลดรายงาน PDF สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(3000);
  });
});
