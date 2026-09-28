import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-11: Profile & Password Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as teacher
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-PWD-001: User visits change password page and sees policy checklist", async ({ page }) => {
    await page.goto("/change-password");
    await page.bringToFront();

    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.locator("h1")).toHaveText("เปลี่ยนรหัสผ่าน");

    // Inputs should exist
    await expect(page.locator("#oldPassword")).toBeVisible();
    await expect(page.locator("#newPassword")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    // Submit button should be disabled initially
    const submitBtn = page.locator("#change-password-submit");
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-PWD-002: User enters compliant new password and submits successfully", async ({ page }) => {
    await page.goto("/change-password");
    await page.bringToFront();

    // Fill form
    await page.locator("#oldPassword").fill("changeme");
    await page.locator("#newPassword").fill("SecurePass2026!");
    await page.locator("#confirmPassword").fill("SecurePass2026!");

    const submitBtn = page.locator("#change-password-submit");
    await expect(submitBtn).toBeEnabled();

    // Submit
    await submitBtn.click();

    // Verify success banner appears
    await expect(page.getByText(/เปลี่ยนรหัสผ่านสำเร็จแล้ว/i)).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(3000);
  });
});
