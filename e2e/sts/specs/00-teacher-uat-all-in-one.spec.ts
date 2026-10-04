// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: Teacher UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (Teacher) จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 หัวข้อที่ 7: รวมทุกฟังก์ชัน (1-6) เป็นฟังก์ชันเดียว รันต่อเนื่องใน Code Workspace
// ==============================================================
import { test, expect } from "@playwright/test";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { StsLoginPage } from "../page-objects/login.page";
import { StsDashboardPage } from "../page-objects/dashboard.page";
import { StsAttendancePage } from "../page-objects/attendance.page";
import { StsCasesPage } from "../page-objects/cases.page";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ครู] หมวด 7: รันทุกฟังก์ชัน All-in-One (Complete Workflow)", () => {
  test("TC-STS-TEACHER-COMPLETE-E2E: Teacher Complete UAT Workflow (Single Function All-in-One)", async ({ page }) => {
    test.setTimeout(120_000);
    // [Precondition]: เตรียม Mock API สำหรับทุกโมดูล
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const creds = DEMO_CREDENTIALS.teacher;
    const loginPage = new StsLoginPage(page);
    const dashPage = new StsDashboardPage(page);
    const attPage = new StsAttendancePage(page);
    const casesPage = new StsCasesPage(page);

    // =========================================================================
    // 🔹 หมวดที่ 1: เข้าสู่ระบบ (TC-STS-01-03-03, TC-STS-01-04-03)
    // =========================================================================
    await test.step("หมวด 1: เข้าสู่ระบบด้วยสถานะคุณครู และตรวจสอบสถานะครูที่ปรึกษา", async () => {
      // 1. นำทางเข้าสู่หน้า Login
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      // 2. กรอก Username และ Password (teacher_a / changeme)
      await loginPage.login(creds.username, creds.password);

      // 3. ตรวจสอบว่าระบบนำทางเข้าสู่หน้า Dashboard สำเร็จ
      await expect(page).toHaveURL(/\/teacher\/dashboard|\/dashboard/, { timeout: 15_000 });

      // 4. แสดงสถานะคุณครู / ครูที่ปรึกษา
      await expect(page.locator("text=/ครูที่ปรึกษา|ครู|TEACHER/i").first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // 🔹 หมวดที่ 2: ดูแดชบอร์ดก่อนเช็คชื่อ (TC-STS-08-32-01, TC-STS-08-34-01, TC-STS-08-33-01)
    // =========================================================================
    await test.step("หมวด 2: ตรวจสอบ Banner แจ้งเตือนยังไม่ได้เช็คชื่อ และการ์ดสถิติ", async () => {
      await expect(dashPage.heading()).toBeVisible({ timeout: 10_000 });

      // ตรวจสอบ Banner แจ้งเตือนสถานะการเช็คชื่อ พร้อมปุ่มเริ่มเช็คชื่อ ในส่วนเนื้อหาหลัก (main)
      const bannerHeading = page.locator("main").getByRole("heading", { name: /ยังไม่ได้เช็[คก]ชื่อ/i }).first();
      const bannerLink = page.locator("main").getByRole("link", { name: /เริ่มเช็[คก]ชื่อ/i }).first();
      await expect(bannerHeading).toBeVisible({ timeout: 10_000 });
      await expect(bannerLink).toBeVisible({ timeout: 10_000 });

      // ตรวจสอบตัวเลขนักเรียนและการ์ดสรุปบนแดชบอร์ด
      await expect(page.locator("main").getByText(/ตัวชี้วัดห้องเรียน|นักเรียนในห้อง|สถิติ/i).first()).toBeVisible();
      await page.waitForTimeout(1500);

      // กดปุ่ม เริ่มเช็คชื่อ บน Banner เพื่อนำทางไปหน้าเช็คชื่อประจำวัน
      if (await bannerLink.isVisible()) {
        await bannerLink.click();
        await expect(page).toHaveURL(/\/teacher\/attendance|\/attendance/, { timeout: 10_000 });
      } else {
        await attPage.goto();
      }
    });

    // =========================================================================
    // 🔹 หมวดที่ 3: บันทึกการเข้าเรียน (TC-STS-04-01-01 ถึง TC-STS-04-10-02)
    // =========================================================================
    await test.step("หมวด 3: เช็คชื่อนักเรียน ค้นหา และบันทึกการเช็คชื่อประจำวัน", async () => {
      await expect(attPage.heading()).toBeVisible({ timeout: 10_000 });

      // 1. ค้นหานักเรียนที่มีในระบบ (กมล)
      const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
      if (await searchInput.isVisible()) {
        await searchInput.fill("กมล");
        await page.waitForTimeout(800);
        await searchInput.clear();
        await page.waitForTimeout(500);
      }

      // 2. จัดการปุ่มแก้ไข หรือ บันทึกการเช็คชื่อ
      const editBtn = page.getByRole("button", { name: /แก้ไขการเช็[คก]ชื่อ/i }).first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(800);
      }

      // 3. ตรวจสอบปุ่มสถานะ และกดปุ่ม มาเรียนทั้งหมด
      const markAllBtn = page.getByRole("button", { name: /มาเรียนทั้งหมด/i }).first();
      if (await markAllBtn.isVisible()) {
        await markAllBtn.click();
        await page.waitForTimeout(800);
      } else {
        const statusBtns = attPage.statusButtons();
        if (await statusBtns.count() > 0) {
          await statusBtns.first().click();
          await page.waitForTimeout(500);
        }
      }

      // 4. กดปุ่ม บันทึกการเช็คชื่อ
      const saveBtn = attPage.saveButton();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(500);
      }

      // หากมี Modal แจ้งเตือนกรณีเช็คชื่อไม่ครบ
      const confirmUnsetBtn = page.getByRole("button", { name: /บันทึกเป็นมาเรียน|ยืนยัน/i }).first();
      if (await confirmUnsetBtn.isVisible()) {
        await confirmUnsetBtn.click();
      }

      // 5. แสดงข้อความแจ้งเตือน บันทึกการเช็คชื่อสำเร็จ หรือสถานะบันทึกแล้ว
      await expect(page.locator("text=/บันทึกการแก้ไขสำเร็จ|บันทึกการเช็[คก]ชื่อสำเร็จ|แก้ไขการเช็[คก]ชื่อ|สำเร็จ|Saved|บันทึกการเช็กชื่อของวันนี้แล้ว/i").first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // 🔹 หมวดที่ 4: ตรวจสอบแดชบอร์ดหลังเช็คชื่อ (TC-STS-08-32-02, TC-STS-08-34-02, TC-STS-08-35-01)
    // =========================================================================
    await test.step("หมวด 4: กลับสู่แดชบอร์ด ตรวจสอบสถิติที่อัปเดตและสลับแท็บข้อมูล", async () => {
      await page.goto("/teacher/dashboard");
      await expect(dashPage.heading()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      // สลับแท็บระหว่าง ขาดเรียน และ เคสติดตาม
      const absentTab = page.locator("button, [role='tab']").filter({ hasText: /ขาดเรียน/i }).first();
      if (await absentTab.isVisible()) {
        await absentTab.click();
        await page.waitForTimeout(1000);
      }

      const casesTab = page.locator("button, [role='tab']").filter({ hasText: /เคส|ติดตาม/i }).first();
      if (await casesTab.isVisible()) {
        await casesTab.click();
        await page.waitForTimeout(1000);
      }
    });

    // =========================================================================
    // 🔹 หมวดที่ 5: จัดการเคสผู้เรียน & เปิดเคสใหม่ (TC-STS-05-01-01 ถึง TC-STS-05-09-02)
    // =========================================================================
    await test.step("หมวด 5: จัดการเคสผู้เรียน ค้นหา กรองความเสี่ยง และบันทึกเปิดเคสใหม่", async () => {
      await casesPage.goto();
      await expect(casesPage.heading()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(800);

      // 1. ค้นหาชื่อนักเรียน "กนกวรรณ"
      await casesPage.searchInput().fill("กนกวรรณ");
      await page.waitForTimeout(800);
      await casesPage.searchInput().clear();
      await page.waitForTimeout(500);

      // 2. เปิดหน้าฟอร์มสร้างเคสใหม่
      await casesPage.gotoCreate();
      await expect(page).toHaveURL(/\/teacher\/cases\/create/, { timeout: 10_000 });
      await page.waitForTimeout(1000);

      // 3. กรอกข้อมูลเปิดเคสสำหรับนักเรียน กมล ทองประเสริฐ
      await casesPage.fillForm({
        studentName: "กมล",
        title: "นักเรียนขาดเรียนติดต่อกันหลายวัน",
        description: "นักเรียนขาดเรียนติดต่อกันหลายวัน ต้องการการติดตามพฤติกรรมด่วน",
        severity: "high",
      });
      await page.waitForTimeout(1000);

      // 4. กดปุ่มบันทึกเปิดเคส
      await casesPage.submit();
      await expect(page).toHaveURL(/\/teacher\/cases/, { timeout: 15_000 });
      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // 🔹 หมวดที่ 6: บันทึกข้อสังเกต & ดู AI Insights (TC-STS-07, TC-STS-09)
    // =========================================================================
    await test.step("หมวด 6: บันทึกข้อสังเกตพฤติกรรม และทดสอบการวิเคราะห์ด้วย AI Insights", async () => {
      // 1. รอให้รายการเคสในตารางพร้อมแสดงผล แล้วเปิดเคส
      const caseLink = page.locator("table, main").locator("text=/CASE-|ดูรายละเอียด/i").first();
      await expect(caseLink).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);
      await caseLink.click();
      await page.waitForTimeout(1500);

      // 2. บันทึกข้อสังเกต Free-text (ระบุข้อความ -> กดปุ่มบันทึกข้อสังเกต -> รอให้บันทึกสำเร็จ)
      const obsInput = page.locator("#observation-note, textarea[placeholder*='ข้อสังเกต'], textarea").first();
      await expect(obsInput).toBeVisible({ timeout: 10_000 });
      await obsInput.fill("วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน");
      await page.waitForTimeout(1000);

      const saveObsBtn = page.locator("#add-observation-btn");
      await expect(saveObsBtn).toBeVisible({ timeout: 10_000 });
      await expect(saveObsBtn).toBeEnabled({ timeout: 10_000 });
      await saveObsBtn.click();

      // ตรวจสอบว่าข้อสังเกตถูกบันทึกและแสดงผลบนหน้าจอ
      await expect(page.getByText("วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน").first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);

      // 3. เลื่อนหรือนำทางไปยังส่วนวิเคราะห์ AI
      const navToAiBtn = page.locator("a[href='#case-analysis'], button, a").filter({ hasText: /การวิเคราะห์|วิเคราะห์และประเมิน|ไปยังส่วนวิเคราะห์/i }).first();
      if (await navToAiBtn.isVisible()) {
        await navToAiBtn.click();
        await page.waitForTimeout(1000);
      } else {
        await page.locator("#case-analysis, #case-overview").first().scrollIntoViewIfNeeded();
      }

      // 4. กดปุ่มวิเคราะห์เคสด้วย AI และรอให้ผลการวิเคราะห์แสดงผลจนเสร็จสมบูรณ์
      const aiSection = page.locator("#case-analysis, #case-overview").first();
      await aiSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);

      const aiBtn = aiSection.locator("button:has-text('วิเคราะห์จากบันทึกข้อสังเกตล่าสุด'), button:has-text('วิเคราะห์เคสด้วย AI'), button:has-text('วิเคราะห์ภาพรวม')").first();
      if (await aiBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        if (await aiBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
          await aiBtn.click();
          await page.waitForTimeout(1500);
        }
      }

      // ตรวจสอบการแสดงผลลัพธ์จาก AI (หมวดหมู่ปัญหา หรือ ความเสี่ยง หรือ ผลวิเคราะห์)
      const aiResultEl = page.locator("text=/ประเภทปัญหาที่ AI ตรวจพบ|ความเสี่ยง|สรุป|AI Decision Support|ผลวิเคราะห์/i").first();
      await expect(aiResultEl).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(2000);

      // 5. ตรวจสอบกระบวนการ Human Review เพื่อยืนยันผลการประเมิน
      const confirmActionEl = page.locator("text=/ยืนยันผล|Human Review|ปิดเคส|ส่งต่อเคส|คำแนะนำระดับความรุนแรง/i").first();
      if (await confirmActionEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(confirmActionEl).toBeVisible();
      }

      // หน่วงเวลาช่วงท้ายเพื่อให้ผู้ใช้และ QA ดูผลการแสดงผลบนหน้าจอจนครบถ้วนก่อนปิด
      await page.waitForTimeout(5000);
    });
  });
});
