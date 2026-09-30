// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 (Part 3): ตรวจสอบการเว้นว่างข้อมูลเข้าสู่ระบบ (Empty Credentials)
// 🎯 วัตถุประสงค์: ตรวจสอบว่าระบบปฏิเสธการส่งฟอร์มเมื่อเว้นว่าง Username หรือ Password
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";

test.describe("FN-STS-01 (Part 3): Authentication - Empty Submission Suite", () => {
  // [Precondition]: ล้างคุกกี้ก่อนเริ่มการทดสอบ
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // [เคสทดสอบ]: เว้นว่าง Username/Password และกด Submit
  test("TC-STS-AUTH-EMPTY: Empty username/password submission is rejected", async ({ page }) => {
    const loginPage = new StsLoginPage(page);

    // [ขั้นตอนที่ 1]: นำทาง Browser ไปที่ URL หน้าล็อกอิน (/login)
    await loginPage.goto();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/login/);

    // [ขั้นตอนที่ 2]: คลิกปุ่ม 'เข้าสู่ระบบ' (Submit) ทันทีโดยไม่กรอก Username และ Password
    await loginPage.submitButton().click();

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ามีกล่องเตือน หรือ Validation Alert ปรากฏขึ้น
    await expect(loginPage.alertMessage()).toBeVisible({ timeout: 5_000 });

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบยังคงอยู่ที่หน้า /login ไม่ยอมให้เข้าถึงระบบ
    await expect(page).toHaveURL(/\/login/);

    // [ขั้นตอนที่ 5]: หน่วงเวลา 2.5 วินาทีเพื่อให้ตรวจสอบผลลัพธ์บนหน้าจอ
    await page.waitForTimeout(2500);
  });
});
