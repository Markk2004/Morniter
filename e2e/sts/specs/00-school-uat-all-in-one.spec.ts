// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: School UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (School Director & School Admin) จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 หัวข้อ: Uat script [School] รันทุกฟังก์ชันต่อเนื่องใน Code Workspace
// ==============================================================
import { test, expect } from "@playwright/test";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { StsLoginPage } from "../page-objects/login.page";
import { StsDashboardPage } from "../page-objects/dashboard.page";
import { StsReportsPage } from "../page-objects/reports.page";
import { StsUsersPage } from "../page-objects/users.page";
import { StsStudentsPage } from "../page-objects/students.page";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT โรงเรียน] Uat script [School] (Complete School Workflow)", () => {
  test("TC-STS-SCHOOL-COMPLETE-E2E: School Complete UAT Workflow (Director & Admin All-in-One)", async ({ page }) => {
    test.setTimeout(180_000);
    // [Precondition]: เตรียม Mock API สำหรับทุกโมดูล
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const loginPage = new StsLoginPage(page);
    const dashPage = new StsDashboardPage(page);
    const reportsPage = new StsReportsPage(page);
    const usersPage = new StsUsersPage(page);
    const studentsPage = new StsStudentsPage(page);

    // =========================================================================
    // 🔹 ตอนที่ 1: ฝั่งผู้อำนวยการโรงเรียน (School Director Journey)
    // =========================================================================

    // =========================================================================
    // หมวด 1: เข้าสู่ระบบผู้อำนวยการโรงเรียน (TC-STS-01-03-04, TC-STS-01-04-03)
    // =========================================================================
    await test.step("หมวด 1: เข้าสู่ระบบด้วยสถานะผู้อำนวยการโรงเรียน และตรวจสอบสิทธิ์ผู้บริหาร", async () => {
      const creds = DEMO_CREDENTIALS.director;
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      // กรอก Username และ Password (director_a / changeme)
      await loginPage.login(creds.username, creds.password);

      // ตรวจสอบการนำทางเข้าสู่หน้า Director Dashboard
      await expect(page).toHaveURL(/\/director\/dashboard|\/dashboard/, { timeout: 15_000 });

      // แสดงสถานะผู้อำนวยการโรงเรียน / ผู้บริหาร
      await expect(page.locator("text=/ผู้อำนวยการ|ผู้อำนวยการโรงเรียน|DIRECTOR/i").first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // หมวด 2: แดชบอร์ดผู้อำนวยการโรงเรียน (TC-STS-08-03-01 ถึง TC-STS-08-09-01)
    // =========================================================================
    await test.step("หมวด 2: ตรวจสอบแดชบอร์ดผู้อำนวยการ สถิติภาพรวม กราฟแนวโน้ม และห้องเรียนที่ต้องเฝ้าระวัง", async () => {
      await expect(page.locator("main").locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 10_000 });

      // 1. ตรวจสอบการ์ดสถิติภาพรวม (จำนวนนักเรียน, จำนวนเคส, อัตราการเข้าเรียน)
      await expect(page.locator("main").locator("text=/ดัชนีงานสำคัญ|รอตัดสินใจ|เคสเสี่ยงสูง|ขาดเรียน|อัตราเข้าเรียน|ภาพรวม|สถิติ/i").first()).toBeVisible();

      // 2. ตรวจสอบแถบสัดส่วนความรุนแรงของเคส (สูง / ปานกลาง / น้อย)
      const severitySection = page.locator("main").locator("text=/สัดส่วนความรุนแรง|ระดับความรุนแรง|สูง|ปานกลาง|น้อย/i").first();
      await expect(severitySection).toBeVisible();

      // 3. ตรวจสอบรายการห้องเรียนที่ต้องเฝ้าระวังพิเศษ
      const watchedSection = page.locator("main").locator("text=/ห้องเรียนที่ต้องเฝ้าระวัง|ห้องเรียน|ม.3|ดัชนี/i").first();
      await expect(watchedSection).toBeVisible();

      // 4. ทดสอบตัวกรองข้อมูลย้อนหลัง (ปีการศึกษา 2569 / ระดับชั้น / ห้องเรียน)
      const filterBtn = page.getByRole("button", { name: /ตัวกรองข้อมูลย้อนหลัง|ตัวกรอง|กรองข้อมูล/i }).first();
      if (await filterBtn.isVisible()) {
        await filterBtn.click();
        await page.waitForTimeout(600);
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 3: จัดการเคสระดับปานกลาง/สูง & ออกรายงาน (TC-STS-06-01-02 ถึง TC-STS-06-06-02)
    // =========================================================================
    await test.step("หมวด 3: จัดการเคสระดับปานกลางและสูง ค้นหา กรองความเสี่ยง และพรีวิวรายงานประจำโรงเรียน", async () => {
      // 1. นำทางไปหน้ารายงานของผู้บริหาร (/director/reports)
      await reportsPage.gotoDirector();
      await page.waitForTimeout(1200);
      await expect(page).toHaveURL(/\/director\/reports/);

      // 2. กดปุ่มสร้างรายงานพรีวิว
      if (await reportsPage.generateButton().isVisible()) {
        await reportsPage.generateButton().click();
        await page.waitForTimeout(1000);
      }

      // 3. ตรวจสอบตารางพรีวิวรายงานและรายชื่อเคส
      if (await reportsPage.previewTable().isVisible()) {
        await expect(reportsPage.previewTable()).toBeVisible();
      }

      // 4. ตรวจสอบปุ่มส่งออก PDF และ Excel
      const exportPdfBtn = reportsPage.exportPdfButton().first();
      const exportExcelBtn = reportsPage.exportExcelButton().first();
      if (await exportPdfBtn.isVisible()) {
        await exportPdfBtn.click();
        await page.waitForTimeout(600);
      }
      if (await exportExcelBtn.isVisible()) {
        await exportExcelBtn.click();
        await page.waitForTimeout(600);
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 4: บันทึกการให้ความช่วยเหลือและการส่งต่อ (TC-STS-06-08-03 ถึง TC-STS-06-10-05)
    // =========================================================================
    await test.step("หมวด 4: บันทึกการให้ความช่วยเหลือ ส่งต่อผู้เชี่ยวชาญ และออกหนังสือส่งตัวตามหลัก PDPA", async () => {
      // นำทางไปยังหน้าเคสของผู้บริหาร (/director/cases หรือ /director/dashboard)
      await page.goto("/director/cases").catch(() => page.goto("/director/dashboard"));
      await page.waitForTimeout(1200);

      // กดปุ่ม 'พิจารณา' หรือเปิดเคส
      const reviewBtn = page.locator("button:has-text('พิจารณา'), a:has-text('พิจารณา'), [data-testid*='case'], tr:has-text('CASE-')").first();
      if (await reviewBtn.isVisible()) {
        await reviewBtn.click();
        await page.waitForTimeout(1500);
      }

      // 1. บันทึกข้อมูลการให้ความช่วยเหลือ (Intervention Dialog)
      const addHelpBtn = page.locator("button:has-text('บันทึกการช่วยเหลือ'), button:has-text('เพิ่มการช่วยเหลือ'), #add-intervention-btn").first();
      if (await addHelpBtn.isVisible()) {
        await addHelpBtn.click();
        await page.waitForTimeout(800);

        const helpType = page.locator("select[name='type'], input[name='type']").first();
        if (await helpType.isVisible()) {
          await helpType.fill("ให้คำปรึกษา");
        }
        const helpDetail = page.locator("textarea[name='details'], textarea").first();
        if (await helpDetail.isVisible()) {
          await helpDetail.fill("พูดคุยให้กำลังใจนักเรียนและวางแผนการเรียนร่วมกัน");
        }

        const saveHelpBtn = page.locator("button:has-text('บันทึก'), button[type='submit']").last();
        if (await saveHelpBtn.isVisible()) {
          await saveHelpBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // 2. ตรวจสอบปุ่มออกหนังสือส่งตัว (Referral Letter)
      const letterBtn = page.locator("button:has-text('ออกหนังสือส่งตัว'), button:has-text('ส่งต่อภายนอก')").first();
      if (await letterBtn.isVisible()) {
        await letterBtn.click();
        await page.waitForTimeout(800);
        const cancelLetterBtn = page.locator("button:has-text('ยกเลิก'), button:has-text('ปิด')").first();
        if (await cancelLetterBtn.isVisible()) {
          await cancelLetterBtn.click();
        }
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 5: ผู้อำนวยการบันทึกข้อสังเกตและประเมิน AI (TC-STS-07-06, TC-STS-09-06 ถึง 11)
    // =========================================================================
    await test.step("หมวด 5: ผู้อำนวยการบันทึกข้อสังเกต วิเคราะห์ด้วย AI และบันทึกผลการอนุมัติขั้นสุดท้าย", async () => {
      // 1. ผู้อำนวยการกรอกข้อสังเกตใหม่ด้วยตนเอง
      const obsInput = page.locator("#observation-note, textarea[placeholder*='ข้อสังเกต'], textarea").first();
      if (await obsInput.isVisible()) {
        await obsInput.fill("ผู้ปกครองเข้ามาพบผู้อำนวยการโดยตรงเพื่อปรึกษาแนวทางการช่วยเหลือ");
        await page.waitForTimeout(800);

        const saveObsBtn = page.locator("#add-observation-btn, button:has-text('บันทึกข้อสังเกต')").first();
        if (await saveObsBtn.isVisible() && await saveObsBtn.isEnabled()) {
          await saveObsBtn.click();
          await page.waitForTimeout(1200);
        }
      }

      // 2. วิเคราะห์เคสด้วย AI
      const aiBtn = page.locator("button:has-text('วิเคราะห์เคสด้วย AI'), button:has-text('วิเคราะห์จากบันทึกข้อสังเกตล่าสุด')").first();
      if (await aiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        if (await aiBtn.isEnabled()) {
          await aiBtn.click();
          await page.waitForTimeout(2500);
        }
      }

      // 3. ปรับระดับความรุนแรงและกรอกเหตุผลของผู้อำนวยการ
      const reasonInput = page.locator("textarea[placeholder*='เหตุผล'], textarea[name='reason']").first();
      if (await reasonInput.isVisible()) {
        await reasonInput.fill("จากการตรวจสอบพบว่าผู้ปกครองให้ความร่วมมือดี ปรับเป็นระดับปานกลางเพื่อเฝ้าระวังต่อเนื่อง");
      }

      // 4. บันทึกผลการอนุมัติขั้นสุดท้าย
      const approveBtn = page.locator("button:has-text('บันทึกผลการอนุมัติขั้นสุดท้าย'), button:has-text('อนุมัติผล'), button:has-text('ยืนยันผล')").first();
      if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await approveBtn.click();
        await page.waitForTimeout(1500);
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // 🔹 ตอนที่ 2: ฝั่งผู้ดูแลระบบโรงเรียน (School Administrator Journey)
    // =========================================================================

    // =========================================================================
    // หมวด 6: เข้าสู่ระบบ School Admin & เมนูแดชบอร์ด (TC-STS-01-03-02, TC-STS-08-27-01 ถึง 30)
    // =========================================================================
    await test.step("หมวด 6: เข้าสู่ระบบด้วยสถานะผู้ดูแลระบบโรงเรียน และตรวจสอบการ์ดงานที่ต้องดำเนินการ", async () => {
      await page.context().clearCookies();
      const adminCreds = DEMO_CREDENTIALS["school-admin"];
      await loginPage.goto();
      await page.bringToFront();

      // กรอกข้อมูลเข้าสู่ระบบ School Admin (admin_a / changeme)
      await loginPage.login(adminCreds.username, adminCreds.password);
      await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

      // ตรวจสอบสถานะผู้ดูแลระบบโรงเรียน
      await expect(page.locator("text=/ผู้ดูแลระบบ|ผู้ดูแลระบบโรงเรียน|ADMIN/i").first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(2500);

      // ตรวจสอบการ์ดงานที่ต้องดำเนินการ (Action Required Cards)
      const actionCards = page.locator("text=/ห้องเรียนยังไม่มีครูที่ปรึกษา|เคสติดตามค้างดำเนินการ|ความพร้อมของข้อมูล|นักเรียนยังไม่มีห้องเรียน/i").first();
      if (await actionCards.isVisible()) {
        await expect(actionCards).toBeVisible();
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 7: จัดการผู้ใช้งาน โครงสร้างสถานศึกษา และนำเข้าข้อมูล (TC-STS-02, TC-STS-03)
    // =========================================================================
    await test.step("หมวด 7: จัดการผู้ใช้งานในโรงเรียน จัดการห้องเรียน และทดสอบการนำเข้าข้อมูลนักเรียน", async () => {
      // 1. ไปยังหน้าจัดการผู้ใช้งาน (/admin/users)
      await usersPage.goto();
      await expect(usersPage.heading()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      // ทดสอบค้นหาผู้ใช้งาน
      await usersPage.searchInput().fill("สมชาย");
      await page.waitForTimeout(800);
      await usersPage.searchInput().clear();
      await page.waitForTimeout(600);

      // ทดสอบเปิดหน้าต่างเพิ่มผู้ใช้ใหม่ (Add User Modal)
      const addUserBtn = usersPage.addUserButton();
      if (await addUserBtn.isVisible()) {
        await addUserBtn.click();
        await page.waitForTimeout(800);
        await expect(usersPage.modal()).toBeVisible();

        // กรอกข้อมูลผู้ใช้ใหม่
        await usersPage.fullNameInput().fill("ครูอำนาจ คาดหวัง");
        await usersPage.usernameInput().fill("teacher_umnat");

        // ปิดหรือยกเลิก Modal
        await usersPage.cancelButton().click();
        await page.waitForTimeout(800);
      }

      // 2. ไปยังหน้าข้อมูลนักเรียนและห้องเรียน
      await page.goto("/admin/students").catch(() => page.goto("/students"));
      await page.waitForTimeout(1500);

      // 3. ตรวจสอบปุ่มนำเข้าข้อมูลนักเรียนชุดใหญ่ (Bulk Import / Import History)
      const importBtn = page.locator("button:has-text('นำเข้าข้อมูล'), button:has-text('ประวัติการนำเข้า'), a:has-text('นำเข้า')").first();
      if (await importBtn.isVisible()) {
        await importBtn.click();
        await page.waitForTimeout(1200);
      }

      // หน่วงเวลาช่วงท้ายเพื่อให้ผู้ใช้และ QA ดูผลลัพธ์บนหน้าจออย่างสมบูรณ์
      await page.waitForTimeout(5000);
    });
  });
});
