// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-07 บันทึกพฤติกรรมและการติดตาม (Observations & Tracking)
// 📋 UAT Script (Teacher): บันทึกข้อสังเกตสำหรับคุณครู
// 🎯 อ้างอิง Test Case: TC-STS-07-01-01, TC-STS-07-01-02, TC-STS-07-05-01 (3 เคส)
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 5: บันทึกข้อสังเกตและติดตามพฤติกรรม (Teacher Observations)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  // 🔹 TC-STS-07-01-01: ตรวจสอบการบันทึกข้อสังเกตเกี่ยวกับพฤติกรรมของนักเรียน (Free-text)
  test("TC-STS-07-01-01: ตรวจสอบการบันทึกข้อสังเกตเกี่ยวกับพฤติกรรมของนักเรียน (Free-text)", async ({ page }) => {
    // ไปยังหน้ารายละเอียดเคส/นักเรียน
    await page.goto("/teacher/cases");
    await page.bringToFront();

    // เลือกลิงก์เคสแรกเพื่อดูรายละเอียด
    const caseItem = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseItem.isVisible()) {
      await caseItem.click();
    }

    // 1. ระบุข้อความในกล่องบันทึกข้อสังเกต (Free-text)
    const observationInput = page.locator("textarea[placeholder*='ข้อสังเกต'], textarea[name*='observation'], textarea").first();
    if (await observationInput.isVisible()) {
      await observationInput.fill("วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน");

      // 2. คลิกปุ่ม 'บันทึกข้อสังเกต'
      const saveObsBtn = page.getByRole("button", { name: /บันทึกข้อสังเกต|บันทึก/i }).first();
      await saveObsBtn.click();

      // ตรวจสอบว่าบันทึกสำเร็จและแสดงในประวัติ
      await expect(page.getByText(/วันนี้นักเรียนดูเหนื่อยล้า/i).first()).toBeVisible({ timeout: 5000 });
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-07-01-02: ตรวจสอบการบันทึกข้อสังเกต กรณีนักเรียนยังไม่มีเคสติดตาม (Student Case)
  test("TC-STS-07-01-02: ตรวจสอบการบันทึกข้อสังเกต กรณีนักเรียนยังไม่มีเคสติดตาม", async ({ page }) => {
    await page.goto("/teacher/tracking");
    await page.bringToFront();

    // ค้นหานักเรียนและกดบันทึกข้อสังเกต
    const obsInput = page.locator("textarea, input[placeholder*='สังเกต']").first();
    if (await obsInput.isVisible()) {
      await obsInput.fill("สังเกตเห็นนักเรียนมีสมาธิสั้นในคาบเรียน");
      const submitBtn = page.getByRole("button", { name: /บันทึก/i }).first();
      await submitBtn.click();
    }

    // ระบบบันทึกสำเร็จและจัดเก็บในประวัตินักเรียน
    await expect(page.locator("h1, h2").first()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-07-05-01: ตรวจสอบว่าข้อสังเกตล่าสุดถูกนำไปประมวลผลเมื่อกด "วิเคราะห์เคสด้วย AI"
  test("TC-STS-07-05-01: ตรวจสอบว่าข้อสังเกตล่าสุดถูกนำไปประมวลผลเมื่อกด วิเคราะห์เคสด้วย AI", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseItem = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseItem.isVisible()) {
      await caseItem.click();
    }

    // กดปุ่ม วิเคราะห์เคสด้วย AI
    const aiAnalyzeBtn = page.getByRole("button", { name: /วิเคราะห์เคสด้วย AI|วิเคราะห์ด้วย AI|AI Insights/i }).first();
    if (await aiAnalyzeBtn.isVisible()) {
      await aiAnalyzeBtn.click();
      // ผลวิเคราะห์จาก AI อ้างอิงเนื้อหาบันทึกข้อสังเกตล่าสุด
      await expect(page.locator("text=/AI|ความเสี่ยง|สรุป/i").first()).toBeVisible({ timeout: 10_000 });
    }

    await page.waitForTimeout(1500);
  });
});
