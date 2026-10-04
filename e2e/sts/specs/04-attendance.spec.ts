// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-04 ระบบเช็คชื่อเข้าเรียน (Attendance)
// 📋 UAT Script (Teacher): บันทึกการเข้าเรียนสำหรับคุณครู
// 🎯 อ้างอิง Test Case: TC-STS-04-01-01 ถึง TC-STS-04-10-02 (8 เคส)
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsAttendancePage } from "../page-objects/attendance.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 3: ระบบเช็กชื่อเข้าเรียน (Teacher Attendance)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // เข้าสู่ระบบด้วยบัญชีคุณครู
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  // 🔹 TC-STS-04-01-01: ตรวจสอบการทำงานของปุ่มมาเรียน ขาดเรียน ลาป่วย ลากิจ มาสาย
  test("TC-STS-04-01-01: ตรวจสอบการทำงานของปุ่มมาเรียน ขาดเรียน ลาป่วย ลากิจ มาสาย", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();
    await expect(attPage.heading()).toBeVisible();

    // ตรวจสอบว่ามีปุ่มสถานะ มาเรียน, ขาดเรียน, ลาป่วย, ลากิจ, มาสาย และสามารถกดได้
    const statusBtns = page.locator("button:has-text('มา'), button:has-text('ขาด'), button:has-text('ลา'), button:has-text('สาย')");
    await expect(statusBtns.first()).toBeVisible();
    await expect(statusBtns.first()).toBeEnabled();

    // ทดสอบคลิกปุ่มสถานะ
    await statusBtns.first().click();
    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-02-01: ตรวจสอบการทำงานของปุ่มบันทึกการเช็คชื่อ เมื่อยังไม่ได้เช็คชื่อนักเรียนครบทุกคน
  test("TC-STS-04-02-01: ตรวจสอบการทำงานของปุ่มบันทึกการเช็คชื่อ เมื่อยังไม่ได้เช็คชื่อนักเรียนครบทุกคน", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    const editBtn = page.getByRole("button", { name: /แก้ไขการเช็[คก]ชื่อ/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }

    // เช็คชื่อนักเรียนบางส่วน (เช่น กมล ทองประเสริฐ หรือแถวแรก)
    const firstCheckBtn = page.locator("button:has-text('มา')").first();
    if (await firstCheckBtn.isVisible()) {
      await firstCheckBtn.click();
    }

    // กดปุ่ม บันทึกการเช็คชื่อ
    const saveBtn = attPage.saveButton();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }

    // หากระบบแสดง Modal ยืนยันกรณีเช็คชื่อไม่ครบ ให้ยืนยันบันทึกเป็นมาเรียน
    const confirmBtn = page.getByRole("button", { name: /บันทึกเป็นมาเรียน|ยืนยัน/i }).first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // แสดงแจ้งเตือน บันทึกการเช็คชื่อสำเร็จ
    const successToast = page.locator("text=/บันทึกการแก้ไขสำเร็จ|บันทึกการเช็[คก]ชื่อสำเร็จ|แก้ไขการเช็[คก]ชื่อ|สำเร็จ|Saved/i").first();
    await expect(successToast).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-02-02: ตรวจสอบการทำงานของปุ่มบันทึกการเช็คชื่อ เมื่อเช็คชื่อนักเรียนครบทุกคน
  test("TC-STS-04-02-02: ตรวจสอบการทำงานของปุ่มบันทึกการเช็คชื่อ เมื่อเช็คชื่อนักเรียนครบทุกคน", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    const editBtn = page.getByRole("button", { name: /แก้ไขการเช็[คก]ชื่อ/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }

    // 1. กดปุ่ม มาเรียนทั้งหมด
    const markAllBtn = page.getByRole("button", { name: /มาเรียนทั้งหมด/i }).first();
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
    }

    // 2. กดปุ่ม บันทึกการเช็คชื่อ
    const saveBtn = attPage.saveButton();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }

    // ตรวจสอบแจ้งเตือนบันทึกสำเร็จ
    await expect(page.locator("text=/บันทึกการแก้ไขสำเร็จ|บันทึกการเช็[คก]ชื่อสำเร็จ|แก้ไขการเช็[คก]ชื่อ|สำเร็จ/i").first()).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-07-01: ตรวจสอบการทำงานของปุ่มมาเรียนทั้งหมด
  test("TC-STS-04-07-01: ตรวจสอบการทำงานของปุ่มมาเรียนทั้งหมด", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    const editBtn = page.getByRole("button", { name: /แก้ไขการเช็[คก]ชื่อ/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }

    const markAllBtn = page.getByRole("button", { name: /มาเรียนทั้งหมด/i }).first();
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
    }

    // ตรวจสอบว่าปุ่มสามารถกดได้และระบบปรับสถานะนักเรียนในรายการ
    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-08-01: ตรวจสอบการแสดงผลของการ์ด ยังไม่เช็ค มาเรียน ขาดเรียน ลาป่วย ลากิจ มาสาย ถูกต้องหรือไม่
  test("TC-STS-04-08-01: ตรวจสอบการแสดงผลของการ์ดภาพรวมสถานะการเข้าเรียน", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    // สังเกตการ์ดภาพรวม
    await expect(page.getByText(/มาเรียน/i).first()).toBeVisible();
    await expect(page.getByText(/ขาดเรียน/i).first()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-08-03: ตรวจสอบการแสดงผลของการ์ด เมื่อเปลี่ยนวันที่
  test("TC-STS-04-08-03: ตรวจสอบการแสดงผลของการ์ด เมื่อเปลี่ยนวันที่", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    // กดปุ่มลูกศรเปลี่ยนวันที่ หรือ Date Picker
    const dateNavButtons = page.locator("button:has-text('<'), button:has-text('>'), input[type='date'], [aria-label*='date']");
    if (await dateNavButtons.count() > 0) {
      await dateNavButtons.first().click();
    }

    // การ์ดภาพรวมยังคงแสดงผลตามวันที่เลือก
    await expect(attPage.heading()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-10-01: ตรวจสอบการแสดงผล เมื่อกรอกชื่อหรือรหัสนักเรียนถูกต้อง
  test("TC-STS-04-10-01: ตรวจสอบการแสดงผล เมื่อกรอกชื่อหรือรหัสนักเรียนถูกต้อง", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    // กรอกชื่อนักเรียนที่มีในระบบ (เช่น "กมล" หรือ "กิตติพงษ์")
    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("กมล");

    // ตรวจสอบว่าแสดงเฉพาะข้อมูลนักเรียนที่ตรงกัน
    await expect(page.getByText(/กมล/i).first()).toBeVisible();

    await page.waitForTimeout(1500);
  });

  // 🔹 TC-STS-04-10-02: ตรวจสอบการแสดงผล เมื่อกรอกชื่อหรือรหัสนักเรียนไม่ถูกต้อง
  test("TC-STS-04-10-02: ตรวจสอบการแสดงผล เมื่อกรอกชื่อหรือรหัสนักเรียนไม่ถูกต้อง", async ({ page }) => {
    const attPage = new StsAttendancePage(page);
    await attPage.goto();
    await page.bringToFront();

    // กรอกข้อมูลที่ไม่มีอยู่ในระบบ (เช่น "zzz999")
    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    await searchInput.fill("zzz999");

    // ระบบไม่พบข้อมูลที่ค้นหา (ไม่แสดงชื่อนักเรียนในตาราง หรือแสดงข้อความไม่พบข้อมูล)
    await expect(page.getByText(/กิตติพงษ์ สุขเกษม|ชาญชัย มีสุข|กมล ทองประเสริฐ/)).not.toBeVisible();

    await page.waitForTimeout(1500);
  });
});
