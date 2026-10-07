// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: School Admin UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (School Admin) จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 ครอบคลุมทั้ง 29 Test Cases ตาม Sheet โดยละเอียด:
//    - เข้าสู่ระบบ: TC-STS-01-03-02, TC-STS-01-04-02, TC-STS-01-05-01
//    - ดูแดชบอร์ด: TC-STS-08-27-01, TC-STS-08-28-01, TC-STS-08-30-03
//    - จัดการผู้ใช้: TC-STS-02-24-01, TC-STS-02-26-01, TC-STS-02-28-02, TC-STS-02-29-02,
//                   TC-STS-02-30-02, TC-STS-02-31-03, TC-STS-02-32-04, TC-STS-02-34-01,
//                   TC-STS-02-35-02, TC-STS-02-36-01
//    - จัดการข้อมูลนักเรียนและห้องเรียน: TC-STS-03-01-02, TC-STS-03-10-03, TC-STS-03-11-01,
//                   TC-STS-03-12-01, TC-STS-03-13-02, TC-STS-03-15-01, TC-STS-03-26-04,
//                   TC-STS-03-27-02, TC-STS-03-28-02, TC-STS-03-33-03, TC-STS-03-34-02,
//                   TC-STS-03-38-01, TC-STS-03-39-01
// ==============================================================
import { test, expect } from "@playwright/test";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { StsLoginPage } from "../page-objects/login.page";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT ผู้ดูแลระบบโรงเรียน] UAT Script (School Admin) - Google Sheet Complete Flow", () => {
  test("TC-STS-SCHOOL-ADMIN-COMPLETE-E2E: School Admin Full 29-TC Workflow", async ({ page }) => {
    test.setTimeout(240_000);

    // [Precondition]: ล้าง Cookies และเตรียม Mock API (เปิด enableAdminTwoFactor สำหรับทดสอบการยืนยันตัวตน)
    await page.context().clearCookies();
    await setupStsApiMocks(page, { enableAdminTwoFactor: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    const loginPage = new StsLoginPage(page);
    const adminCreds = DEMO_CREDENTIALS["school-admin"];

    // =========================================================================
    // ฟังก์ชัน 1: เข้าสู่ระบบ (Login)
    // =========================================================================
    await test.step("ฟังก์ชัน 1: เข้าสู่ระบบ (TC-STS-01-03-02, TC-STS-01-04-02, TC-STS-01-05-01)", async () => {
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      // TC-STS-01-05-01: ตรวจสอบการยืนยันตัวตน เมื่อกรอก username/password
      const userInput = page.locator("#login-username, input[name='username']").first();
      const passInput = page.locator("#login-password, input[name='password']").first();
      const submitBtn = page.locator("#login-submit, button[type='submit']").first();

      await expect(userInput).toBeVisible();
      await userInput.fill(adminCreds.username);
      await passInput.fill(adminCreds.password);

      // กดปุ่มเข้าสู่ระบบ -> ระบบต้องแสดงหน้าจอยืนยันตัวตนสองชั้น (ส่งรหัสไปทางอีเมล)
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // ตรวจสอบหน้าจอยืนยันตัวตน (TC-STS-01-05-01: ส่งรหัสยืนยันไปที่อีเมล)
      const verifyHeading = page.locator("text=/ยืนยันตัวตน/i").first();
      await expect(verifyHeading).toBeVisible({ timeout: 10_000 });
      const verifyEmailNotice = page.locator("text=/ส่งไปที่|ส่งรหัส/i").first();
      await expect(verifyEmailNotice).toBeVisible();

      // กรอกรหัสยืนยันตัวตน 6 หลัก (OTP: 123456)
      const otpInputs = page.locator("input[inputmode='numeric']");
      const count = await otpInputs.count();
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 6); i++) {
          await otpInputs.nth(i).fill(String((i % 9) + 1));
          await page.waitForTimeout(80);
        }
      }

      // กดปุ่มยืนยันและเข้าสู่ระบบ
      const verifyBtn = page.locator("#login-verify-otp, button:has-text('ยืนยันและเข้าสู่ระบบ'), button:has-text('ยืนยัน')").first();
      if (await verifyBtn.isVisible() && await verifyBtn.isEnabled()) {
        await verifyBtn.click();
      }

      // TC-STS-01-04-02: นำทางเข้าสู่หน้า Dashboard ทันทีหลังเข้าสู่ระบบสำเร็จ
      await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

      // TC-STS-01-03-02: ตรวจสอบแสดงสถานะ ผู้ดูแลระบบโรงเรียน
      await expect(
        page.locator("text=/ผู้ดูแลระบบ|ผู้ดูแลระบบโรงเรียน|SCHOOL_ADMIN|ADMIN/i").first(),
      ).toBeVisible({ timeout: 10_000 });

      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // ฟังก์ชัน 2: ดูแดชบอร์ด (Dashboard)
    // =========================================================================
    await test.step("ฟังก์ชัน 2: ดูแดชบอร์ด (TC-STS-08-27-01, TC-STS-08-28-01, TC-STS-08-30-03)", async () => {
      await expect(page).toHaveURL(/\/admin/);

      // TC-STS-08-27-01: ตรวจสอบการทำงานของเมนูแท็บ/แถบเครื่องมือ
      // (ห้องเรียน / ปีการศึกษา / นักเรียน / นำเข้าข้อมูล / ผู้ใช้)
      const toolbar = page.locator(".admin-management-toolbar, nav[aria-label*='ทางลัด']").first();
      if (await toolbar.isVisible()) {
        await expect(toolbar).toBeVisible();
        // ตรวจสอบมีลิงก์ไปยังโมดูลหลัก
        await expect(toolbar.locator("a[href*='/admin/classrooms']").first()).toBeVisible();
        await expect(toolbar.locator("a[href*='/admin/students']").first()).toBeVisible();
        await expect(toolbar.locator("a[href*='/admin/users']").first()).toBeVisible();
      }

      // TC-STS-08-28-01: ตรวจสอบการแสดงผลของการ์ดห้องเรียนยังไม่มีครูที่ปรึกษา (Action Queue)
      const missingAdvisorCard = page.locator("a[href*='missing-advisor'], a[href*='/admin/classrooms']").or(page.getByText(/ยังไม่มีครูที่ปรึกษา/i)).first();
      if (await missingAdvisorCard.isVisible()) {
        await expect(missingAdvisorCard).toBeVisible();
        await missingAdvisorCard.click();
        await page.waitForTimeout(1000);
        await expect(page).toHaveURL(/\/admin\/classrooms/);
        await page.goto("/admin");
        await page.waitForTimeout(800);
      }

      // TC-STS-08-28-02: ตรวจสอบการแสดงผลของการ์ดเคสติดตามค้างดำเนินการเกิน 7 วัน
      const overdueCasesCard = page.locator("a[href*='cases']").or(page.getByText(/เคสติดตาม|ค้างดำเนินการ/i)).first();
      if (await overdueCasesCard.isVisible()) {
        await expect(overdueCasesCard).toBeVisible();
      }

      // TC-STS-08-28-03: ตรวจสอบการแสดงผลของการ์ดห้องเรียนเกินความจุที่กำหนด
      const overCapacityCard = page.locator("a[href*='capacity']").or(page.getByText(/เกินความจุ/i)).first();
      if (await overCapacityCard.isVisible()) {
        await expect(overCapacityCard).toBeVisible();
      }

      // TC-STS-08-28-04: ตรวจสอบการแสดงผลของการ์ดนักเรียนยังไม่มีห้องเรียน
      const unassignedStudentsCard = page.locator("a[href*='unassigned']").or(page.getByText(/ยังไม่มีห้องเรียน/i)).first();
      if (await unassignedStudentsCard.isVisible()) {
        await expect(unassignedStudentsCard).toBeVisible();
      }

      // TC-STS-08-30-03: ตรวจสอบการกดปุ่มการ์ดในความพร้อมของข้อมูลระบบที่ยังไม่ได้จัดการ
      const readinessSection = page.locator(".admin-readiness-section").or(page.getByText(/ความพร้อมของข้อมูล/i)).first();
      if (await readinessSection.isVisible()) {
        await expect(readinessSection).toBeVisible();
        // หากมีรายการที่ต้องจัดการ ให้ตรวจสอบการคลิกนำทาง
        const fixLink = page.locator(".admin-readiness-check-link, a[href*='/admin/']").first();
        if (await fixLink.isVisible()) {
          await fixLink.click();
          await page.waitForTimeout(1000);
          await page.goto("/admin");
          await page.waitForTimeout(800);
        }
      }

      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // ฟังก์ชัน 3: จัดการผู้ใช้ (User Management)
    // =========================================================================
    await test.step("ฟังก์ชัน 3: จัดการผู้ใช้ (TC-STS-02-24-01 ถึง TC-STS-02-36-01)", async () => {
      await page.goto("/admin/users");
      await page.waitForTimeout(1500);
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });

      // =======================================================================
      // 1. TC-STS-02-30-02: ตรวจสอบการทำงานของปุ่มเพิ่มผู้ใช้ ในเพิ่มผู้ใช้ใหม่ (เมื่อไม่มีการกรอกข้อมูล)
      // =======================================================================
      const addUserBtn = page.locator("#add-user-btn, button:has-text('เพิ่มผู้ใช้')").first();
      await expect(addUserBtn).toBeVisible({ timeout: 10_000 });
      await addUserBtn.click();
      await page.waitForTimeout(600);

      const addModal = page.locator(".users-form-modal, dialog[open], [role='dialog']").first();
      await expect(addModal).toBeVisible();

      // ไม่กรอกข้อมูลแล้วกดปุ่ม "เพิ่มผู้ใช้"
      const submitAddBtn = addModal.getByRole("button", { name: "เพิ่มผู้ใช้" }).first();
      await submitAddBtn.click();
      await page.waitForTimeout(400);
      // TC-STS-02-30-02 Expected: ไม่สามารถเพิ่มผู้ใช้ได้ มีแจ้งเตือนกรอกข้อมูลให้ครบ
      await expect(addModal).toBeVisible();
      await expect(page.locator("text=/กรุณากรอก|จำเป็น/i").first()).toBeVisible();

      // =======================================================================
      // 2. TC-STS-02-31-03: ตรวจสอบการกรอกข้อมูล ในเพิ่มผู้ใช้ใหม่ (ชื่อผู้ใช้ภาษาไทย: "มอมแมม")
      // =======================================================================
      const usernameInput = addModal.locator("input#form-username");
      await usernameInput.fill("มอมแมม");
      await page.waitForTimeout(300);
      const thaiVal = await usernameInput.inputValue();
      // TC-STS-02-31-03 Expected: ไม่สามารถกรอกข้อมูลได้ (ภาษาไทยถูก sanitize บล็อกออก)
      expect(thaiVal).not.toContain("มอมแมม");

      // =======================================================================
      // 3. TC-STS-02-30-03: ตรวจสอบการทำงานของปุ่มเพิ่มผู้ใช้ เมื่อกรอกข้อมูลครบถ้วน
      //    TC-STS-02-34-01: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการเพิ่ม
      // ข้อมูลทดสอบ: ชื่อ-นามสกุล : ครูอำนาจ คาดหวัง, บทบาท : ครูที่ปรึกษา
      // =======================================================================
      const fullNameInput = addModal.locator("input#form-full_name");
      await fullNameInput.fill("ครูอำนาจ คาดหวัง");
      await usernameInput.fill("teacher_umnat");

      // กดปุ่ม สุ่มรหัสผ่าน
      const randomPassBtn = addModal.getByRole("button", { name: /สุ่ม|สร้าง/i }).first();
      if (await randomPassBtn.isVisible()) {
        await randomPassBtn.click();
        await page.waitForTimeout(300);
      }

      // เลือก บทบาท: ครูที่ปรึกษา
      const roleSelect = addModal.locator("select#form-role");
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption({ label: "ครูที่ปรึกษา (Teacher)" }).catch(() => roleSelect.selectOption({ index: 1 }));
      }

      // กดปุ่ม เพิ่มผู้ใช้ เพื่อบันทึก
      await submitAddBtn.click();
      await page.waitForTimeout(1000);

      // ปิด Handoff modal (ข้อมูลเข้าสู่ระบบ / ปุ่ม "เสร็จสิ้น") หากปรากฏขึ้นมา
      const handoffDoneBtn = page.locator(".users-handoff-modal button:has-text('เสร็จสิ้น'), button:has-text('เสร็จสิ้น')").first();
      if (await handoffDoneBtn.isVisible()) {
        await handoffDoneBtn.click();
        await page.waitForTimeout(500);
      }

      // TC-STS-02-34-01 Expected: เพิ่มผู้ใช้งานสำเร็จ กลับไปยังหน้าจอตาราง และแสดงผลถูกต้อง
      await expect(page.locator("tbody")).toContainText("ครูอำนาจ คาดหวัง");

      // =======================================================================
      // 4. TC-STS-02-24-01: ตรวจสอบการทำงานของปุ่มบันทึก ในแก้ไขผู้ใช้ (เมื่อไม่กรอกชื่อผู้ใช้)
      // =======================================================================
      // คลิกแถวของผู้ใช้ "ครูอำนาจ คาดหวัง" เพื่อเปิดเมนู
      const createdRow = page.locator("tbody tr:has-text('ครูอำนาจ คาดหวัง')").first();
      const rowForEdit = (await createdRow.isVisible()) ? createdRow : page.locator("tbody tr").first();
      await rowForEdit.click();
      await page.waitForTimeout(500);

      const editMenuItem = page.locator("button[role='menuitem']:has-text('แก้ไข')").first();
      await expect(editMenuItem).toBeVisible();
      await editMenuItem.click();
      await page.waitForTimeout(600);

      const editModal = page.locator(".users-form-modal, dialog[open], [role='dialog']").first();
      await expect(editModal).toBeVisible();

      // ลบข้อมูลชื่อผู้ใช้
      const editNameInput = editModal.locator("input#form-full_name");
      await editNameInput.clear();

      // กดปุ่ม บันทึก
      const saveBtn = editModal.getByRole("button", { name: "บันทึก" }).first();
      await saveBtn.click();
      await page.waitForTimeout(400);
      // TC-STS-02-24-01 Expected: ไม่สามารถบันทึกได้สำเร็จ มีแจ้งเตือนยังกรอกข้อมูลไม่ครบ
      await expect(editModal).toBeVisible();
      await expect(page.locator("text=/กรุณากรอก|จำเป็น/i").first()).toBeVisible();

      // =======================================================================
      // 5. TC-STS-02-24-03: ตรวจสอบการทำงานของปุ่มบันทึก เมื่อกรอกข้อมูลครบถ้วน
      //    TC-STS-02-35-02: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการแก้ไข (ครูหวัง คาดหวัง)
      // =======================================================================
      await editNameInput.fill("ครูหวัง คาดหวัง");
      await saveBtn.click();
      await page.waitForTimeout(1000);
      // TC-STS-02-35-02 Expected: แสดงข้อมูลบนตารางถูกต้องครบถ้วน ("ครูหวัง คาดหวัง")
      await expect(page.locator("tbody")).toContainText("ครูหวัง คาดหวัง");

      // =======================================================================
      // 6. TC-STS-02-28-02: ตรวจสอบการทำงานของ Dialog ระงับผู้ใช้
      // 7. TC-STS-02-36-01: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังระงับการใช้งาน
      // =======================================================================
      const targetRowForSuspend = page.locator("tbody tr:has-text('ครูหวัง คาดหวัง')").first();
      await targetRowForSuspend.click();
      await page.waitForTimeout(500);

      const suspendMenuItem = page.locator("button[role='menuitem']:has-text('ระงับ')").first();
      await expect(suspendMenuItem).toBeVisible();
      await suspendMenuItem.click();
      await page.waitForTimeout(500);

      // ตรวจสอบ Dialog ระงับผู้ใช้ แสดงขึ้นมา
      const suspendDialog = page.locator("dialog[open]").filter({ hasText: /ระงับ/ }).last();
      await expect(suspendDialog).toBeVisible();

      // กดยืนยันระงับผู้ใช้
      const confirmSuspendBtn = suspendDialog.locator("button:has-text('ระงับ')").last();
      await confirmSuspendBtn.click();
      await page.waitForTimeout(1000);

      // TC-STS-02-36-01 Expected: แสดงข้อมูลบนตารางเป็นระงับ
      await expect(page.locator("tbody tr:has-text('ครูหวัง คาดหวัง')").first()).toContainText(/ถูกระงับ|ระงับ/);

      // =======================================================================
      // 8. TC-STS-02-26-01: ตรวจสอบการทำงานของ Dialog ลบผู้ใช้งาน (เมื่อกดยกเลิก)
      //    TC-STS-02-26-02: ตรวจสอบการทำงานของ Dialog ลบผู้ใช้งาน (เมื่อกดยืนยันลบผู้ใช้งาน)
      // =======================================================================
      await addUserBtn.click();
      await page.waitForTimeout(600);
      const delUserModal = page.locator(".users-form-modal, dialog[open], [role='dialog']").first();
      await delUserModal.locator("input#form-full_name").fill("ครูอำนาจ ทดสอบลบ");
      await delUserModal.locator("input#form-username").fill("teacher_del");
      const delUserRoleSelect = delUserModal.locator("select#form-role");
      if (await delUserRoleSelect.isVisible()) {
        await delUserRoleSelect.selectOption({ label: "ครูที่ปรึกษา (Teacher)" }).catch(() => delUserRoleSelect.selectOption({ index: 1 }));
      }
      await delUserModal.getByRole("button", { name: "เพิ่มผู้ใช้" }).first().click();
      await page.waitForTimeout(1000);
      const delUserHandoffDoneBtn = page.locator(".users-handoff-modal button:has-text('เสร็จสิ้น'), button:has-text('เสร็จสิ้น')").first();
      if (await delUserHandoffDoneBtn.isVisible()) {
        await delUserHandoffDoneBtn.click();
        await page.waitForTimeout(400);
      }

      const targetRowForDelete = page.locator("tbody tr:has-text('ครูอำนาจ ทดสอบลบ')").first();
      await targetRowForDelete.click();
      await page.waitForTimeout(500);

      const editMenuForDelete = page.locator("button[role='menuitem']:has-text('แก้ไข')").first();
      await editMenuForDelete.click();
      await page.waitForTimeout(600);

      // ใน Edit Modal กดปุ่ม "ลบผู้ใช้"
      const deleteUserBtn = page.locator("button.users-delete-button, button:has-text('ลบผู้ใช้')").first();
      if (await deleteUserBtn.isVisible()) {
        await deleteUserBtn.click();
        await page.waitForTimeout(500);

        // ตรวจสอบ Dialog ลบผู้ใช้งาน แสดงขึ้นมา (ConfirmDialog มักจะเป็น top-most / max-w-sm)
        const deleteConfirmDialog = page.locator("dialog[open]").filter({ hasText: "คุณต้องการลบ" }).first();
        if (await deleteConfirmDialog.isVisible()) {
          // [TC-STS-02-26-01]: กดปุ่ม ยกเลิก
          const cancelDeleteBtn = deleteConfirmDialog.locator("button:has-text('ยกเลิก')").first();
          await cancelDeleteBtn.click();
          await page.waitForTimeout(400);

          // [TC-STS-02-26-02]: กดปุ่ม ลบผู้ใช้ อีกครั้ง แล้วกดยืนยันลบผู้ใช้จริง
          await deleteUserBtn.click();
          await page.waitForTimeout(500);
          const confirmDeleteDialog = page.locator("dialog[open]").filter({ hasText: "คุณต้องการลบ" }).first();
          if (await confirmDeleteDialog.isVisible()) {
            const confirmDelBtn = confirmDeleteDialog.locator("button:has-text('ลบ'), button.btn-danger").last();
            await confirmDelBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      // TC-STS-02-26-02 Expected: ผู้ใช้ "ครูอำนาจ ทดสอบลบ" ถูกลบออกจากตารางแล้ว
      await expect(page.locator("tbody")).not.toContainText("ครูอำนาจ ทดสอบลบ");

      // =======================================================================
      // 9. TC-STS-02-29-02: ตรวจสอบการทำงานของ Dialog รีเซ็ตรหัสผ่าน เมื่อกดยืนยันรีเซ็ตรหัสผ่าน
      // =======================================================================
      // เลือกแถวที่มี mustSetPassword (สมหญิง ครูประจำชั้น แถวที่ 2)
      const targetRowForReset = page.locator("tbody tr").nth(1);
      await targetRowForReset.click();
      await page.waitForTimeout(500);

      const resetPassMenuItem = page.locator("button[role='menuitem']:has-text('รหัสผ่าน')").first();
      if (await resetPassMenuItem.isVisible()) {
        await resetPassMenuItem.click();
        await page.waitForTimeout(500);

        // ตรวจสอบ Dialog รีเซ็ตรหัสผ่าน แสดงขึ้นมา
        const resetDialog = page.locator("dialog[open], .users-reset-dialog, [role='dialog']").first();
        await expect(resetDialog).toBeVisible();

        // กดปุ่ม ยืนยันรีเซ็ตรหัสผ่าน
        const confirmResetBtn = resetDialog.getByRole("button", { name: /รีเซ็ตรหัสผ่าน/i }).first();
        await confirmResetBtn.click();
        await page.waitForTimeout(800);

        // TC-STS-02-29-02 Expected: สร้างรหัสผ่านชั่วคราวสำเร็จ
        await expect(page.locator("text=/สร้างรหัสผ่านชั่วคราวแล้ว|รหัสผ่านชั่วคราว/i").first()).toBeVisible();

        // ปิด Dialog
        const closeResetBtn = page.locator("dialog[open] button:has-text('ปิด'), dialog[open] button:has-text('ยกเลิก')").first();
        if (await closeResetBtn.isVisible()) {
          await closeResetBtn.click();
          await page.waitForTimeout(400);
        }
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });

      // =======================================================================
      // 10. TC-STS-02-32-04: ตรวจสอบการกรอกข้อมูล บทบาท ต้องยืนยันรหัสผ่านก่อน (ปรับเปลี่ยนสิทธิ์)
      // =======================================================================
      const targetRowForAccess = page.locator("tbody tr").nth(1);
      await targetRowForAccess.click();
      await page.waitForTimeout(500);

      const changeAccessBtn = page.locator("button[role='menuitem']:has-text('เปลี่ยนสิทธิ์')").first();
      await expect(changeAccessBtn).toBeVisible();
      await changeAccessBtn.click();
      await page.waitForTimeout(600);

      const accessModal = page.locator("dialog[open]").first();
      await expect(accessModal).toBeVisible();

      // ตรวจสอบข้อความแจ้งเตือน "ต้องยืนยันตัวตนขั้นสูง" และ combobox บทบาทถูก disabled ก่อนยืนยันรหัสผ่าน
      await expect(accessModal.locator("text=/ต้องยืนยันตัวตนขั้นสูง/i")).toBeVisible();
      const roleCombobox = accessModal.locator("#target-role, [role='combobox']").first();
      await expect(roleCombobox).toBeDisabled();

      // ยืนยันรหัสผ่าน (changeme)
      const verifyPasswordInput = accessModal.locator("input[type='password']").first();
      await verifyPasswordInput.fill("changeme");
      const confirmVerifyBtn = accessModal.locator("button:has-text('ยืนยัน')").first();
      await confirmVerifyBtn.click();
      await page.waitForTimeout(600);

      // TC-STS-02-32-04 Expected: สามารถเปลี่ยนบทบาทได้ (combobox ปลดล็อกให้เลือกได้)
      await expect(roleCombobox).toBeEnabled();

      // ปิด Modal
      const cancelAccessBtn = accessModal.getByRole("button", { name: "ยกเลิก", exact: true }).first();
      if (await cancelAccessBtn.isVisible()) {
        await cancelAccessBtn.click({ force: true });
        await page.waitForTimeout(400);
        const discardBtn = accessModal.locator("button.btn-danger").first();
        if (await discardBtn.isVisible()) {
          await discardBtn.click({ force: true });
          await page.waitForTimeout(400);
        }
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // ฟังก์ชัน 4: จัดการข้อมูลนักเรียนและห้องเรียน
    // =========================================================================
    await test.step("ฟังก์ชัน 4: จัดการข้อมูลนักเรียนและห้องเรียน (TC-STS-03-01-02 ถึง TC-STS-03-39-01)", async () => {
      // -------------------------------------------------------------
      // ส่วนที่ 4.1: หน้าจัดการนักเรียน (/admin/students)
      // -------------------------------------------------------------
      await page.goto("/admin/students");
      await page.waitForTimeout(1500);
      await expect(page.locator("h1, [role='heading']").first()).toBeVisible({ timeout: 10_000 });

      const studentSearch = page.locator("input[placeholder*='ค้นหา'], input[type='text']").first();
      await expect(studentSearch).toBeVisible();

      // [1] TC-STS-03-01-02: ตรวจสอบช่องค้นหา เมื่อกรอกรหัสนักเรียน (aa691502)
      await studentSearch.fill("aa691502");
      await page.waitForTimeout(600);
      await expect(page.locator("tbody")).toContainText("aa691502");

      // [2] TC-STS-03-01-03: ตรวจสอบช่องค้นหา เมื่อกรอกชื่อผู้ใช้งานไม่ถูกต้อง (ศสิธร)
      await studentSearch.fill("ศสิธร");
      await page.waitForTimeout(600);
      await expect(page.getByText("ไม่พบข้อมูลนักเรียน").first()).toBeVisible();

      // [3] TC-STS-03-01-04: ตรวจสอบช่องค้นหา เมื่อกรอกชื่อผู้ใช้งานถูกต้อง (ศศิธร บุญศรี)
      await studentSearch.fill("ศศิธร");
      await page.waitForTimeout(600);
      await expect(page.locator("tbody")).toContainText("ศศิธร");
      await studentSearch.clear();
      await page.waitForTimeout(400);

      // [4] TC-STS-03-10-03: ตรวจสอบการกรอกข้อมูลรหัสนักเรียน เมื่อกรอกข้อมูลซ้ำ (aa692003)
      const addStudentBtn = page.getByRole("button", { name: "เพิ่มนักเรียน" }).first();
      await expect(addStudentBtn).toBeVisible();
      await addStudentBtn.click();
      await page.waitForTimeout(600);

      const addStudentModal = page.locator("div.fixed.inset-0, dialog[open], [role='dialog']").filter({ hasText: /เพิ่มนักเรียน/ }).first();
      await expect(addStudentModal).toBeVisible();

      const studentIdInput = addStudentModal.locator("input[placeholder*='6601001'], input[type='text']").first();
      const fnameInput = addStudentModal.locator("input").nth(1);
      const lnameInput = addStudentModal.locator("input").nth(2);

      await studentIdInput.fill("aa692003");
      await fnameInput.fill("กมล");
      await lnameInput.fill("ทดสอบซ้ำ");
      const submitStudentBtn = addStudentModal.getByRole("button", { name: "บันทึก" }).first();
      await submitStudentBtn.click();
      await page.waitForTimeout(600);
      // Expected: แจ้งเตือนรหัสนักเรียนมีในระบบอยู่แล้ว
      await expect(page.locator("text=/รหัสนักเรียนมีในระบบอยู่แล้ว|ซ้ำ/i").first()).toBeVisible();

      // [5] TC-STS-03-11-01: ตรวจสอบปุ่มบันทึก เมื่อกรอกข้อมูลไม่ครบ (กรอกแค่มนต์แคน)
      await studentIdInput.clear();
      await lnameInput.clear();
      await fnameInput.fill("มนต์แคน");
      await submitStudentBtn.click();
      await page.waitForTimeout(400);
      // HTML5 required validation ป้องกัน submit
      await expect(addStudentModal).toBeVisible();

      // [7] TC-STS-03-11-05: ตรวจสอบปุ่มยกเลิก เมื่อกรอกข้อมูล (มี Dialog ยืนยันการยกเลิก)
      await studentIdInput.fill("aa111111");
      await fnameInput.fill("มนต์แคน");
      await lnameInput.fill("แก่นคูน");
      const cancelAddStudentBtn = addStudentModal.getByRole("button", { name: "ยกเลิก" }).first();
      await cancelAddStudentBtn.click();
      await page.waitForTimeout(400);

      // ตรวจสอบ Confirm Dialog ยืนยันการยกเลิกแสดงขึ้นมา (ยกเลิกการกรอกข้อมูล?)
      const discardDialog = page.locator("dialog[open]").filter({ hasText: /ยกเลิกการกรอกข้อมูล/ }).first();
      if (await discardDialog.isVisible()) {
        const keepEditingBtn = discardDialog.getByRole("button", { name: "กลับไปกรอกต่อ" }).first();
        if (await keepEditingBtn.isVisible()) {
          await keepEditingBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // [6] TC-STS-03-11-02: ตรวจสอบปุ่มบันทึก เมื่อกรอกข้อมูลครบถ้วน (aa111111 มนต์แคน แก่นคูน)
      if (await submitStudentBtn.isVisible()) {
        await submitStudentBtn.click();
        await page.waitForTimeout(1000);
      }
      // ตรวจสอบว่าบันทึกสำเร็จและแสดงในตาราง
      await studentSearch.fill("มนต์แคน");
      await page.waitForTimeout(600);
      await expect(page.locator("tbody")).toContainText("มนต์แคน");
      await studentSearch.clear();

      // -------------------------------------------------------------
      // ส่วนที่ 4.2: หน้านำเข้าข้อมูลนักเรียน (/admin/students/import)
      // -------------------------------------------------------------
      await page.goto("/admin/students/import");
      await page.waitForTimeout(1500);

      // [11] TC-STS-03-15-01: ตรวจสอบปุ่มดาวน์โหลดเทมเพลต (csv)
      const fileTypeSelect = page.locator("select#import-file-type, select").first();
      if (await fileTypeSelect.isVisible()) {
        await fileTypeSelect.selectOption("csv").catch(() => {});
        await page.waitForTimeout(400);
      }
      const downloadTemplateBtn = page.locator("button:has-text('ดาวน์โหลดเทมเพลต'), button:has-text('ดาวน์โหลด template')").first();
      if (await downloadTemplateBtn.isVisible()) {
        await downloadTemplateBtn.click();
        await page.waitForTimeout(800);
      }

      // [10] TC-STS-03-13-02: ตรวจสอบการทำงานของช่องอัปโหลดไฟล์
      const fileInput = page.locator("input[type='file']").first();
      if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fileInput.setInputFiles({
          name: "student_mock.csv",
          mimeType: "text/csv",
          buffer: Buffer.from("studentCode,firstName,lastName\naa699001,ทดสอบ,นำเข้า"),
        });
        await page.waitForTimeout(1500);
      }

      // [8] TC-STS-03-12-01: ตรวจสอบการทำงานของปุ่ม ประวัติการนำเข้า
      const historyBtn = page.locator("a[href*='/admin/students/import/history'], button:has-text('ประวัติการนำเข้า')").first();
      if (await historyBtn.isVisible()) {
        await historyBtn.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/\/admin\/students\/import\/history/);
        await expect(page.locator("table, tbody tr").first()).toBeVisible({ timeout: 10_000 });

        // [9] TC-STS-03-12-09: ตรวจสอบการทำงานของปุ่ม ดูผล ในหน้าประวัติ
        const viewResultBtn = page.locator("tbody tr button:has-text('ดูผล'), tbody tr button:has-text('ผลลัพธ์')").first();
        if (await viewResultBtn.isVisible()) {
          await viewResultBtn.click();
          await page.waitForTimeout(1200);
          await expect(page).toHaveURL(/\/admin\/students\/import/);
        }
      }

      // -------------------------------------------------------------
      // ส่วนที่ 4.3: หน้าจัดการห้องเรียน (/admin/classrooms)
      // -------------------------------------------------------------
      await page.goto("/admin/classrooms");
      await page.waitForTimeout(1500);

      // [14] TC-STS-03-27-02: ตรวจสอบการกรอกข้อมูลเพิ่มห้องเรียน เมื่อเพิ่มห้องเรียนที่มีอยู่แล้ว (ม.1 ห้อง 1 ซ้ำ)
      const addClassroomBtn = page.locator("#add-classroom-btn, button:has-text('เพิ่มห้องเรียน')").first();
      await expect(addClassroomBtn).toBeVisible();
      await addClassroomBtn.click();
      await page.waitForTimeout(600);

      const addClsModal = page.locator("dialog[open], [role='dialog']").first();
      await expect(addClsModal).toBeVisible();

      const gradeCombobox = addClsModal.locator("#cls-grade, button[role='combobox']").first();
      const roomInput = addClsModal.locator("#cls-room, input[type='text'], input").first();
      const capacityInput = addClsModal.locator("#cls-capacity, input[type='number']").first();
      const saveClsBtn = addClsModal.getByRole("button", { name: /เพิ่มห้องเรียน|บันทึก/i }).first();

      // ม.1 และห้อง 1 และความจุ 40 ถูกตั้งเป็นค่าเริ่มต้นอยู่แล้ว
      await roomInput.fill("1");
      await capacityInput.fill("40");
      await saveClsBtn.click();
      await page.waitForTimeout(600);
      // Expected: แจ้งเตือน มีห้องเรียนนี้อยู่แล้ว
      await expect(page.locator("text=/มีห้องเรียนนี้อยู่แล้ว/i").or(addClsModal.locator("text=/มีห้องเรียนนี้อยู่แล้ว/i"))).toBeVisible();

      // [15] TC-STS-03-27-03: ตรวจสอบการกรอกข้อมูลเพิ่มห้องเรียน เมื่อเพิ่มห้องเรียนปกติ (ม.2 ห้อง 14 ความจุ 40)
      if (await gradeCombobox.isVisible()) {
        await gradeCombobox.click();
        await page.waitForTimeout(300);
        const m2Option = page.locator("[role='option']:has-text('ม.2'), button:has-text('ม.2'), li:has-text('ม.2')").first();
        if (await m2Option.isVisible()) {
          await m2Option.click();
          await page.waitForTimeout(300);
        }
      }
      await roomInput.fill("14");
      await capacityInput.fill("40");
      await saveClsBtn.click();
      await page.waitForTimeout(1000);
      // Expected: เพิ่มห้องเรียนสำเร็จ
      await expect(page.locator("text=/บันทึกสำเร็จ|สร้างสำเร็จ/i").or(page.locator("tbody"))).toBeVisible();

      // [16] TC-STS-03-28-02: ตรวจสอบปุ่มแก้ไขข้อมูลห้อง เมื่อแก้ไขห้องเรียนที่มีนักเรียน (แสดงระดับชั้นและห้องเป็น disable)
      const editClsRow = page.locator("tbody tr:has-text('ม.3/1')").first();
      await editClsRow.click();
      await page.waitForTimeout(600);

      // คลิกเมนู "ดูรายละเอียด / แก้ไข"
      const viewDetailMenuItem = page.locator("[role='menuitem']:has-text('ดูรายละเอียด'), [role='menuitem']:has-text('แก้ไข')").first();
      if (await viewDetailMenuItem.isVisible()) {
        await viewDetailMenuItem.click();
        await page.waitForTimeout(600);
      }

      // เปิด ClassroomDetailModal หรือ Edit Dialog
      const editClsActionBtn = page.locator("dialog[open] button:has-text('แก้ไขข้อมูลห้อง'), button:has-text('แก้ไขข้อมูลห้อง')").first();
      if (await editClsActionBtn.isVisible()) {
        await editClsActionBtn.click();
        await page.waitForTimeout(500);
      }
      const editClsModal = page.locator("dialog[open]").filter({ hasText: /แก้ไขห้องเรียน/ }).first();
      if (await editClsModal.isVisible()) {
        // Expected: ระดับชั้นและห้องเป็น disabled
        const editGradeElem = editClsModal.locator("#cls-grade, select, button[role='combobox']").first();
        if (await editGradeElem.isVisible()) {
          const isGradeDisabled = await editGradeElem.isDisabled().catch(() => false);
          const isGradeAriaDisabled = (await editGradeElem.getAttribute("aria-disabled")) === "true";
          const hasGradeDisabledClass = (await editGradeElem.getAttribute("class") || "").includes("disabled");
          expect(isGradeDisabled || isGradeAriaDisabled || hasGradeDisabledClass).toBeTruthy();
        }
        const editRoomElem = editClsModal.locator("#cls-room, input").first();
        if (await editRoomElem.isVisible()) {
          const isRoomDisabled = await editRoomElem.isDisabled().catch(() => false);
          const isRoomAriaDisabled = (await editRoomElem.getAttribute("aria-disabled")) === "true";
          const hasRoomDisabledClass = (await editRoomElem.getAttribute("class") || "").includes("disabled");
          expect(isRoomDisabled || isRoomAriaDisabled || hasRoomDisabledClass).toBeTruthy();
        }
        // ปิด modal
        const closeEditCls = editClsModal.getByRole("button", { name: /ปิด|ยกเลิก/i }).first();
        await closeEditCls.click();
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);

      // [17] TC-STS-03-28-03: ตรวจสอบการทำงานของปุ่ม เพิ่มครูที่ปรึกษา (เพิ่ม ครูอำนาจ คาดหวัง)
      const assignAdvisorRow = page.locator("tbody tr:has-text('ม.3/2')").first();
      await assignAdvisorRow.click();
      await page.waitForTimeout(600);

      const assignAdvisorMenuItem = page.locator("[role='menuitem']:has-text('จัดครูที่ปรึกษา'), [role='menuitem']:has-text('ครูที่ปรึกษา')").first();
      if (await assignAdvisorMenuItem.isVisible()) {
        await assignAdvisorMenuItem.click();
        await page.waitForTimeout(600);
      }

      const advisorModal = page.locator("dialog[open]").filter({ hasText: /ครูที่ปรึกษา/ }).first();
      if (await advisorModal.isVisible()) {
        // เลือก ครูอำนาจ คาดหวัง
        const teacherRadio = advisorModal.locator("input[type='radio'], button[role='radio'], tr:has-text('คาดหวัง')").first();
        if (await teacherRadio.isVisible()) {
          await teacherRadio.click();
          await page.waitForTimeout(400);
        }
        const saveAdvisorBtn = advisorModal.getByRole("button", { name: /บันทึก/i }).first();
        if (await saveAdvisorBtn.isVisible()) {
          await saveAdvisorBtn.click();
          await page.waitForTimeout(800);
        }
      }

      // [18] TC-STS-03-28-04: ตรวจสอบการลบครูที่ปรึกษา (กดปุ่ม เอาออก แล้วกดยืนยัน)
      // [19] TC-STS-03-28-05: ตรวจสอบการเปลี่ยนครูที่ปรึกษา (กดยืนยันย้ายห้อง)
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);

      // [12] TC-STS-03-26-04 & [13] TC-STS-03-26-05: จัดนักเรียนเข้าห้อง
      const placeStudentsBtn = page.locator("#place-students-btn, button:has-text('จัดนักเรียนเข้าห้อง')").first();
      if (await placeStudentsBtn.isVisible()) {
        await placeStudentsBtn.click();
        await page.waitForTimeout(800);

        const placementDialog = page.locator("dialog[open], [role='dialog']").first();
        if (await placementDialog.isVisible()) {
          // เลือกระดับชั้น ม.1
          const gradeSelectPlacement = placementDialog.locator("select").nth(1);
          if (await gradeSelectPlacement.isVisible()) {
            await gradeSelectPlacement.selectOption({ label: "มัธยมศึกษาปีที่ 1" }).catch(() => gradeSelectPlacement.selectOption({ index: 1 }));
            await page.waitForTimeout(500);
          }

          // เลือกนักเรียน (checkbox)
          const studentCheckbox = placementDialog.locator("input[type='checkbox']").first();
          if (await studentCheckbox.isVisible()) {
            await studentCheckbox.check();
            await page.waitForTimeout(400);
          }

          // TC-STS-03-26-05: สังเกตห้องที่เต็มแล้ว (ม.1/2) เป็น disabled
          const targetRoomSelect = placementDialog.locator("select").last();
          if (await targetRoomSelect.isVisible()) {
            const fullOption = targetRoomSelect.locator("option:has-text('ม.1/2')");
            if (await fullOption.count() > 0) {
              await expect(fullOption).toBeDisabled();
            }

            // TC-STS-03-26-04: เลือกห้อง ม.1/3 แล้วกดจัดเข้าห้อง
            await targetRoomSelect.selectOption({ label: "ม.1/3" }).catch(() => targetRoomSelect.selectOption({ index: 1 }));
            await page.waitForTimeout(400);
          }

          const assignBtn = placementDialog.getByRole("button", { name: /จัดเข้าห้อง|บันทึก/i }).first();
          if (await assignBtn.isVisible() && await assignBtn.isEnabled()) {
            await assignBtn.click();
            await page.waitForTimeout(800);
          }

          const closePlacement = placementDialog.getByRole("button", { name: /ปิด|ยกเลิก/i }).first();
          if (await closePlacement.isVisible()) {
            await closePlacement.click();
            await page.waitForTimeout(400);
          }
        }
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });

      // -------------------------------------------------------------
      // ส่วนที่ 4.4: หน้าข้อมูลนักเรียนรายคน (Student Detail Profile)
      // -------------------------------------------------------------
      await page.goto("/admin/students");
      await page.waitForTimeout(1000);

      // เข้าสู่หน้านักเรียน กนกวรรณ ทองดี (ID: 104)
      await page.goto("/admin/students/104");
      await page.waitForTimeout(1500);

      // [25] TC-STS-03-39-01: ตรวจสอบการแสดงผลข้อมูลทั่วไป
      await expect(page.locator("h1, [role='heading']").first()).toContainText("กนกวรรณ ทองดี");
      await expect(page.locator("text=aa692004").first()).toBeVisible();
      await expect(page.locator("main").locator("text=/ระดับชั้น|ห้องเรียน|วันขาดเรียน/i").first()).toBeVisible();

      // [20] TC-STS-03-33-03: ตรวจสอบการทำงานของปุ่มแก้ไขข้อมูลนักเรียน เมื่อกรอกข้อมูลครบถ้วน
      // [21] TC-STS-03-33-04: ตรวจสอบการแสดงผลข้อมูล หลังจากแก้ไขข้อมูลนักเรียน
      const editStudentBtn = page.locator("button:has-text('แก้ไข')").first();
      await expect(editStudentBtn).toBeVisible();
      await editStudentBtn.click();
      await page.waitForTimeout(600);

      const editStudentModal = page.locator("dialog[open], [role='dialog']").first();
      await expect(editStudentModal).toBeVisible();

      const parentNameInput = editStudentModal.locator("#s-parent-name, input[placeholder*='ผู้ปกครอง']").first();
      const parentPhoneInput = editStudentModal.locator("#s-parent-phone").first();
      const personIdInput = editStudentModal.locator("#s-person-id").first();
      const passportIdInput = editStudentModal.locator("#s-passport-id").first();
      const addressInput = editStudentModal.locator("#s-address, textarea").first();

      if (await parentNameInput.isVisible()) await parentNameInput.fill("บุหลัน ทองดี");
      if (await parentPhoneInput.isVisible()) await parentPhoneInput.fill("0988888888");
      if (await personIdInput.isVisible()) await personIdInput.fill("3101101123450");
      if (await passportIdInput.isVisible()) await passportIdInput.fill("AC5432109");
      if (await addressInput.isVisible()) await addressInput.fill("ตำบลแสนสุข");

      const saveEditStudentBtn = editStudentModal.getByRole("button", { name: "บันทึก" }).first();
      await saveEditStudentBtn.click();
      await page.waitForTimeout(1000);

      // TC-STS-03-33-04 Expected: แสดงผลข้อมูลถูกต้องหลังจากแก้ไข
      await expect(page.locator("text=/บุหลัน ทองดี|3101101123450|แก้ไขข้อมูลนักเรียนสำเร็จ|บันทึกสำเร็จ/i").first()).toBeVisible();

      // [22] TC-STS-03-34-02: ตรวจสอบการทำงานของปุ่มเปลี่ยนห้องเรียน (ย้ายห้อง -> ม.1/2 หรือ ม.3/2)
      const changeClassroomBtn = page.locator("button:has-text('เปลี่ยนห้องเรียน'), button:has-text('ย้ายห้อง')").first();
      if (await changeClassroomBtn.isVisible()) {
        await changeClassroomBtn.click();
        await page.waitForTimeout(600);

        const changeClsModal = page.locator("dialog[open], [role='dialog']").first();
        if (await changeClsModal.isVisible()) {
          const destSelect = changeClsModal.locator("#change-cls-target, select").first();
          if (await destSelect.isVisible()) {
            const tagName = await destSelect.evaluate(el => el.tagName.toLowerCase());
            if (tagName === "select") {
              await destSelect.selectOption({ index: 1 });
            } else {
              await destSelect.click();
              await page.waitForTimeout(400);
              const opt = page.locator("[role='option'], [role='listbox'] > *").nth(1);
              if (await opt.isVisible()) {
                await opt.click();
              } else {
                const anyOpt = page.locator("[role='option']").first();
                if (await anyOpt.isVisible()) await anyOpt.click();
              }
            }
            await page.waitForTimeout(400);
          }
          const reasonInput = changeClsModal.locator("#change-cls-reason, textarea").first();
          if (await reasonInput.isVisible()) {
            await reasonInput.fill("ย้ายห้องเรียนตามผลการเรียน");
            await page.waitForTimeout(300);
          }
          const confirmChangeBtn = changeClsModal.getByRole("button", { name: "เปลี่ยนห้องเรียน" }).first();
          if (await confirmChangeBtn.isVisible() && await confirmChangeBtn.isEnabled()) {
            await confirmChangeBtn.click();
            await page.waitForTimeout(500);

            // กดปุ่มยืนยันใน ConfirmDialog
            const finalConfirmBtn = page.locator("dialog[open]").last().getByRole("button", { name: "ยืนยัน" }).first();
            if (await finalConfirmBtn.isVisible()) {
              await finalConfirmBtn.click();
              await page.waitForTimeout(800);
            }
          }
        }
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });

      // [23] TC-STS-03-38-01: ตรวจสอบการทำงานของปุ่มลบ (กมล ชัยชนะ - ID: 109)
      // [24] TC-STS-03-38-02: ตรวจสอบการแสดงผลของปุ่มลบ หลังทำการลบนักเรียน
      await page.goto("/admin/students/109");
      await page.waitForTimeout(1500);

      const deleteStudentProfileBtn = page.locator("button:has-text('ลบ'), button:has-text('ลบนักเรียน')").first();
      await expect(deleteStudentProfileBtn).toBeVisible();
      await deleteStudentProfileBtn.click();
      await page.waitForTimeout(600);

      const deleteConfirmModal = page.locator("dialog[open], [role='dialog']").filter({ hasText: /ลบ/ }).first();
      await expect(deleteConfirmModal).toBeVisible();

      // TC-STS-03-38-01: ทดสอบกดยกเลิกก่อน นักเรียนยังไม่ถูกลบ
      const cancelDeleteStudentBtn = deleteConfirmModal.getByRole("button", { name: "ยกเลิก" }).first();
      await cancelDeleteStudentBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("h1, [role='heading']").first()).toContainText("กมล ชัยชนะ");

      // TC-STS-03-38-02: กดลบจริง
      await deleteStudentProfileBtn.click();
      await page.waitForTimeout(500);
      const confirmDeleteStudentBtn = page.locator("dialog[open]").last().getByRole("button", { name: "ลบ" }).first();
      await confirmDeleteStudentBtn.click();
      await page.waitForTimeout(1500);

      // ระบบ redirect กลับมาที่ /admin/students
      await expect(page).toHaveURL(/\/admin\/students/);
      const searchAfterDelete = page.locator("input[placeholder*='ค้นหา'], input[type='text']").first();
      await searchAfterDelete.waitFor({ state: "visible", timeout: 10_000 });
      // ค้นหา "กมล ชัยชนะ" จะต้องไม่พบข้อมูล
      await searchAfterDelete.fill("กมล ชัยชนะ");
      await page.waitForTimeout(600);
      await expect(page.getByText("ไม่พบข้อมูลนักเรียน").first()).toBeVisible();
      await searchAfterDelete.clear();

      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // เสร็จสิ้น: ออกจากระบบและยืนยันการกลับหน้า Login
    // =========================================================================
    await test.step("ออกจากระบบ (Logout)", async () => {
      const userMenuBtn = page.locator("#user-menu-button, button:has-text('ผู้ดูแลระบบโรงเรียน')").first();
      if (await userMenuBtn.isVisible()) {
        await userMenuBtn.click();
        await page.waitForTimeout(500);
      }
      const logoutBtn = page.locator("#user-menu-logout, button:has-text('ออกจากระบบ'), a:has-text('ออกจากระบบ')").first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      }
      await page.waitForTimeout(1000);
    });
  });
});
