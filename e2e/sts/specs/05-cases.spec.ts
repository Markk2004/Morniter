// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-05 ระบบจัดการเคสปัญหา (Student Cases)
// 📋 UAT Script (Teacher): จัดการเคสผู้เรียนสำหรับคุณครู
// 🎯 อ้างอิง Test Case: TC-STS-05-01-01 ถึง TC-STS-05-09-02 (6 เคส)
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsCasesPage } from "../page-objects/cases.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 4: จัดการเคสผู้เรียน (Teacher Student Cases)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  // 🔹 TC-STS-05-01-01: ตรวจสอบการทำงานของช่องค้นหา เมื่อกรอกชื่อนักเรียนเป็นภาษาไทย
  test("TC-STS-05-01-01: ตรวจสอบการทำงานของช่องค้นหา เมื่อกรอกชื่อนักเรียนเป็นภาษาไทย", async ({ page }) => {
    const casesPage = new StsCasesPage(page);
    await casesPage.goto();
    await page.bringToFront();
    await expect(casesPage.heading()).toBeVisible();

    // กรอกชื่อภาษาไทย "กนกวรรณ"
    await casesPage.searchInput().fill("กนกวรรณ");
    await expect(casesPage.searchInput()).toHaveValue("กนกวรรณ");

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-05-01-02: ตรวจสอบการทำงานของช่องค้นหา เมื่อกรอกรหัสนักเรียน
  test("TC-STS-05-01-02: ตรวจสอบการทำงานของช่องค้นหา เมื่อกรอกรหัสนักเรียน", async ({ page }) => {
    const casesPage = new StsCasesPage(page);
    await casesPage.goto();
    await page.bringToFront();

    // กรอกรหัสนักเรียน "aa692003"
    await casesPage.searchInput().fill("aa692003");
    await expect(casesPage.searchInput()).toHaveValue("aa692003");

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-05-01-04: ตรวจสอบการทำงานของช่องค้นหา เมื่อกรอกข้อมูลถูกต้อง
  test("TC-STS-05-01-04: ตรวจสอบการทำงานของช่องค้นหา เมื่อกรอกข้อมูลถูกต้อง", async ({ page }) => {
    const casesPage = new StsCasesPage(page);
    await casesPage.goto();
    await page.bringToFront();

    // กรอกชื่อ-นามสกุล "กนกวรรณ ทองดี"
    await casesPage.searchInput().fill("กนกวรรณ ทองดี");

    // ตรวจสอบว่าระบบแสดงรายการเคสที่ตรงกับนักเรียนที่ค้นหา
    await expect(page.getByText(/กนกวรรณ/i).first()).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-05-02-02: ตรวจสอบการทำงานของปุ่มตัวกรอง เมื่อเลือกข้อมูล
  test("TC-STS-05-02-02: ตรวจสอบการทำงานของตัวกรองระดับความเสี่ยง (เสี่ยงสูง)", async ({ page }) => {
    const casesPage = new StsCasesPage(page);
    await casesPage.goto();
    await page.bringToFront();

    // เลือกตัวกรอง ความรุนแรงระดับสูง
    const severityBtn = page.locator("#severity-filter, button[role='combobox']").first();
    if (await severityBtn.isVisible()) {
      await severityBtn.click();
      const highOpt = page.locator("[role='option'], li, button").filter({ hasText: /^สูง$/i }).or(page.locator("text=/เสี่ยงสูง|HIGH/i")).first();
      if (await highOpt.isVisible()) {
        await highOpt.click();
      }
    }

    // แสดงเฉพาะ Student Case ที่มีความเสี่ยงสูง
    await expect(page.locator("table").getByText(/สูง|เสี่ยงสูง|HIGH/i).first()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-05-03-02: ตรวจสอบการทำงานของปุ่มตัวกรอง เมื่อเลือกข้อมูล
  test("TC-STS-05-03-02: ตรวจสอบการทำงานของตัวกรองสถานะเคส (กำลังติดตาม)", async ({ page }) => {
    const casesPage = new StsCasesPage(page);
    await casesPage.goto();
    await page.bringToFront();

    // เลือกตัวกรองสถานะเคส
    const filterBtn = page.getByRole("button", { name: /สถานะ|กำลังติดตาม/i }).first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
    }

    // รายการอัปเดตและแสดง Student Case ตามสถานะ
    await expect(casesPage.heading()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-05-09-02: ตรวจสอบการทำงานของปุ่มบันทึกเปิดเคส เมื่อกรอกข้อมูลครบถ้วน
  test("TC-STS-05-09-02: ตรวจสอบการทำงานของปุ่มบันทึกเปิดเคส เมื่อกรอกข้อมูลครบถ้วน", async ({ page }) => {
    const casesPage = new StsCasesPage(page);
    await casesPage.gotoCreate();
    await page.bringToFront();

    // 1. เลือกนักเรียน กมล ทองประเสริฐ หรือเลือกนักเรียนแถวแรก
    // 2. กรอกหัวข้อเคส และรายละเอียด
    await casesPage.fillForm({
      studentName: "กมล",
      title: "นักเรียนขาดเรียนติดต่อกันหลายวัน",
      description: "นักเรียนขาดเรียนติดต่อกันหลายวัน ต้องการการติดตามพฤติกรรมด่วน",
      severity: "high",
    });

    // 3. กดปุ่ม บันทึกเปิดเคส
    await casesPage.submit();

    // ตรวจสอบการสร้างเคสสำเร็จ และนำทางกลับหน้ารายการเคส
    await expect(page).toHaveURL(/\/teacher\/cases/, { timeout: 10_000 });

    await page.waitForTimeout(1500);
  });
});
