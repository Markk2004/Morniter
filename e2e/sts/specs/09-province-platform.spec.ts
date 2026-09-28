import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-10: Platform & Province Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as province-officer
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS["province-officer"];
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-PRV-001: Province Officer views province dashboard summary & metrics", async ({ page }) => {
    await page.goto("/province/dashboard");
    await page.bringToFront();

    await expect(page).toHaveURL(/\/province\/dashboard/);

    // Verify province name and severity summary are displayed
    await expect(page.getByText("กรุงเทพมหานคร").first()).toBeVisible();

    // Verify key metric figures or labels
    await expect(page.getByText(/โรงเรียน|สถานศึกษา/i).first()).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-PRV-002: Province Officer navigates to Province Reports workspace with tabs", async ({ page }) => {
    await page.goto("/province/reports");
    await page.bringToFront();

    await expect(page).toHaveURL(/\/province\/reports/);

    // Verify header and privacy badge
    await expect(page.getByText(/รายงานระดับจังหวัด/i).first()).toBeVisible();
    await expect(page.getByText(/ไม่มีข้อมูลนักเรียนรายบุคคล/i).first()).toBeVisible();

    // Verify tabs
    await expect(page.getByRole("tab", { name: /สร้างรายงาน/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /เปรียบเทียบโรงเรียน/i })).toBeVisible();

    await page.waitForTimeout(3000);
  });
});
