// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: Province Officer UAT Complete All-In-One Workflow
// 📋 อ้างอิง: DEMO_CREDENTIALS["province-officer"], mock-api.ts (/api/dashboard/province, /api/reports),
//    ProjectSTS frontend: ProvinceDashboardHeader.tsx, province/dashboard (ท้ายไฟล์), province/reports/page.tsx,
//    ProvinceReportsTabs.tsx  (ทุก locator ด้านล่างอ้างอิง id / data-* / ข้อความจาก source หรือ Mock จริง)
// ⚠️ DRAFT รอบที่ 2: หมวด 1-3 เท่านั้น
//    ยังไม่ทำ (ต้องมีหลักฐานเพิ่ม ห้ามเดา):
//      - ตัวกรอง Dashboard "นำไปใช้": ต้องดู DashboardFilterPopover + แก้ Mock ให้ตอบตาม query จริง
//        (academicYearId, academicYear, termNo, schoolId, startDate, endDate, caseStatus, severity)
//      - สร้างรายงาน (ReportWorkspace) / เปรียบเทียบโรงเรียน (SchoolComparisonWorkspace)
//      - บทบาทนี้ไม่มีหน้าฟอร์มเคสและ AI (route group (province) มีแค่ dashboard + reports)
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

    // 🔹 หมวดที่ 2: แดชบอร์ดจังหวัด (TC-STS-PRV-001) — ค่าทั้งหมดมาจาก Mock /api/dashboard/province (ไม่มี query)
    await test.step("หมวด 2: ตรวจสอบแดชบอร์ดจังหวัด การ์ดสรุป ตารางเปรียบเทียบโรงเรียน และสัดส่วนเคส", async () => {
      await page.goto("/province/dashboard");
      await page.bringToFront();
      await expect(page).toHaveURL(/\/province\/dashboard/);

      // 2.1 ชื่อจังหวัด: header[data-province-name] (ProvinceDashboardHeader) — Mock ค่าเริ่มต้น = ชลบุรี
      await expect(page.locator("header[data-province-name]")).toHaveAttribute(
        "data-province-name",
        "ชลบุรี",
        { timeout: 15_000 },
      );

      // 2.2 การ์ดสรุป: "Student Case" เป็นข้อความ hardcode, การ์ดความเสี่ยงสูงเป็น data-tone="danger"
      const caseCard = page
        .locator('div[data-tone="primary"]')
        .filter({ hasText: "Student Case" });
      await expect(caseCard.locator("strong")).toHaveText("38", {
        timeout: 15_000,
      });
      await expect(page.locator('div[data-tone="danger"] strong')).toHaveText(
        "8",
      );

      // 2.3 ตารางเปรียบเทียบโรงเรียน: th scope="row" = rowheader, td = cell (นักเรียน | เคส | อัตราขาดเฉลี่ย)
      const schoolTable = page.locator(
        'section[aria-labelledby="school-comparison-title"] table',
      );
      await expect(schoolTable).toBeVisible({ timeout: 10_000 });
      const schoolRow = (name: string) =>
        schoolTable.getByRole("row", { name: new RegExp(name) });
      await expect(
        schoolRow("โรงเรียนชลบุรีวิทยา").getByRole("cell"),
      ).toHaveText([/^1,?200$/, "22", "4.5%"]);
      await expect(
        schoolRow("โรงเรียนตัวอย่างทดสอบ").getByRole("cell"),
      ).toHaveText([/^950$/, "16", "3.9%"]);

      // 2.4 สัดส่วนเคสตามความรุนแรง: li[data-tone=<key>] — คีย์ที่เป็น 0 จะไม่แสดงเมื่อมีเคสรวม > 0
      const severity = page.locator(
        'section[aria-labelledby="severity-title"]',
      );
      await expect(severity.locator('li[data-tone="low"] strong')).toHaveText(
        "18",
      );
      await expect(
        severity.locator('li[data-tone="medium"] strong'),
      ).toHaveText("12");
      await expect(severity.locator('li[data-tone="high"] strong')).toHaveText(
        "8",
      );
      await expect(severity.locator('li[data-tone="unassessed"]')).toHaveCount(
        0,
      );
      await page.waitForTimeout(1500);
    });

    // 🔹 หมวดที่ 3: พื้นที่รายงานระดับจังหวัด (TC-STS-PRV-002)
    await test.step("หมวด 3: เปิดรายงานระดับจังหวัด ตรวจ Privacy badge และสลับแท็บสร้างรายงาน/เปรียบเทียบโรงเรียน", async () => {
      await page.goto("/province/reports");
      await page.bringToFront();
      await expect(page).toHaveURL(/\/province\/reports/);

      // หัวข้อเปลี่ยนตามสถานะโหลดและ zone จึงไม่ผูกกับคำว่า "จังหวัด" — รอให้ข้อมูล Mock โหลดแล้วต้องมีชื่อพื้นที่
      await expect(page.locator("#province-reports-title")).toContainText(
        /ชลบุรี/,
        { timeout: 15_000 },
      );
      await expect(
        page.getByText(/ไม่มีข้อมูลนักเรียนรายบุคคล/i).first(),
      ).toBeVisible();

      const createTab = page.getByRole("tab", { name: /สร้างรายงาน/i });
      const compareTab = page.getByRole("tab", {
        name: /เปรียบเทียบโรงเรียน/i,
      });
      await expect(createTab).toBeVisible();
      await expect(compareTab).toBeVisible();

      // แท็บเริ่มต้น = create (useState('create')); aria-selected และ hidden มาจาก source
      await expect(createTab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#panel-create")).toBeVisible();
      await expect(page.locator("#panel-comparison")).toBeHidden();

      await compareTab.click();
      await expect(compareTab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#panel-comparison")).toBeVisible();
      await expect(page.locator("#panel-create")).toBeHidden();
      await page.waitForTimeout(1200);

      await createTab.click();
      await expect(createTab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#panel-create")).toBeVisible();
      await page.waitForTimeout(1500);
    });
  });
});
