// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-01 ระบบยืนยันตัวตน (Authentication)
// 📋 UAT Script (Teacher): เข้าสู่ระบบสำหรับคุณครูที่ปรึกษา
// 🎯 อ้างอิง Test Case: TC-STS-01-03-03, TC-STS-01-04-03
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 1: ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);
  });

  // 🔹 TC-STS-01-03-03: ตรวจสอบการแสดงสถานะผู้ใช้ เมื่อเข้าสู่ระบบด้วยสถานะคุณครู
  test("TC-STS-01-03-03: ตรวจสอบการแสดงสถานะผู้ใช้ เมื่อเข้าสู่ระบบด้วยสถานะคุณครู", async ({ page }) => {
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;

    // 1. เข้า URL หน้าเข้าสู่ระบบ
    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    // 2. กรอกข้อมูลผู้ใช้และรหัสผ่าน (teacher_a / changeme)
    await loginPage.login(creds.username, creds.password);

    // 3. ตรวจสอบว่าระบบนำทางออกจากหน้า /login เข้าสู่หน้าแดชบอร์ด
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });

    // 4. ตรวจสอบการแสดงสถานะผู้ใช้ "ครูที่ปรึกษา" หรือบทบาทคุณครู
    const userRoleBadge = page.locator("text=/ครูที่ปรึกษา|ครู|TEACHER/i").first();
    await expect(userRoleBadge).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(2000);
  });

  // 🔹 TC-STS-01-04-03: ตรวจสอบการแสดงผลข้อมูล เมื่อเข้าสู่ระบบด้วยสถานะคุณครู
  test("TC-STS-01-04-03: ตรวจสอบการแสดงผลข้อมูล เมื่อเข้าสู่ระบบด้วยสถานะคุณครู", async ({ page }) => {
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;

    // 1. เข้า URL หน้าเข้าสู่ระบบ
    await loginPage.goto();
    await page.bringToFront();

    // 2. กรอกข้อมูลและกดปุ่มเข้าสู่ระบบ
    await loginPage.login(creds.username, creds.password);

    // 3. ระบบพานำทางเข้าสู่หน้า Dashboard ทันที
    await expect(page).toHaveURL(/\/teacher\/dashboard|\/dashboard/, { timeout: 15_000 });

    // 4. ระบบแสดงข้อมูลในหน้าแดชบอร์ดที่เกี่ยวข้องกับห้องเรียนของคุณครู
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator("text=/ห้องเรียน|ม\.3|สถิติ/i").first()).toBeVisible();

    await page.waitForTimeout(2000);
  });
});
