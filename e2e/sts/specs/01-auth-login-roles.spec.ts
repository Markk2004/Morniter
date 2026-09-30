// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 (Part 1): เข้าสู่ระบบตามบทบาทผู้ใช้ (Login as Role)
// 🎯 วัตถุประสงค์: ตรวจสอบการ Login ตามระดับสิทธิ์ (Teacher, Director, Admin, Officer) และการ Redirect
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { DEMO_CREDENTIALS, STS_ROLES } from "../fixtures/auth-data";
import { setupStsApiMocks } from "../fixtures/mock-api";

test.describe("FN-STS-01 (Part 1): Authentication - Login Roles Suite", () => {
  // [Precondition]: ล้างคุกกี้และจำลอง API Response สำหรับการ Login สำเร็จ
  test.beforeEach(async ({ page }) => {
    // 1. ล้าง Cookies ทั้งหมดเพื่อเริ่มการทดสอบจากสถานะยังไม่ล็อกอิน
    await page.context().clearCookies();

    // 2. เรียกใช้ Mock API กลางที่รองรับทุกสิทธิ์ (Active User, Refresh Token, Dashboard Data)
    await setupStsApiMocks(page);
  });

  // วนลูปทดสอบการเข้าสู่ระบบตามสิทธิ์ของแต่ละบทบาท
  for (const role of STS_ROLES) {
    const creds = DEMO_CREDENTIALS[role];
    test(`TC-STS-AUTH-${role.toUpperCase()}: Login as ${role} succeeds and redirects`, async ({ page }) => {
      const loginPage = new StsLoginPage(page);

      // [ขั้นตอนที่ 1]: นำทาง Browser ไปยังหน้าเข้าสู่ระบบ (/login)
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      // [ขั้นตอนที่ 2]: กรอกชื่อผู้ใช้และรหัสผ่านตามบทบาทที่กำหนด
      await loginPage.login(creds.username, creds.password);

      // [ขั้นตอนที่ 3]: ตรวจสอบผลลัพธ์ว่าระบบต้องนำทางออกจากหน้า /login สำเร็จ
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });

      // [ขั้นตอนที่ 4]: หน่วงเวลา 2.5 วินาทีเพื่อให้ตรวจสอบ UI ในโหมด Headed
      await page.waitForTimeout(2500);
    });
  }
});
