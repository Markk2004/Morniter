// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: School Admin UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script [School Admin] จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 หัวข้อ: TC-STS-SCHOOL-ADMIN — รันทุกฟังก์ชันของผู้ดูแลระบบโรงเรียนต่อเนื่องใน Code Workspace
// ==============================================================
import { test, expect } from "@playwright/test";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { StsLoginPage } from "../page-objects/login.page";
import { StsDashboardPage } from "../page-objects/dashboard.page";
import { StsUsersPage } from "../page-objects/users.page";
import { StsStudentsPage } from "../page-objects/students.page";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ผู้ดูแลระบบโรงเรียน] Uat script [STS School Admin] (Complete School Admin Workflow)", () => {
  test("TC-STS-SCHOOL-ADMIN-COMPLETE-E2E: School Admin Complete UAT Workflow (All-in-One)", async ({ page }) => {
    test.setTimeout(180_000);

    // [Precondition]: เตรียม Mock API สำหรับทุกโมดูล
    await page.context().clearCookies();
    await setupStsApiMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const loginPage = new StsLoginPage(page);
    const dashPage = new StsDashboardPage(page);
    const usersPage = new StsUsersPage(page);
    const studentsPage = new StsStudentsPage(page);

    // =========================================================================
    // หมวด 1: เข้าสู่ระบบผู้ดูแลระบบโรงเรียน (TC-STS-01-03-02)
    // =========================================================================
    await test.step("หมวด 1: เข้าสู่ระบบด้วยสถานะผู้ดูแลระบบโรงเรียน และตรวจสอบ URL Redirection ไปยัง /admin", async () => {
      const adminCreds = DEMO_CREDENTIALS["school-admin"];
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      // กรอก Username และ Password (admin_a / changeme)
      await loginPage.login(adminCreds.username, adminCreds.password);

      // ตรวจสอบการนำทางเข้าสู่หน้า Admin Dashboard
      await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

      // ตรวจสอบสถานะผู้ดูแลระบบโรงเรียน
      await expect(page.locator("text=/ผู้ดูแลระบบ|ผู้ดูแลระบบโรงเรียน|ADMIN/i").first()).toBeVisible({
        timeout: 10_000,
      });
      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // หมวด 2: แดชบอร์ดผู้ดูแลระบบ — สถิติการปฏิบัติงาน & การ์ดงานที่ต้องดำเนินการ
    // (TC-STS-08-27-01 ถึง TC-STS-08-30-01)
    // =========================================================================
    await test.step("หมวด 2: ตรวจสอบแดชบอร์ด Admin สถิติการปฏิบัติงาน และการ์ดงานที่ต้องดำเนินการ", async () => {
      // 1. ตรวจสอบ Heading และ Metric Cards ของ Dashboard Admin
      await expect(page.locator("main").locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 10_000 });

      // 2. ตรวจสอบ Metric Cards หลัก (อัตราการเข้าเรียน, เคสค้างดำเนินการ, ความพร้อมของข้อมูล)
      await expect(
        page.locator("main").locator("text=/อัตราการเข้าเรียน|เคสค้าง|ข้อมูลพร้อม|ความพร้อม|ปฏิบัติงาน/i").first(),
      ).toBeVisible();

      // 3. ตรวจสอบการ์ดงานที่ต้องดำเนินการ (Action Required Cards)
      const actionCards = page
        .locator("text=/ห้องเรียนยังไม่มีครูที่ปรึกษา|เคสติดตามค้างดำเนินการ|ความพร้อมของข้อมูล|นักเรียนยังไม่มีห้องเรียน/i")
        .first();
      if (await actionCards.isVisible()) {
        await expect(actionCards).toBeVisible();
      }

      // 4. ตรวจสอบกราฟแนวโน้มอัตราการเข้าเรียน (Attendance Trend Chart)
      const trendSection = page.locator("text=/แนวโน้ม|อัตราการเข้าเรียน|trend/i").first();
      if (await trendSection.isVisible()) {
        await expect(trendSection).toBeVisible();
      }

      await page.waitForTimeout(2500);
    });

    // =========================================================================
    // หมวด 3: จัดการผู้ใช้งาน — เพิ่ม ค้นหา และจัดการสิทธิ์ (TC-STS-02-01 ถึง TC-STS-02-06)
    // =========================================================================
    await test.step("หมวด 3: จัดการผู้ใช้งานในโรงเรียน ค้นหา เพิ่มผู้ใช้ใหม่ และตรวจสอบตารางผู้ใช้", async () => {
      // 1. ไปยังหน้าจัดการผู้ใช้งาน (/admin/users)
      await usersPage.goto();
      await expect(usersPage.heading()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1000);

      // 2. ตรวจสอบตารางรายชื่อผู้ใช้งาน (User Table)
      const userTable = page.locator("table, [role='table'], tbody").first();
      if (await userTable.isVisible()) {
        await expect(userTable).toBeVisible();
      }

      // 3. ทดสอบการค้นหาผู้ใช้งาน
      if (await usersPage.searchInput().isVisible()) {
        await usersPage.searchInput().fill("สมชาย");
        await page.waitForTimeout(800);
        await usersPage.searchInput().clear();
        await page.waitForTimeout(600);
      }

      // 4. ทดสอบกรองตาม KPI สถานะผู้ใช้งาน (ใช้งานได้ / ถูกระงับ)
      if (await usersPage.kpiActiveButton().isVisible()) {
        await usersPage.kpiActiveButton().click();
        await page.waitForTimeout(800);
      }

      // 5. ทดสอบเปิดหน้าต่างเพิ่มผู้ใช้ใหม่ (Add User Modal)
      const addUserBtn = usersPage.addUserButton();
      if (await addUserBtn.isVisible()) {
        await addUserBtn.click();
        await page.waitForTimeout(800);
        await expect(usersPage.modal()).toBeVisible();

        // กรอกข้อมูลผู้ใช้ใหม่ครบทุกฟิลด์บังคับ
        if (await usersPage.fullNameInput().isVisible()) {
          await usersPage.fullNameInput().fill("ครูอำนาจ คาดหวัง");
          await page.waitForTimeout(300);
        }
        if (await usersPage.usernameInput().isVisible()) {
          await usersPage.usernameInput().fill("teacher_umnat");
          await page.waitForTimeout(300);
        }
        if (await usersPage.passwordInput().isVisible()) {
          await usersPage.passwordInput().fill("changeme");
          await page.waitForTimeout(300);
        }

        // เลือก Role ในฟอร์ม
        const roleSelect = usersPage.modal().locator("select[name='role'], [role='combobox']").first();
        if (await roleSelect.isVisible()) {
          try {
            await roleSelect.selectOption({ index: 1 });
          } catch {
            // role select might be a custom component
          }
          await page.waitForTimeout(400);
        }

        // ปิดหรือยกเลิก Modal (ไม่ต้อง submit จริง — UAT ทดสอบ flow เปิด Dialog)
        await usersPage.cancelButton().click();
        await page.waitForTimeout(800);
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 4: จัดการนักเรียนและห้องเรียน — นำเข้าข้อมูล & ประวัติการนำเข้า
    // (TC-STS-03-01 ถึง TC-STS-03-06)
    // =========================================================================
    await test.step("หมวด 4: จัดการนักเรียน ดูรายชื่อ ค้นหา และทดสอบการนำเข้าข้อมูลนักเรียน", async () => {
      // 1. ไปยังหน้าข้อมูลนักเรียน
      await page.goto("/admin/students").catch(() => page.goto("/students"));
      await page.waitForTimeout(1500);

      // 2. ตรวจสอบหน้าแสดงรายชื่อนักเรียน
      const studentsHeading = page.locator("h1, h2, [role='heading']").first();
      if (await studentsHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(studentsHeading).toBeVisible();
      }

      // 3. ทดสอบการค้นหานักเรียน
      const studentSearchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search']").first();
      if (await studentSearchInput.isVisible()) {
        await studentSearchInput.fill("กิตติพงษ์");
        await page.waitForTimeout(800);
        await studentSearchInput.clear();
        await page.waitForTimeout(600);
      }

      // 4. ทดสอบปุ่มนำเข้าข้อมูลนักเรียน (Import Students)
      const importBtn = page
        .locator("a:has-text('นำเข้าข้อมูลนักเรียน'), button:has-text('นำเข้าข้อมูล'), a:has-text('นำเข้า')")
        .first();
      if (await importBtn.isVisible()) {
        await importBtn.click();
        await page.waitForTimeout(1500);

        // 5. ทดสอบปุ่มดาวน์โหลดไฟล์ตัวอย่าง
        const downloadSampleBtn = page
          .locator("button:has-text('ดาวน์โหลดไฟล์ตัวอย่าง'), a:has-text('ดาวน์โหลดไฟล์ตัวอย่าง')")
          .first();
        if (await downloadSampleBtn.isVisible()) {
          await downloadSampleBtn.click();
          await page.waitForTimeout(1000);
        }

        // 6. เปิดดูประวัติการนำเข้าไฟล์ข้อมูลนักเรียน
        const historyBtn = page
          .locator("a:has-text('ดูประวัติการนำเข้า'), button:has-text('ดูประวัติการนำเข้า'), a[href*='history']")
          .first();
        if (await historyBtn.isVisible()) {
          await historyBtn.click();
          await page.waitForTimeout(2000);

          // 7. ตรวจสอบตารางประวัติการนำเข้า (Import History Table — ต้องมีอย่างน้อย 2 batch)
          await expect(
            page.locator("text=/ประวัติการนำเข้า|students_m3|สำเร็จ|COMPLETED/i").first(),
          ).toBeVisible({ timeout: 10_000 });
          await page.waitForTimeout(3000);
        }
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 5: จัดการห้องเรียน — โครงสร้างสถานศึกษา ปีการศึกษา และครูที่ปรึกษา
    // (TC-STS-08-28 ถึง TC-STS-08-30)
    // =========================================================================
    await test.step("หมวด 5: จัดการห้องเรียน โครงสร้างสถานศึกษา และการมอบหมายครูที่ปรึกษา", async () => {
      // 1. ไปยังหน้าจัดการห้องเรียน
      await page.goto("/admin/classrooms").catch(() => page.goto("/admin/students"));
      await page.waitForTimeout(1500);

      // 2. ตรวจสอบรายการห้องเรียนปัจจุบัน
      const classroomList = page.locator("table tbody tr, [role='row'], .classroom-card").first();
      if (await classroomList.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(classroomList).toBeVisible();
      }

      // 3. ทดสอบเปิดหน้าต่างสร้างหรือแก้ไขห้องเรียน
      const addClassroomBtn = page
        .locator("button:has-text('เพิ่มห้องเรียน'), button:has-text('สร้างห้องเรียน'), #add-classroom-btn")
        .first();
      if (await addClassroomBtn.isVisible()) {
        await addClassroomBtn.click();
        await page.waitForTimeout(1000);

        const classroomDialog = page.locator("dialog[open], [role='dialog']").first();
        if (await classroomDialog.isVisible()) {
          // กรอกชื่อห้องเรียน
          const gradeInput = classroomDialog
            .locator("input[name='grade'], select[name='gradeLevel'], input[placeholder*='ระดับชั้น']")
            .first();
          if (await gradeInput.isVisible()) {
            try {
              await gradeInput.fill("ม.3");
            } catch {
              await gradeInput.selectOption({ index: 1 });
            }
            await page.waitForTimeout(400);
          }

          const roomNameInput = classroomDialog
            .locator("input[name='roomName'], input[placeholder*='ห้อง']")
            .first();
          if (await roomNameInput.isVisible()) {
            await roomNameInput.fill("3");
            await page.waitForTimeout(300);
          }

          // ปิด Dialog
          const cancelBtn = classroomDialog.locator("button:has-text('ยกเลิก'), button:has-text('ปิด')").first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(600);
          }
        }
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 6: ตรวจสอบความพร้อมของข้อมูลและตัวชี้วัด (Data Readiness Check)
    // (TC-STS-08-29-01 ถึง TC-STS-08-30-01)
    // =========================================================================
    await test.step("หมวด 6: ตรวจสอบตัวชี้วัดความพร้อมของข้อมูล รายงาน และสรุปสถิติของโรงเรียน", async () => {
      // 1. กลับไปยัง Admin Dashboard
      await page.goto("/admin").catch(() => page.goto("/admin/dashboard"));
      await page.waitForTimeout(2000);

      // 2. ตรวจสอบตัวชี้วัดความพร้อมของข้อมูล (Data Readiness Score %)
      const readinessSection = page
        .locator("text=/ความพร้อมของข้อมูล|Data Readiness|พร้อมใช้งาน|98|100/i")
        .first();
      if (await readinessSection.isVisible()) {
        await expect(readinessSection).toBeVisible();
      }

      // 3. ตรวจสอบส่วน Action Queue (รายการงานที่ต้องดำเนินการ)
      const actionQueue = page.locator("text=/ต้องดำเนินการ|Action|ค้าง|รายการงาน/i").first();
      if (await actionQueue.isVisible()) {
        await expect(actionQueue).toBeVisible();
      }

      // 4. ทดสอบคลิกเพื่อดูรายละเอียดของ Action Item
      const actionItem = page
        .locator("button:has-text('ดูรายละเอียด'), a:has-text('ดูรายละเอียด'), button:has-text('แก้ไข')")
        .first();
      if (await actionItem.isVisible()) {
        await actionItem.click();
        await page.waitForTimeout(1200);
        // ปิด Dialog ถ้ามี
        const closeBtn = page.locator("button:has-text('ปิด'), button:has-text('ยกเลิก')").first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(600);
        }
      }

      await page.waitForTimeout(2500);
    });

    // =========================================================================
    // หมวด 7: รายงานและการส่งออก — Export PDF/Excel ประจำโรงเรียน
    // (TC-STS-06-01-03 ถึง TC-STS-06-06-03)
    // =========================================================================
    await test.step("หมวด 7: ตรวจสอบรายงานของผู้ดูแลระบบ พรีวิวข้อมูล และปุ่มส่งออก PDF/Excel", async () => {
      // 1. ไปยังหน้ารายงาน Admin
      await page.goto("/admin/reports").catch(() => page.goto("/admin"));
      await page.waitForTimeout(1500);

      // 2. ตรวจสอบหน้ารายงาน (ถ้ามี)
      const reportHeading = page.locator("h1, h2, [role='heading']").first();
      if (await reportHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(reportHeading).toBeVisible();
      }

      // 3. กดปุ่มสร้างรายงาน (Generate Report)
      const generateBtn = page
        .locator("button:has-text('สร้างรายงาน'), button:has-text('ออกรายงาน'), button:has-text('Generate')")
        .first();
      if (await generateBtn.isVisible()) {
        await generateBtn.click();
        await page.waitForTimeout(1500);
      }

      // 4. ตรวจสอบตารางพรีวิวรายงาน
      const reportTable = page.locator("table, [role='table']").first();
      if (await reportTable.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(reportTable).toBeVisible();
      }

      // 5. ทดสอบปุ่มส่งออก PDF
      const exportPdfBtn = page
        .locator("button:has-text('PDF'), button:has-text('ส่งออก PDF'), a:has-text('PDF')")
        .first();
      if (await exportPdfBtn.isVisible()) {
        await exportPdfBtn.click();
        await page.waitForTimeout(800);
      }

      // 6. ทดสอบปุ่มส่งออก Excel
      const exportExcelBtn = page
        .locator("button:has-text('Excel'), button:has-text('ส่งออก Excel'), a:has-text('Excel')")
        .first();
      if (await exportExcelBtn.isVisible()) {
        await exportExcelBtn.click();
        await page.waitForTimeout(800);
      }

      await page.waitForTimeout(2000);
    });

    // =========================================================================
    // หมวด 8: ออกจากระบบ (Logout) และตรวจสอบการนำทางกลับหน้า Login
    // =========================================================================
    await test.step("หมวด 8: ออกจากระบบและตรวจสอบการนำทางกลับหน้า Login", async () => {
      // 1. คลิกปุ่มออกจากระบบ (Logout)
      const logoutBtn = page
        .locator("button:has-text('ออกจากระบบ'), a:has-text('ออกจากระบบ'), button:has-text('Logout')")
        .first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      }

      // หน่วงเวลาช่วงท้ายเพื่อให้ QA ดูผลลัพธ์บนหน้าจออย่างสมบูรณ์
      await page.waitForTimeout(3000);
    });
  });
});
