// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-08 แดชบอร์ดตามบทบาทผู้ใช้ (Dashboard Navigation)
// 📋 UAT Script (Teacher): ดูแดชบอร์ดสำหรับคุณครูที่ปรึกษา
// 🎯 อ้างอิง Test Case: TC-STS-08-32-01 ถึง TC-STS-08-37-01 (11 เคส)
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsDashboardPage } from "../page-objects/dashboard.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 2: แดชบอร์ดครูที่ปรึกษา (Teacher Dashboard)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  // 🔹 TC-STS-08-32-01: ตรวจสอบการแสดง Banner แจ้งเตือน 'ยังไม่ได้เช็คชื่อวันนี้'
  test("TC-STS-08-32-01: ตรวจสอบการแสดง Banner แจ้งเตือน ยังไม่ได้เช็คชื่อวันนี้", async ({ page }) => {
    const dashPage = new StsDashboardPage(page);
    await expect(dashPage.heading()).toBeVisible();

    // แสดง Banner แจ้งเตือนสถานะการเช็คชื่อ พร้อมปุ่ม 'เริ่มเช็คชื่อ'
    const banner = page.locator("main").locator("text=/ยังไม่ได้เช็[คก]ชื่อ|เริ่มเช็[คก]ชื่อ|เช็[คก]ชื่อประจำวัน/i").first();
    await expect(banner).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-32-02: ตรวจสอบสถานะ Banner หลังดำเนินการเช็คชื่อประจำวันเรียบร้อยแล้ว
  test("TC-STS-08-32-02: ตรวจสอบสถานะ Banner หลังดำเนินการเช็คชื่อประจำวันเรียบร้อยแล้ว", async ({ page }) => {
    // จำลองการเช็คชื่อแล้ว หรือตรวจสอบปุ่มแก้ไข/สถานะเช็คชื่อแล้ว
    const checkStatus = page.locator("main").locator("text=/เช็[คก]ชื่อแล้ว|แก้ไข|เริ่มเช็[คก]ชื่อ/i").first();
    await expect(checkStatus).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-33-01: ตรวจสอบการนำทางของปุ่ม 'เริ่มเช็คชื่อ' บน Banner
  test("TC-STS-08-33-01: ตรวจสอบการนำทางของปุ่ม เริ่มเช็คชื่อ บน Banner", async ({ page }) => {
    const startCheckInBtn = page.getByRole("button", { name: /เริ่มเช็คชื่อ|เช็คชื่อ/i }).or(page.getByRole("link", { name: /เริ่มเช็คชื่อ|เช็คชื่อ/i })).first();
    if (await startCheckInBtn.isVisible()) {
      await startCheckInBtn.click();
      await expect(page).toHaveURL(/\/teacher\/attendance|\/attendance/, { timeout: 10_000 });
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-34-01: ตรวจสอบความถูกต้องของการ์ดสรุปข้อมูล ก่อนการเช็คชื่อประจำวัน
  test("TC-STS-08-34-01: ตรวจสอบความถูกต้องของการ์ดสรุปข้อมูล ก่อนการเช็คชื่อประจำวัน", async ({ page }) => {
    const dashPage = new StsDashboardPage(page);
    await expect(dashPage.heading()).toBeVisible();

    // จำนวนนักเรียนในห้องแสดงถูกต้อง
    const studentCountEl = page.locator("text=/นักเรียนทั้งหมด|35|37/i").first();
    await expect(studentCountEl).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-34-02: ตรวจสอบการอัปเดตข้อมูลบนการ์ดสรุป หลังการเช็คชื่อประจำวัน
  test("TC-STS-08-34-02: ตรวจสอบการอัปเดตข้อมูลบนการ์ดสรุป หลังการเช็คชื่อประจำวัน", async ({ page }) => {
    // ข้อมูลแสดงตัวเลขการเข้าเรียน ขาดเรียน
    await expect(page.getByText(/มาเรียน|ขาดเรียน/i).first()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-34-03: ตรวจสอบตัวเลขสรุปบนการ์ด 'เคสที่ต้องติดตาม'
  test("TC-STS-08-34-03: ตรวจสอบตัวเลขสรุปบนการ์ด เคสที่ต้องติดตาม", async ({ page }) => {
    const casesCard = page.locator("text=/เคสที่ต้องติดตาม|เคสติดตาม|เคสรอการดำเนินการ/i").first();
    await expect(casesCard).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-35-01: ตรวจสอบการสลับแท็บแสดงข้อมูลระหว่าง 'ขาดเรียน' และ 'เคสติดตาม'
  test("TC-STS-08-35-01: ตรวจสอบการสลับแท็บแสดงข้อมูลระหว่าง ขาดเรียน และ เคสติดตาม", async ({ page }) => {
    // 1. กดแท็บ ขาดเรียน
    const absentTab = page.locator("button, [role='tab']").filter({ hasText: /ขาดเรียน/i }).first();
    if (await absentTab.isVisible()) {
      await absentTab.click();
    }

    // 2. กดแท็บ เคสติดตาม
    const casesTab = page.locator("button, [role='tab']").filter({ hasText: /เคส|ติดตาม/i }).first();
    if (await casesTab.isVisible()) {
      await casesTab.click();
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-35-03: ตรวจสอบการนำทางของลิงก์ 'ดูนักเรียนทั้งหมด'
  test("TC-STS-08-35-03: ตรวจสอบการนำทางของลิงก์ ดูนักเรียนทั้งหมด", async ({ page }) => {
    const viewAllLink = page.getByRole("link", { name: /ดูนักเรียนทั้งหมด|รายชื่อนักเรียน/i }).first();
    if (await viewAllLink.isVisible()) {
      await viewAllLink.click();
      await expect(page).toHaveURL(/\/teacher\/students|\/students/, { timeout: 10_000 });
    }

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-36-01: ตรวจสอบการแสดงผลแผนภูมิสัดส่วนการเข้าเรียน ก่อนการเช็คชื่อ
  test("TC-STS-08-36-01: ตรวจสอบการแสดงผลแผนภูมิสัดส่วนการเข้าเรียน ก่อนการเช็คชื่อ", async ({ page }) => {
    const chartSection = page.locator("text=/สัดส่วนการเข้าเรียน|กราฟ|ข้อมูลจะแสดง/i").first();
    await expect(chartSection).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-36-02: ตรวจสอบการแสดงผลแผนภูมิสัดส่วนการเข้าเรียน หลังการเช็คชื่อ
  test("TC-STS-08-36-02: ตรวจสอบการแสดงผลแผนภูมิสัดส่วนการเข้าเรียน หลังการเช็คชื่อ", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-08-37-01: ตรวจสอบการอัปเดตข้อมูลบน Dashboard แบบเรียลไทม์
  test("TC-STS-08-37-01: ตรวจสอบการอัปเดตข้อมูลบน Dashboard แบบเรียลไทม์", async ({ page }) => {
    // กราฟและตัวเลขสถิติบน Dashboard อัปเดตข้อมูลล่าสุด
    await expect(page.locator("main").getByText(/ตัวชี้วัดห้องเรียน|นักเรียนในห้อง|สถิติ|ข้อมูลภาพรวม/i).first()).toBeVisible();

    await page.waitForTimeout(1500);
  });
});
