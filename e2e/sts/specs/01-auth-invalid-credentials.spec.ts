// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 (Part 2): ตรวจสอบความปลอดภัยเมื่อรหัสผ่านผิด (Invalid Credentials)
// 🎯 วัตถุประสงค์: ตรวจสอบว่าระบบปฏิเสธการเข้าถึง และแสดง Alert ข้อความเตือน Error สีแดง
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";

test.describe("FN-STS-01 (Part 2): Authentication - Invalid Credentials Suite", () => {
  // [Precondition]: ล้างคุกกี้และจำลอง API Response 401 Unauthorized
  test.beforeEach(async ({ page }) => {
    // 1. ล้างคุกกี้ทั้งหมดเพื่อเริ่มทดสอบสถานะยังไม่ล็อกอิน
    await page.context().clearCookies();

    // 2. จำลอง Route Mocking ให้ตอบกลับ 401 เมื่อรหัสผ่านไม่ถูกต้อง
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }),
      });
    });
  });

  // [เคสทดสอบ]: กรอกรหัสผ่านผิดและตรวจสอบการแจ้งเตือน
  test("TC-STS-AUTH-INVALID: Invalid credentials displays an error alert", async ({ page }) => {
    const loginPage = new StsLoginPage(page);

    // [ขั้นตอนที่ 1]: นำทาง Browser ไปที่ URL หน้าล็อกอิน (/login)
    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    // [ขั้นตอนที่ 2]: กรอกชื่อผู้ใช้และรหัสผ่านที่ไม่ถูกต้อง
    await loginPage.login("invalid_user", "wrong_pass_123");

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ากล่องข้อความเตือน Error Alert ต้องปรากฏขึ้นบนหน้าจอ
    await expect(loginPage.alertMessage()).toBeVisible({ timeout: 10_000 });

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบยังคงอยู่ที่หน้า /login ไม่ยอมให้เข้าถึงระบบ
    await expect(page).toHaveURL(/\/login/);

    // [ขั้นตอนที่ 5]: หน่วงเวลา 2.5 วินาทีเพื่อให้ตรวจสอบ UI ในโหมด Headed
    await page.waitForTimeout(2500);
  });
});
