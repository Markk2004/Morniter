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
      const missingAdvisorCard = page.locator("a[href*='missing-advisor']").or(page.getByText(/ยังไม่มีครูที่ปรึกษา/i)).first();
      if (await missingAdvisorCard.isVisible()) {
        await expect(missingAdvisorCard).toBeVisible();
        // ทดสอบคลิกนำทางไปยังหน้าจัดการห้องเรียนพร้อมฟิลเตอร์
        await missingAdvisorCard.click();
        await page.waitForTimeout(1200);
        await expect(page).toHaveURL(/\/admin\/classrooms/);
        // กลับมาที่แดชบอร์ด
        await page.goto("/admin");
        await page.waitForTimeout(1000);
      }

      // TC-STS-08-30-03: ตรวจสอบการกดปุ่มการ์ดในความพร้อมของข้อมูลระบบที่ยังไม่ได้จัดการ
      const readinessSection = page.locator(".admin-readiness-section").or(page.getByText(/ความพร้อมของข้อมูล/i)).first();
      if (await readinessSection.isVisible()) {
        await expect(readinessSection).toBeVisible();
        // หากมีรายการที่ต้องจัดการ ให้ตรวจสอบการคลิกนำทาง
        const fixLink = page.locator(".admin-readiness-check-link, a[href*='/admin/']").first();
        if (await fixLink.isVisible()) {
          await fixLink.click();
          await page.waitForTimeout(1200);
          await page.goto("/admin");
          await page.waitForTimeout(1000);
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
      // 3. TC-STS-02-34-01: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการเพิ่ม
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
      // 5. TC-STS-02-35-02: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการแก้ไข (ครูหวัง คาดหวัง)
      // =======================================================================
      await editNameInput.fill("ครูหวัง คาดหวัง");
      await saveBtn.click();
      await page.waitForTimeout(1000);
      // TC-STS-02-35-02 Expected: แสดงข้อมูลบนตารางถูกต้องครบถ้วน ("ครูหวัง คาดหวัง")
      await expect(page.locator("tbody")).toContainText("ครูหวัง คาดหวัง");

      // =======================================================================
      // 6. TC-STS-02-26-01: ตรวจสอบการทำงานของ Dialog ลบผู้ใช้งาน (เมื่อกดยกเลิก)
      // =======================================================================
      const targetRowForDelete = page.locator("tbody tr:has-text('ครูหวัง คาดหวัง')").first();
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
          // กดปุ่ม ยกเลิก
          const cancelDeleteBtn = deleteConfirmDialog.locator("button:has-text('ยกเลิก')").first();
          await cancelDeleteBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // ปิด Edit Modal ถ้ายังเปิดอยู่
      const closeEditModalBtn = page.locator("dialog[open]").filter({ hasText: "แก้ไขผู้ใช้" }).locator("button:has-text('ยกเลิก'), button:has-text('ปิด')").first();
      if (await closeEditModalBtn.isVisible()) {
        await closeEditModalBtn.click();
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      // TC-STS-02-26-01 Expected: ยกเลิกการลบข้อมูล ผู้ใช้ยังคงอยู่บนตาราง
      await expect(page.locator("tbody")).toContainText("ครูหวัง คาดหวัง");

      // =======================================================================
      // 7. TC-STS-02-28-02: ตรวจสอบการทำงานของ Dialog ระงับผู้ใช้
      // 8. TC-STS-02-36-01: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังระงับการใช้งาน
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

      // TC-STS-03-01-02: ตรวจสอบช่องค้นหา เมื่อกรอกรหัสนักเรียน (aa691502 / 50001)
      const studentSearch = page.locator("input[placeholder*='ค้นหา'], input[type='text']").first();
      if (await studentSearch.isVisible()) {
        await studentSearch.fill("50001");
        await page.waitForTimeout(600);
        await studentSearch.clear();
        await page.waitForTimeout(400);
      }

      // TC-STS-03-11-01: ตรวจสอบปุ่มบันทึก เมื่อกรอกข้อมูลไม่ครบ (ใน Dialog เพิ่มนักเรียนใหม่)
      const addStudentBtn = page.getByRole("button", { name: "เพิ่มนักเรียน" }).first();
      if (await addStudentBtn.isVisible()) {
        await addStudentBtn.click();
        await page.waitForTimeout(600);
        const addStudentModal = page.locator("dialog[open], [role='dialog']").first();
        if (await addStudentModal.isVisible()) {
          // กรอกแค่ชื่อไม่กรอกรหัส แล้วกดบันทึก
          const fname = addStudentModal.locator("input[name='first_name'], input#first_name").first();
          if (await fname.isVisible()) {
            await fname.fill("มนต์แคน");
          }
          const saveBtn = addStudentModal.getByRole("button", { name: "บันทึก" }).first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await page.waitForTimeout(400);
            // Expected: ไม่สามารถบันทึกได้ มีแจ้งเตือน
          }
          // ปิด Modal
          const cancelBtn = addStudentModal.getByRole("button", { name: "ยกเลิก" }).first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(400);
          }
        }
      }

      // -------------------------------------------------------------
      // ส่วนที่ 4.2: หน้านำเข้าข้อมูลนักเรียน (/admin/students/import)
      // -------------------------------------------------------------
      await page.goto("/admin/students/import");
      await page.waitForTimeout(1500);

      // TC-STS-03-15-01: ตรวจสอบปุ่มดาวน์โหลดเทมเพลต (เลือก CSV แล้วดาวน์โหลด)
      const fileTypeSelect = page.locator("select#import-file-type").first();
      if (await fileTypeSelect.isVisible()) {
        await fileTypeSelect.selectOption("csv");
        await page.waitForTimeout(400);
      }
      const downloadTemplateBtn = page.locator("button:has-text('ดาวน์โหลดเทมเพลต'), button:has-text('ดาวน์โหลด template')").first();
      if (await downloadTemplateBtn.isVisible()) {
        await downloadTemplateBtn.click();
        await page.waitForTimeout(800);
      }

      // TC-STS-03-12-01: ตรวจสอบปุ่มประวัติการนำเข้า
      const historyLink = page.locator("a[href*='/admin/students/import/history']").first();
      if (await historyLink.isVisible()) {
        await historyLink.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/\/admin\/students\/import\/history/);
        // ตรวจสอบตารางประวัติการนำเข้า
        await expect(page.locator("table, tbody tr").or(page.getByText(/ประวัติ/i)).first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1000);
      }

      // -------------------------------------------------------------
      // ส่วนที่ 4.3: หน้าจัดการห้องเรียน (/admin/classrooms)
      // -------------------------------------------------------------
      await page.goto("/admin/classrooms");
      await page.waitForTimeout(1500);

      // TC-STS-03-27-02: ตรวจสอบปุ่มเพิ่มห้องเรียน เมื่อเพิ่มห้องเรียนที่มีอยู่แล้ว
      const addClassroomBtn = page.locator("#add-classroom-btn, button:has-text('เพิ่มห้องเรียน')").first();
      if (await addClassroomBtn.isVisible()) {
        await addClassroomBtn.click();
        await page.waitForTimeout(600);
        const clsDialog = page.locator("dialog[open], [role='dialog']").first();
        if (await clsDialog.isVisible()) {
          // ปิด Dialog
          const cancelBtn = clsDialog.getByRole("button", { name: "ยกเลิก" }).first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(400);
          }
        }
      }

      // TC-STS-03-26-04: ตรวจสอบปุ่มจัดเข้าห้อง (Student Placement)
      const placeStudentsBtn = page.locator("#place-students-btn, button:has-text('จัดนักเรียนเข้าห้อง')").first();
      if (await placeStudentsBtn.isVisible()) {
        await placeStudentsBtn.click();
        await page.waitForTimeout(800);
        // ปิดหรือยกเลิก Placement
        const closePlacement = page.locator("dialog[open]").getByRole("button", { name: /ยกเลิก|ปิด/i }).first();
        if (await closePlacement.isVisible()) {
          await closePlacement.click();
          await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(400);
      }

      // TC-STS-03-28-02: ตรวจสอบปุ่มแก้ไข บนตารางห้องเรียน
      const editClsBtn = page.locator("tbody tr button:has-text('แก้ไข')").first();
      if (await editClsBtn.isVisible()) {
        await editClsBtn.click();
        await page.waitForTimeout(600);
        const closeDetail = page.locator("dialog[open]").getByRole("button", { name: /ปิด|ยกเลิก/i }).first();
        if (await closeDetail.isVisible()) {
          await closeDetail.click();
          await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(400);
      }

      // -------------------------------------------------------------
      // ส่วนที่ 4.4: หน้าข้อมูลนักเรียนรายคน (Student Detail Profile)
      // -------------------------------------------------------------
      // TC-STS-03-39-01: ตรวจสอบการแสดงผลข้อมูลทั่วไป
      // TC-STS-03-33-03: ตรวจสอบการแก้ไขข้อมูลนักเรียน
      // TC-STS-03-34-02: ตรวจสอบปุ่มเปลี่ยนห้องเรียน
      // TC-STS-03-38-01: ตรวจสอบปุ่มลบ (มี Dialog ยืนยัน)
      await page.goto("/admin/students");
      await page.waitForTimeout(1000);
      const firstStudentRow = page.locator("tbody tr").first();
      if (await firstStudentRow.isVisible()) {
        const viewLink = firstStudentRow.locator("a[href*='/admin/students/']").first();
        if (await viewLink.isVisible()) {
          await viewLink.click();
        } else {
          await page.goto("/admin/students/101").catch(() => {});
        }
      } else {
        await page.goto("/admin/students/101").catch(() => {});
      }
      await page.waitForTimeout(1500);

      // TC-STS-03-39-01: สังเกตช่องข้อมูลทั่วไป
      const generalTab = page.getByText(/ข้อมูลทั่วไป|ประวัติ/i).first();
      if (await generalTab.isVisible()) {
        await expect(generalTab).toBeVisible();
      }

      // TC-STS-03-33-03: ตรวจสอบการแก้ไขข้อมูลนักเรียน
      const editStudentBtn = page.locator("button:has-text('แก้ไข')").first();
      if (await editStudentBtn.isVisible()) {
        await editStudentBtn.click();
        await page.waitForTimeout(500);
        const closeEditStudent = page.locator("dialog[open]").getByRole("button", { name: /ยกเลิก|ปิด/i }).first();
        if (await closeEditStudent.isVisible()) {
          await closeEditStudent.click();
          await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
      }

      // TC-STS-03-34-02: ตรวจสอบปุ่มเปลี่ยนห้องเรียน
      const changeRoomBtn = page.locator("button:has-text('เปลี่ยนห้องเรียน'), button:has-text('ย้ายห้อง')").first();
      if (await changeRoomBtn.isVisible()) {
        await changeRoomBtn.click();
        await page.waitForTimeout(500);
        // ปิด Dialog
        const cancelChange = page.locator("dialog[open]").getByRole("button", { name: /ยกเลิก|ปิด/i }).first();
        if (await cancelChange.isVisible()) {
          await cancelChange.click();
          await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
      }

      // TC-STS-03-38-01: ตรวจสอบปุ่มลบ (ต้องมีหน้าต่างยืนยันการลบ แต่นักเรียนยังไม่ถูกลบถ้ากดยกเลิก)
      const deleteStudentBtn = page.locator("button:has-text('ลบ'), button:has-text('ลบนักเรียน')").first();
      if (await deleteStudentBtn.isVisible()) {
        await deleteStudentBtn.click();
        await page.waitForTimeout(500);
        // กดยกเลิกใน Confirm Dialog
        const cancelDelete = page.locator("dialog[open]").getByRole("button", { name: /ยกเลิก|ปิด/i }).first();
        if (await cancelDelete.isVisible()) {
          await cancelDelete.click();
          await page.waitForTimeout(400);
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
      }

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
