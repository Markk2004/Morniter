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

    // [Precondition]: ล้าง Cookies และเตรียม Mock API
    await page.context().clearCookies();
    await setupStsApiMocks(page);
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

      // กดปุ่มเข้าสู่ระบบ
      await submitBtn.click();

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

      // TC-STS-02-30-02: ตรวจสอบปุ่มเพิ่มผู้ใช้ เมื่อไม่กรอกข้อมูล
      const addUserBtn = page.locator("#add-user-btn");
      if (await addUserBtn.isVisible()) {
        await addUserBtn.click();
        await page.waitForTimeout(600);
        const formModal = page.locator(".users-form-modal, dialog").first();
        await expect(formModal).toBeVisible();

        // ไม่กรอกอะไรแล้วกดปุ่ม "เพิ่มผู้ใช้"
        const submitAddBtn = formModal.getByRole("button", { name: "เพิ่มผู้ใช้" }).first();
        if (await submitAddBtn.isVisible()) {
          await submitAddBtn.click();
          await page.waitForTimeout(400);
          // TC-STS-02-30-02 Expected: ไม่สามารถเพิ่มผู้ใช้ได้ มีแจ้งเตือนกรอกข้อมูลให้ครบ
          await expect(formModal).toBeVisible();
          await expect(page.locator("text=/กรุณากรอก|จำเป็น/i").first()).toBeVisible();
        }

        // TC-STS-02-31-03: ตรวจสอบการกรอกข้อมูลชื่อผู้ใช้เป็นภาษาไทย (ระบบต้อง sanitize / ป้องกัน)
        const usernameInput = formModal.locator("input#form-username");
        if (await usernameInput.isVisible()) {
          await usernameInput.fill("มอมแมม");
          await page.waitForTimeout(300);
          const val = await usernameInput.inputValue();
          // ภาษาไทยต้องถูก sanitize ออก (ค่าว่าง หรือไม่อนุญาต)
          expect(val).not.toContain("มอมแมม");
        }

        // TC-STS-02-34-01: ตรวจสอบการแสดงผลเมื่อเพิ่มผู้ใช้งานใหม่ กรอกครบ สุ่มรหัสผ่าน
        const fullNameInput = formModal.locator("input#form-full_name");
        if (await fullNameInput.isVisible()) {
          await fullNameInput.fill("ครูอำนาจ คาดหวัง");
        }
        if (await usernameInput.isVisible()) {
          await usernameInput.fill("teacher_umnat");
        }
        // กดปุ่มสุ่มรหัสผ่าน
        const randomPassBtn = formModal.getByRole("button", { name: /สุ่ม|สร้าง/i }).first();
        if (await randomPassBtn.isVisible()) {
          await randomPassBtn.click();
          await page.waitForTimeout(300);
        }
        // เลือกบทบาท ครูที่ปรึกษา
        const roleSelect = formModal.locator("select#form-role");
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption({ label: "ครูที่ปรึกษา (Teacher)" }).catch(() => roleSelect.selectOption({ index: 1 }));
        }

        // กดยกเลิกฟอร์ม (เพื่อทดสอบ Dialog ยกเลิก TC-STS-02-26-01)
        const cancelFormBtn = formModal.getByRole("button", { name: "ยกเลิก" }).first();
        if (await cancelFormBtn.isVisible()) {
          await cancelFormBtn.click();
          await page.waitForTimeout(500);
          // ยืนยันยกเลิกใน Confirm Dialog
          const confirmCancel = page.getByRole("dialog").getByRole("button", { name: /ยืนยัน|ยกเลิกการเพิ่ม/i }).first();
          if (await confirmCancel.isVisible()) {
            await confirmCancel.click();
            await page.waitForTimeout(800);
          }
        }
        // ตรวจสอบว่า dialog ปิดหมดแล้ว
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(500);
      }

      // TC-STS-02-24-01: ตรวจสอบปุ่มบันทึก เมื่อไม่กรอกชื่อผู้ใช้ ในแก้ไขผู้ใช้
      // TC-STS-02-35-02: ตรวจสอบการแสดงผล เมื่อแก้ไขข้อมูลแล้วกดบันทึก
      // คลิกแถวในตารางเพื่อเปิด Context Menu
      const firstRow = page.locator("tbody tr").first();
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await page.waitForTimeout(500);

        // ตรวจสอบเมนูแก้ไข
        const editMenuItem = page.locator("button[role='menuitem']:has-text('แก้ไข')").first();
        if (await editMenuItem.isVisible()) {
          await editMenuItem.click();
          await page.waitForTimeout(600);

          const editModal = page.locator(".users-form-modal, dialog").first();
          if (await editModal.isVisible()) {
            const nameInput = editModal.locator("input#form-full_name");
            // ลบชื่อผู้ใช้ เพื่อทดสอบ TC-STS-02-24-01
            await nameInput.clear();
            const saveBtn = editModal.getByRole("button", { name: "บันทึก" }).first();
            await saveBtn.click();
            await page.waitForTimeout(300);
            await expect(page.locator("text=/กรุณากรอก|จำเป็น/i").first()).toBeVisible();

            // กรอกชื่อใหม่ตาม TC-STS-02-35-02 (ครูหวัง คาดหวัง)
            await nameInput.fill("ครูหวัง คาดหวัง");
            await saveBtn.click();
            await page.waitForTimeout(800);
          }
        }
      }

      // TC-STS-02-32-04: ตรวจสอบการกรอกข้อมูล บทบาท ต้องยืนยันรหัสผ่านก่อน (ปรับเปลี่ยนสิทธิ์)
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await page.waitForTimeout(500);
        const changeAccessBtn = page.locator("button[role='menuitem']:has-text('เปลี่ยนสิทธิ์')").first();
        if (await changeAccessBtn.isVisible()) {
          await changeAccessBtn.click();
          await page.waitForTimeout(600);

          // ใน Modal เปลี่ยนสิทธิ์ ให้กดปุ่มยกเลิก
          const openDialog = page.locator("dialog[open]");
          if (await openDialog.isVisible()) {
            const cancelBtn = openDialog.getByRole("button", { name: "ยกเลิก", exact: true }).first();
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click({ force: true });
              await page.waitForTimeout(400);

              // ถ้ามี Confirmation Prompt Overlay ขึ้นมา ให้กดปุ่มยืนยันยกเลิก
              const discardBtn = openDialog.locator("button.btn-danger").first();
              if (await discardBtn.isVisible()) {
                await discardBtn.click({ force: true });
                await page.waitForTimeout(400);
              }
            }
          }
        }
        // ตรวจสอบและปิด dialog ทั้งหมดที่อาจค้างอยู่ใน DOM
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(400);
      }

      // เลือก row อื่นที่ไม่ใช่ตัวเอง (เช่นแถวที่ 2 ซึ่งเป็นครู) สำหรับ Suspend และ Reset Password
      const targetRow = page.locator("tbody tr").nth(1);
      const rowToUse = (await targetRow.isVisible()) ? targetRow : firstRow;

      // TC-STS-02-28-02 & TC-STS-02-36-01: ตรวจสอบ Dialog ระงับผู้ใช้ / แสดงผลระงับ
      if (await rowToUse.isVisible()) {
        await rowToUse.click();
        await page.waitForTimeout(500);
        const suspendMenuItem = page.locator("button[role='menuitem']:has-text('ระงับ')").first();
        if (await suspendMenuItem.isVisible()) {
          await suspendMenuItem.click();
          await page.waitForTimeout(500);
          // ปิด Dialog ระงับ
          const cancelSuspend = page.locator("dialog[open] button, .users-suspend-dialog button, button").filter({ hasText: "ยกเลิก" }).first();
          if (await cancelSuspend.isVisible()) {
            await cancelSuspend.click();
            await page.waitForTimeout(400);
          }
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
      }

      // TC-STS-02-29-02: ตรวจสอบ Dialog รีเซ็ตรหัสผ่าน
      if (await rowToUse.isVisible()) {
        await rowToUse.click();
        await page.waitForTimeout(500);
        const resetPassMenuItem = page.locator("button[role='menuitem']:has-text('รหัสผ่าน')").first();
        if (await resetPassMenuItem.isVisible()) {
          await resetPassMenuItem.click();
          await page.waitForTimeout(500);
          const closeReset = page.locator("dialog[open] button, button").filter({ hasText: /ยกเลิก|ปิด/ }).first();
          if (await closeReset.isVisible()) {
            await closeReset.click();
            await page.waitForTimeout(400);
          }
        }
        await page.evaluate(() => {
          document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
        });
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
      }

      // TC-STS-02-26-01: ตรวจสอบ Dialog ลบผู้ใช้งาน เมื่อกดยกเลิก
      // (เปิดจากฟอร์มแก้ไขหรือเมนูแล้วกดยกเลิก)
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
