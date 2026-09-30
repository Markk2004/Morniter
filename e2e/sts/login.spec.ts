import { test, expect } from "@playwright/test";
import { StsLoginPage } from "./page-objects/login.page";
import { DEMO_CREDENTIALS, STS_ROLES } from "./fixtures/auth-data";
import { setupStsApiMocks } from "./fixtures/mock-api";

test.describe("ProjectSTS Authentication Suite (Run from project-monitor)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test for fresh session
    await page.context().clearCookies();

    // Use centralized STS API mocks with proper dynamic activeUser, refresh token, and academic year mocks
    await setupStsApiMocks(page);
  });

  // =========================================================================
  // 🔹 [Part 1]: เข้าสู่ระบบสำเร็จตามสิทธิ์ (Login as Role: Teacher, Director, Admin, Officer)
  // =========================================================================
  for (const role of STS_ROLES) {
    const creds = DEMO_CREDENTIALS[role];
    test(`TC-STS-AUTH-${role.toUpperCase()}: Login as ${role} succeeds and redirects`, async ({ page }) => {
      const loginPage = new StsLoginPage(page);

      // [ขั้นตอนที่ 1]: นำทาง Browser ไปยังหน้าเข้าสู่ระบบ (/login)
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      // [ขั้นตอนที่ 2]: กรอกชื่อผู้ใช้และรหัสผ่านตามบทบาท
      await loginPage.login(creds.username, creds.password);

      // [ขั้นตอนที่ 3]: ตรวจสอบว่าระบบนำทางออกจากหน้า /login สำเร็จ
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });

      // [ขั้นตอนที่ 4]: หน่วงเวลาเพื่อให้ตรวจสอบผลลัพธ์ในโหมด Headed
      await page.waitForTimeout(4_000);
    });
  }

  // =========================================================================
  // 🔹 [Part 2]: ตรวจสอบความปลอดภัยเมื่อรหัสผ่านผิด (Invalid Credentials Error Alert)
  // =========================================================================
  test("TC-STS-AUTH-INVALID: Invalid credentials displays an error alert", async ({ page }) => {
    const loginPage = new StsLoginPage(page);

    // [ขั้นตอนที่ 1]: นำทาง Browser ไปยังหน้าเข้าสู่ระบบ (/login)
    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    // [ขั้นตอนที่ 2]: กรอกชื่อผู้ใช้และรหัสผ่านที่ไม่ถูกต้อง
    await loginPage.login("invalid_user", "wrong_pass_123");

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ามีกล่องแจ้งเตือน Error Alert แสดงขึ้นมา
    await expect(loginPage.alertMessage()).toBeVisible({ timeout: 10_000 });

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบยังคงอยู่ที่หน้า /login ไม่ยอมให้ผ่าน
    await expect(page).toHaveURL(/\/login/);

    await page.waitForTimeout(3_000);
  });

  // =========================================================================
  // 🔹 [Part 3]: ตรวจสอบการเว้นว่างข้อมูลเข้าสู่ระบบ (Empty Credentials Rejected)
  // =========================================================================
  test("TC-STS-AUTH-EMPTY: Empty username/password submission is rejected", async ({ page }) => {
    const loginPage = new StsLoginPage(page);

    // [ขั้นตอนที่ 1]: นำทาง Browser ไปยังหน้าเข้าสู่ระบบ (/login)
    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    // [ขั้นตอนที่ 2]: คลิกปุ่มเข้าสู่ระบบทันทีโดยไม่กรอก Username และ Password
    await loginPage.submitButton().click();

    // [ขั้นตอนที่ 3]: ตรวจสอบว่าแสดงข้อความเตือนให้กรอกข้อมูล
    await expect(loginPage.alertMessage()).toBeVisible({ timeout: 5_000 });

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบยังคงอยู่ที่หน้า /login ไม่เปลี่ยนหน้า
    await expect(page).toHaveURL(/\/login/);

    await page.waitForTimeout(3_000);
  });
});
