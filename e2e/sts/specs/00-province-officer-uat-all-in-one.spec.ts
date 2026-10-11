// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: Province Officer UAT Complete All-In-One Workflow
// 📋 อ้างอิง: e2e/sts/specs/09-province-platform.spec.ts (TC-STS-PRV-001, TC-STS-PRV-002)
//    + DEMO_CREDENTIALS["province-officer"] + mock-api.ts (/api/dashboard/province, /api/reports)
// ⚠️ DRAFT รอบที่ 1: มีเฉพาะหมวดที่มีหลักฐานจากไฟล์จริง (หมวด 1-3)
//    หมวดที่ยังขาดหลักฐาน (ห้ามเดา route/selector):
//      - ตัวกรอง Dashboard (ปุ่ม/Modal/ตัวเลขที่ต้องเปลี่ยน)   -> ต้องดู component + mock /api/dashboard/province
//      - ฟอร์มหลัก / สร้างรายงาน (ฟิลด์บังคับ)                  -> ต้องดู component แท็บ "สร้างรายงาน"
//      - AI / ประวัติรายงาน (payload { data, meta })             -> ต้องยืนยันว่าบทบาทนี้มีหน้าจอเหล่านี้จริง
//    TC ID ของหมวด 1 รอแถวจาก Google Sheet (ไม่เดา ID)
// ==============================================================
import { test, expect } from "@playwright/test";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { StsLoginPage } from "../page-objects/login.page";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT เจ้าหน้าที่ระดับจังหวัด] All-in-One (Province Officer Complete Workflow)", () => {
  test("TC-STS-PROVINCE-COMPLETE-E2E: Province Officer Complete UAT Workflow (Single Function All-in-One)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const creds = DEMO_CREDENTIALS["province-officer"];
    const loginPage = new StsLoginPage(page);

    // 🔹 หมวดที่ 1: เข้าสู่ระบบ
    await test.step("หมวด 1: เข้าสู่ระบบด้วยบทบาทเจ้าหน้าที่ระดับจังหวัด และตรวจสอบการนำทางไปแดชบอร์ดจังหวัด", async () => {
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\/login/);

      await loginPage.login(creds.username, creds.password);

      await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
      await page.waitForTimeout(1500);
    });

    // 🔹 หมวดที่ 2: แดชบอร์ดจังหวัด (TC-STS-PRV-001)
    await test.step("หมวด 2: ตรวจสอบแดชบอร์ดจังหวัด ชื่อจังหวัด และตัวชี้วัดโรงเรียน", async () => {
      await page.goto("/province/dashboard");
      await page.bringToFront();
      await expect(page).toHaveURL(/\/province\/dashboard/);

      // ยืนยันตรง ไม่ใช้ if(isVisible) ครอบ เพื่อให้ล้มเมื่อหน้าเปลี่ยน
      await expect(page.getByText("กรุงเทพมหานคร").first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/โรงเรียน|สถานศึกษา/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.waitForTimeout(1500);
    });

    // 🔹 หมวดที่ 3: พื้นที่รายงานระดับจังหวัด (TC-STS-PRV-002)
    await test.step("หมวด 3: เปิดรายงานระดับจังหวัด ตรวจ Privacy badge และสลับแท็บ", async () => {
      await page.goto("/province/reports");
      await page.bringToFront();
      await expect(page).toHaveURL(/\/province\/reports/);

      await expect(page.getByText(/รายงานระดับจังหวัด/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        page.getByText(/ไม่มีข้อมูลนักเรียนรายบุคคล/i).first(),
      ).toBeVisible({ timeout: 10_000 });

      const createTab = page.getByRole("tab", { name: /สร้างรายงาน/i });
      const compareTab = page.getByRole("tab", {
        name: /เปรียบเทียบโรงเรียน/i,
      });
      await expect(createTab).toBeVisible();
      await expect(compareTab).toBeVisible();

      // aria-selected: สมมติฐานตามมาตรฐาน ARIA ของ role="tab" — ยังไม่มีหลักฐานจาก component จริง
      await compareTab.click();
      await expect(compareTab).toHaveAttribute("aria-selected", "true");
      await page.waitForTimeout(1200);

      await createTab.click();
      await expect(createTab).toHaveAttribute("aria-selected", "true");
      await page.waitForTimeout(1500);
    });
  });
});
