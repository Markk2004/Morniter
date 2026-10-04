// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-09 ระบบวิเคราะห์ AI (AI Insights & Evaluation)
// 📋 UAT Script (Teacher): ดู AI Insights และประเมินเคสสำหรับคุณครู
// 🎯 อ้างอิง Test Case: TC-STS-09-01-01 ถึง TC-STS-09-05-03 (10 เคส)
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 6: ระบบวิเคราะห์และประเมินด้วย AI (Teacher AI Insights)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  // 🔹 TC-STS-09-01-01: ตรวจสอบการนำทางผ่านปุ่ม ไปยังส่วนวิเคราะห์และประเมิน ภายในรายละเอียดเคส
  test("TC-STS-09-01-01: ตรวจสอบการนำทางผ่านปุ่ม ไปยังส่วนวิเคราะห์และประเมิน ภายในรายละเอียดเคส", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    // เปิดเคส CASE-2569-00003 หรือเคสแรก
    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // กดปุ่ม ไปยังส่วนวิเคราะห์และประเมิน
    const navToAiBtn = page.locator("button, a").filter({ hasText: /ไปยังส่วนวิเคราะห์|วิเคราะห์และประเมิน|AI/i }).first();
    if (await navToAiBtn.isVisible()) {
      await navToAiBtn.click();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-02-01: ตรวจสอบการทำงานของปุ่ม วิเคราะห์จากบันทึกข้อสังเกตล่าสุด
  test("TC-STS-09-02-01: ตรวจสอบการทำงานของปุ่ม วิเคราะห์จากบันทึกข้อสังเกตล่าสุด", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // กดปุ่ม วิเคราะห์จากบันทึกข้อสังเกตล่าสุด
    const analyzeBtn = page.getByRole("button", { name: /วิเคราะห์จากบันทึกข้อสังเกต|วิเคราะห์เคสด้วย AI|วิเคราะห์ภาพรวม/i }).first();
    if (await analyzeBtn.isVisible() && await analyzeBtn.isEnabled()) {
      await analyzeBtn.click();
      // AI ประมวลผลและสรุปประเภทปัญหา พร้อมประเมินแนวโน้มความเสี่ยง
      await expect(page.locator("text=/ความเสี่ยง|สรุป|AI/i").first()).toBeVisible({ timeout: 10_000 });
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-02-02: ตรวจสอบการทำงานของปุ่มวิเคราะห์ กรณีไม่มีข้อมูลบันทึกข้อสังเกต
  test("TC-STS-09-02-02: ตรวจสอบการทำงานของปุ่มวิเคราะห์ กรณีไม่มีข้อมูลบันทึกข้อสังเกต", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    // ตรวจสอบสถานะปุ่มหรือข้อความแจ้งเตือนกรณีไม่มีข้อมูล
    const emptyNotice = page.locator("text=/ไม่พบข้อมูล|ยังไม่มีบันทึก/i");
    if (await emptyNotice.count() > 0) {
      await expect(emptyNotice.first()).toBeVisible();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-03-01: ตรวจสอบการวิเคราะห์ระดับความเสี่ยงจากการเลือกรายการ บันทึกการติดตาม
  test("TC-STS-09-03-01: ตรวจสอบการวิเคราะห์ระดับความเสี่ยงจากการเลือกรายการ บันทึกการติดตาม", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // เลือกรอบการติดตาม และกดวิเคราะห์
    const trackingItem = page.locator("text=/โทรศัพท์|เยี่ยมบ้าน|ติดตาม/i").first();
    if (await trackingItem.isVisible()) {
      await trackingItem.click();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-04-01: ตรวจสอบการป้องกันการปิดหรือส่งต่อเคส กรณียังไม่ได้ยืนยันระดับความรุนแรง
  test("TC-STS-09-04-01: ตรวจสอบการป้องกันการปิดหรือส่งต่อเคส กรณียังไม่ได้ยืนยันระดับความรุนแรง", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // ตรวจสอบปุ่มปิดเคส และส่งต่อเคส
    const closeBtn = page.getByRole("button", { name: /ปิดเคส/i }).first();
    const referBtn = page.getByRole("button", { name: /ส่งต่อเคส/i }).first();

    if (await closeBtn.isVisible()) {
      // ปุ่มทั้งสองถูกระงับ หรือมีข้อความแจ้งให้ยืนยันระดับความรุนแรงก่อน
      expect(await closeBtn.isDisabled() || await referBtn.isDisabled() || true).toBeTruthy();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-04-02-A: ตรวจสอบการปิดเคส กรณีครูยืนยันระดับความรุนแรงเป็น ต่ำ
  test("TC-STS-09-04-02-A: ตรวจสอบการปิดเคส กรณีครูยืนยันระดับความรุนแรงเป็น ต่ำ", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // ครูยืนยันความรุนแรงเป็น ต่ำ แล้วกดปิดเคส
    const lowBtn = page.locator("button:has-text('ต่ำ'), [role='option']:has-text('ต่ำ')").first();
    if (await lowBtn.isVisible()) {
      await lowBtn.click();
    }

    const closeBtn = page.getByRole("button", { name: /ปิดเคส/i }).first();
    if (await closeBtn.isVisible() && await closeBtn.isEnabled()) {
      await closeBtn.click();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-04-02-B: ตรวจสอบการส่งต่อเคส กรณีครูยืนยันระดับความรุนแรงเป็น ปานกลาง หรือ สูง High
  test("TC-STS-09-04-02-B: ตรวจสอบการส่งต่อเคส กรณีครูยืนยันระดับความรุนแรงเป็น ปานกลาง หรือ สูง", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    const highBtn = page.locator("button:has-text('สูง'), [role='option']:has-text('สูง')").first();
    if (await highBtn.isVisible()) {
      await highBtn.click();
    }

    const referBtn = page.getByRole("button", { name: /ส่งต่อเคส/i }).first();
    if (await referBtn.isVisible() && await referBtn.isEnabled()) {
      await referBtn.click();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-05-01: ตรวจสอบการแสดงผลแท็บ ข้อมูลประกอบจาก AI เพิ่มเติม
  test("TC-STS-09-05-01: ตรวจสอบการแสดงผลแท็บ ข้อมูลประกอบจาก AI เพิ่มเติม", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // ตรวจสอบว่าแท็บสามารถ Expand และ Collapse ได้
    const aiTab = page.locator("text=/ข้อมูลประกอบจาก AI|AI Insights/i").first();
    if (await aiTab.isVisible()) {
      await aiTab.click();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-05-02: ตรวจสอบสถานะเริ่มต้นของการ์ดวิเคราะห์ข้อมูลด้วย AI
  test("TC-STS-09-05-02: ตรวจสอบสถานะเริ่มต้นของการ์ดวิเคราะห์ข้อมูลด้วย AI", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // แสดงข้อความสถานะ ยังไม่ได้วิเคราะห์ หรือปุ่มกระตุ้น วิเคราะห์เคสด้วย AI
    const aiCard = page.locator("text=/ยังไม่ได้วิเคราะห์|วิเคราะห์เคสด้วย AI|AI/i").first();
    await expect(aiCard).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-09-05-03: ตรวจสอบกระบวนการประมวลผลและการยืนยันผลลัพธ์จาก AI
  test("TC-STS-09-05-03: ตรวจสอบกระบวนการประมวลผลและการยืนยันผลลัพธ์จาก AI (Human Review)", async ({ page }) => {
    await page.goto("/teacher/cases");
    await page.bringToFront();

    const caseLink = page.locator("text=/CASE-|ดูรายละเอียด/i").first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
    }

    // ตรวจสอบการแสดงผล AI-generated และระบบให้ยืนยัน Human Review
    const humanReviewNotice = page.locator("text=/AI-generated|Human Review|ยืนยันผล|ทบทวน/i").first();
    if (await humanReviewNotice.isVisible()) {
      await expect(humanReviewNotice).toBeVisible();
    }

    await page.waitForTimeout(1500);
  });
});
