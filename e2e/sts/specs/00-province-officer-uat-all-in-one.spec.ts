// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: Province Officer UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (Province Officer) จาก Google Spreadsheet (SoftDeath System Test V2.0, gid=983747424)
// 🎯 ครอบคลุมครบทุกฟังก์ชัน 8 Test Scenarios (10 Test Cases):
//    - TS-STS-01-03 (TC-STS-01-03-05): ตรวจสอบการแสดงสถานะผู้ใช้ เมื่อเข้าสู่ระบบด้วยสถานะเจ้าหน้าที่จังหวัด
//    - TS-STS-01-04 (TC-STS-01-04-05): ตรวจสอบการแสดงผลข้อมูล เมื่อเข้าสู่ระบบด้วยสถานะเจ้าหน้าที่จังหวัด
//    - TS-STS-08-18 (TC-STS-08-18-01): ตรวจสอบการทำงานของตัวกรองโรงเรียน
//    - TS-STS-08-19 (TC-STS-08-19-01): ตรวจสอบการทำงานของปุ่มตัวกรองเพิ่มเติมและตั้งเงื่อนไข
//    - TS-STS-08-20 (TC-STS-08-20-02): ตรวจสอบการแสดงผลพื้นที่เฝ้าระวัง (รายอำเภอ) เมื่อกดดูรายละเอียดรายอำเภอ
//    - TS-STS-08-21 (TC-STS-08-21-01 & TC-STS-08-21-03): ตรวจสอบ Heatmap ความหนาแน่นเคสรายตำบล และการไม่เปิดเผยข้อมูลรายบุคคล
//    - TS-STS-08-22 (TC-STS-08-22-01 & TC-STS-08-22-02): ตรวจสอบตารางเปรียบเทียบระหว่างโรงเรียน และการส่งออกข้อมูล
//    - TS-STS-08-23 (TC-STS-08-23-01): ตรวจสอบการแสดงผลระดับความรุนแรงของเคส (สรุปจังหวัด) จำนวนและสัดส่วนเคส
// ==============================================================
import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-00: Province Officer UAT All-in-One Suite (เจ้าหน้าที่จังหวัด)", () => {
  test("TC-STS-PROVINCE-COMPLETE-E2E: Province Officer Complete UAT Workflow (Single Function All-in-One)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS["province-officer"];

    // =========================================================================
    // 1. เข้าสู่ระบบ (Login) — TS-STS-01-03 & TS-STS-01-04
    // =========================================================================
    await test.step("TS-STS-01-03 (TC-STS-01-03-05): ตรวจสอบการแสดงสถานะผู้ใช้ เมื่อเข้าสู่ระบบด้วยสถานะเจ้าหน้าที่จังหวัด", async () => {
      await loginPage.goto();
      await loginPage.login(creds.username, creds.password);

      await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
      await page.bringToFront();

      // ตรวจสอบปุ่มเมนูผู้ใช้ด้านบนขวา แสดงชื่อผู้ใช้และสถานะ "เจ้าหน้าที่จังหวัด"
      const userMenuBtn = page.locator("#topbar-user-menu");
      await expect(userMenuBtn).toBeVisible({ timeout: 10_000 });
      await expect(userMenuBtn).toContainText("เจ้าหน้าที่จังหวัด");
      await expect(userMenuBtn).toContainText(/province_officer|UAT User/i);
    });

    await test.step("TS-STS-01-04 (TC-STS-01-04-05): ตรวจสอบการแสดงผลข้อมูล เมื่อเข้าสู่ระบบด้วยสถานะเจ้าหน้าที่จังหวัด", async () => {
      // เปลี่ยนหน้าไปยังแดชบอร์ดจังหวัดทันทีหลังเข้าสู่ระบบ
      await expect(page).toHaveURL(/\/province\/dashboard/);

      // ตรวจสอบส่วนหัวของแดชบอร์ดจังหวัด
      const dashboardHeader = page.locator("header.province-dashboard-header");
      await expect(dashboardHeader).toBeVisible();
      await expect(dashboardHeader).toContainText(/ชลบุรี/);
      await expect(dashboardHeader).toContainText(/เขตสพป\. ชลบุรี เขต 1/);

      // ตรวจสอบการ์ดสรุปภาพรวมจังหวัดทั้ง 4 รายการ
      const summaryItems = page.locator(".province-summary-item");
      await expect(summaryItems).toHaveCount(4);
      await expect(summaryItems.filter({ hasText: "โรงเรียน" })).toContainText("16");
      await expect(summaryItems.filter({ hasText: "นักเรียนรวม" })).toContainText("2,150");
      await expect(summaryItems.filter({ hasText: "Student Case" })).toContainText("38");
      await expect(summaryItems.filter({ hasText: "เคสระดับสูง" })).toContainText("8");
    });

    // =========================================================================
    // 2. ดูแดชบอร์ด (Dashboard) — TS-STS-08-18 ถึง TS-STS-08-23
    // =========================================================================
    await test.step("TS-STS-08-18 (TC-STS-08-18-01): ตรวจสอบการทำงานของตัวกรองโรงเรียน", async () => {
      const schoolFilterBtn = page.locator("#province-school-filter");
      await expect(schoolFilterBtn).toBeVisible();
      await expect(schoolFilterBtn).toContainText("ทุกโรงเรียน");

      // เปิด Dropdown ตัวกรองโรงเรียน
      await schoolFilterBtn.click();
      const options = page.locator('[role="option"]');
      await expect(options.first()).toBeVisible();
      await expect(options.filter({ hasText: "ทุกโรงเรียน" })).toBeVisible();
      await expect(options.filter({ hasText: "โรงเรียนทดสอบ เอ (ชลบุรี)" })).toBeVisible();
      await expect(options.filter({ hasText: "โรงเรียนทดสอบ บี (ชลบุรี)" })).toBeVisible();
      await expect(options.filter({ hasText: "โรงเรียนชลบุรีวิทยา" })).toBeVisible();

      // เลือก "โรงเรียนทดสอบ เอ (ชลบุรี)" ตาม Test Data ใน UAT Sheet
      const filterResponsePromise = page.waitForResponse(
        (res) =>
          res.url().includes("/api/dashboard/province") &&
          res.url().includes("schoolId=1") &&
          res.status() === 200,
      );
      await options.filter({ hasText: "โรงเรียนทดสอบ เอ (ชลบุรี)" }).click();
      await filterResponsePromise;

      // ตรวจสอบว่าแสดงปุ่มกลับสู่ภาพรวมเขตและข้อมูลอัปเดตตามโรงเรียนที่เลือก
      await expect(schoolFilterBtn).toContainText("โรงเรียนทดสอบ เอ (ชลบุรี)");
      const backToOverviewBtn = page.getByRole("button", { name: /กลับสู่ภาพรวม/i });
      await expect(backToOverviewBtn).toBeVisible();

      const summaryItems = page.locator(".province-summary-item");
      await expect(summaryItems.filter({ hasText: "โรงเรียน" })).toContainText("1");
      await expect(summaryItems.filter({ hasText: "นักเรียนรวม" })).toContainText("550");
      await expect(summaryItems.filter({ hasText: "Student Case" })).toContainText("10");
      await page.waitForTimeout(1000);

      // กดปุ่ม "กลับสู่ภาพรวมเขต" เพื่อล้างตัวกรองโรงเรียนกลับเป็นค่าเริ่มต้น (ทุกโรงเรียน)
      await backToOverviewBtn.click();
      await expect(schoolFilterBtn).toContainText("ทุกโรงเรียน");
      await expect(summaryItems.filter({ hasText: "โรงเรียน" })).toContainText("16");
      await expect(summaryItems.filter({ hasText: "Student Case" })).toContainText("38");
    });

    await test.step("TS-STS-08-19 (TC-STS-08-19-01): ตรวจสอบการทำงานของปุ่มตัวกรองเพิ่มเติมและตั้งเงื่อนไข", async () => {
      // 1. กดปุ่ม "ตัวกรองเพิ่มเติม"
      const moreFiltersBtn = page.locator(".dashboard-filter-trigger");
      await expect(moreFiltersBtn).toBeVisible();
      await moreFiltersBtn.click();

      const filterDialog = page.locator('[role="dialog"][aria-label="ตัวกรองเพิ่มเติม"]');
      await expect(filterDialog).toBeVisible();

      // 2. กดเลือก dropdown ปีการศึกษา -> เลือก "2569"
      const academicYearPopover = filterDialog.locator("#filter-academic-year-popover");
      await academicYearPopover.click();
      await page.locator('[role="option"]').filter({ hasText: "2569" }).first().click();
      await expect(academicYearPopover).toContainText("2569");

      // 3. กดปุ่ม "30 วันล่าสุด"
      const last30DaysBtn = filterDialog.getByRole("button", { name: "30 วันล่าสุด" });
      await last30DaysBtn.click();

      // 4. กดเลือก dropdown ระดับความรุนแรง -> เลือก "น้อย"
      const severityPopover = filterDialog.locator("#filter-severity-popover");
      await severityPopover.click();
      await page.locator('[role="option"]').filter({ hasText: /^น้อย$/ }).first().click();
      await expect(severityPopover).toContainText("น้อย");

      // 5. กดเลือก dropdown สถานะเคส -> เลือก "รอผู้อำนวยการ"
      const caseStatusPopover = filterDialog.locator("#filter-case-status-popover");
      await caseStatusPopover.click();
      await page.locator('[role="option"]').filter({ hasText: "รอผู้อำนวยการ" }).first().click();
      await expect(caseStatusPopover).toContainText("รอผู้อำนวยการ");

      // 6. กดปุ่ม "นำไปใช้" และตรวจสอบพารามิเตอร์ที่ส่งไปกับ API
      const applyFilterResponsePromise = page.waitForResponse(
        (res) =>
          res.url().includes("/api/dashboard/province") &&
          res.url().includes("academicYear=2569") &&
          res.url().includes("severity=LOW") &&
          res.url().includes("caseStatus=WAITING_DIRECTOR") &&
          res.status() === 200,
      );
      await filterDialog.getByRole("button", { name: "นำไปใช้" }).click();
      await applyFilterResponsePromise;

      // ตรวจสอบว่า Dialog ปิดลง และแสดงจำนวนตัวกรองที่ใช้งาน (5 รายการ: ปีการศึกษา, วันเริ่มต้น, วันสิ้นสุด, ระดับความรุนแรง, สถานะเคส)
      await expect(filterDialog).toBeHidden();
      await expect(page.locator(".dashboard-filter-badge")).toContainText("5");
      const activeFilterSummary = page.locator(".province-active-filter-summary");
      await expect(activeFilterSummary).toBeVisible();
      await expect(activeFilterSummary).toContainText("ใช้ตัวกรอง 5 รายการ");

      // ตรวจสอบว่ายอด Student Case อัปเดตตามตัวกรองระดับความรุนแรง "น้อย" (18 เคส)
      const summaryItems = page.locator(".province-summary-item");
      await expect(summaryItems.filter({ hasText: "Student Case" })).toContainText("18");
      await page.waitForTimeout(1000);

      // ล้างตัวกรองเพื่อคืนค่าสำหรับการทดสอบหัวข้อถัดไป
      await activeFilterSummary.getByRole("button", { name: "ล้างตัวกรอง" }).click();
      await expect(summaryItems.filter({ hasText: "Student Case" })).toContainText("38");
    });

    await test.step("TS-STS-08-20 (TC-STS-08-20-02): ตรวจสอบการแสดงผลพื้นที่เฝ้าระวัง (รายอำเภอ) เมื่อกดดูรายละเอียดรายอำเภอ", async () => {
      const zoneSection = page.locator('section[aria-labelledby="zone-map-title"]');
      await zoneSection.scrollIntoViewIfNeeded();
      await expect(zoneSection).toBeVisible();
      await expect(zoneSection.locator("#zone-map-title")).toContainText("พื้นที่เฝ้าระวัง");

      const zoneButtons = zoneSection.locator("button.province-zone-button");
      await expect(zoneButtons).toHaveCount(2);

      const mueangBtn = zoneButtons.filter({ hasText: "เมืองชลบุรี" });
      const banglamungBtn = zoneButtons.filter({ hasText: "บางละมุง" });
      await expect(mueangBtn).toBeVisible();
      await expect(mueangBtn).toContainText("28 เคส");
      await expect(banglamungBtn).toBeVisible();
      await expect(banglamungBtn).toContainText("10 เคส");

      // กดปุ่มรายการอำเภอ "บางละมุง" ตาม Test Step ใน UAT Sheet
      await banglamungBtn.click();
      await expect(banglamungBtn).toHaveAttribute("aria-pressed", "true");
      await expect(banglamungBtn).toHaveAttribute("data-selected", "true");
      await expect(banglamungBtn).toContainText("เลือกอยู่");

      // ตรวจสอบ Filter Chip แสดง "พื้นที่: บางละมุง"
      const zoneFilterChip = page.locator(".province-dashboard-filter-chip");
      await expect(zoneFilterChip).toBeVisible();
      await expect(zoneFilterChip).toContainText("พื้นที่: บางละมุง");

      // ตรวจสอบการแสดงรายละเอียดตำบลภายในอำเภอบางละมุง (หัวข้ออำเภอบางละมุง 10 เคส · 2 ตำบล พร้อมตำบลหนองปรือและนาเกลือ)
      const banglamungHeading = page.getByRole("heading", { name: "บางละมุง", level: 3 });
      await banglamungHeading.scrollIntoViewIfNeeded();
      await expect(banglamungHeading).toBeVisible();
      await expect(page.getByText("10 เคส · 2 ตำบล")).toBeVisible();
      await expect(page.locator('[title*="หนองปรือ:"]').first()).toBeVisible();
      await expect(page.locator('[title*="นาเกลือ:"]').first()).toBeVisible();

      // ตรวจสอบว่าตารางเปรียบเทียบโรงเรียนกรองแสดงเฉพาะโรงเรียนในอำเภอบางละมุง ("โรงเรียนทดสอบ เอ (ชลบุรี)")
      const comparisonTable = page.locator("table.province-school-table");
      await comparisonTable.scrollIntoViewIfNeeded();
      const schoolRows = comparisonTable.locator("tbody tr");
      await expect(schoolRows).toHaveCount(1);
      await expect(schoolRows.first()).toContainText("โรงเรียนทดสอบ เอ (ชลบุรี)");
      await page.waitForTimeout(1000);

      // ล้างตัวกรองพื้นที่อำเภอเพื่อแสดงทุกอำเภอตามเดิม
      await zoneFilterChip.scrollIntoViewIfNeeded();
      await zoneFilterChip.getByRole("button", { name: "ล้างตัวกรอง" }).click();
      await expect(banglamungBtn).toHaveAttribute("aria-pressed", "false");
      await expect(schoolRows).toHaveCount(4);
    });

    await test.step("TS-STS-08-21 (TC-STS-08-21-01 & TC-STS-08-21-03): ตรวจสอบการแสดงผล Heatmap ความหนาแน่นเคสรายตำบล และการคุ้มครองข้อมูลส่วนบุคคล", async () => {
      // TC-STS-08-21-01: ตรวจสอบระดับความเข้มของสีตามจำนวนเคส
      const heatmapHeading = page.getByRole("heading", {
        name: /Heatmap ความหนาแน่นเคสรายตำบล/i,
      });
      await heatmapHeading.scrollIntoViewIfNeeded();
      await expect(heatmapHeading).toBeVisible();

      const densityLegend = page.locator('[aria-label="ระดับความหนาแน่นเคส"]');
      await expect(densityLegend).toBeVisible();
      await expect(densityLegend).toContainText("น้อย");
      await expect(densityLegend).toContainText("มาก");

      // ตรวจสอบกล่องตำบลใน Heatmap ทั้ง 4 ตำบลที่มีจำนวนเคสแตกต่างกัน
      const saensukCell = page.locator('[title*="แสนสุข:"]').first();
      const nongprueCell = page.locator('[title*="หนองปรือ:"]').first();
      const bansuanCell = page.locator('[title*="บ้านสวน:"]').first();
      const naklueaCell = page.locator('[title*="นาเกลือ:"]').first();

      await expect(saensukCell).toBeVisible();
      await expect(nongprueCell).toBeVisible();
      await expect(bansuanCell).toBeVisible();
      await expect(naklueaCell).toBeVisible();

      // ตรวจสอบว่าระดับความเข้มของสีพื้นหลังแตกต่างกันตามจำนวนเคส (แสนสุข 22 เคส เข้มกว่า นาเกลือ 3 เคส)
      const saensukStyle = (await saensukCell.getAttribute("style")) || "";
      const naklueaStyle = (await naklueaCell.getAttribute("style")) || "";
      expect(saensukStyle).toContain("background:");
      expect(naklueaStyle).toContain("background:");
      expect(saensukStyle).not.toEqual(naklueaStyle);

      // TC-STS-08-21-03: ตรวจสอบว่าไม่มีการเปิดเผยข้อมูลรายบุคคลจาก Heatmap
      await saensukCell.hover();
      await saensukCell.click();
      await nongprueCell.hover();
      await naklueaCell.hover();
      await page.waitForTimeout(800);

      await expect(
        page.getByText(/ข้อมูลเชิงพื้นที่รวมกลุ่มระดับตำบลเพื่อคุ้มครองความเป็นส่วนตัว/i),
      ).toBeVisible();

      const heatmapCardText =
        (await heatmapHeading.locator("xpath=ancestor::div[contains(@class,'card')][1]").textContent()) ||
        "";
      // ต้องไม่มีชื่อนักเรียนรายบุคคลหรือเลขประจำตัวประชาชน 13 หลักปรากฏใน Heatmap
      expect(heatmapCardText).not.toMatch(/กิตติพงษ์|ชาญชัย|ด\.ช\.|ด\.ญ\.|นาย|นางสาว/);
      expect(heatmapCardText).not.toMatch(/\b\d{13}\b/);
    });

    await test.step("TS-STS-08-23 (TC-STS-08-23-01): ตรวจสอบการแสดงผลระดับความรุนแรงของเคส (สรุปจังหวัด) จำนวนและสัดส่วนเคสตามระดับ (น้อย/ปานกลาง/สูง)", async () => {
      const severitySection = page.locator('section[aria-labelledby="severity-title"]');
      await severitySection.scrollIntoViewIfNeeded();
      await expect(severitySection).toBeVisible();
      await expect(severitySection.locator("#severity-title")).toContainText(
        "ระดับความรุนแรงของเคส",
      );

      // ตรวจสอบยอดเคสทั้งหมดในส่วนสรุปความรุนแรง
      const totalCasesEl = severitySection.locator(".province-severity-total strong");
      await expect(totalCasesEl).toHaveText("38");

      // ตรวจสอบแถบสัดส่วนเคสทั้ง 3 ระดับ (น้อย / ปานกลาง / สูง)
      const severityTrack = severitySection.locator(
        '.province-severity-track[aria-label="สัดส่วน Student Case"]',
      );
      await expect(severityTrack).toBeVisible();
      await expect(severityTrack.locator('.province-severity-segment[data-tone="low"]')).toBeVisible();
      await expect(severityTrack.locator('.province-severity-segment[data-tone="medium"]')).toBeVisible();
      await expect(severityTrack.locator('.province-severity-segment[data-tone="high"]')).toBeVisible();

      // ตรวจสอบตัวเลขจำนวนเคสในแต่ละระดับ และคำนวณผลรวมว่าตรงกับเคสทั้งหมด (18 + 12 + 8 = 38)
      const lowItem = severitySection.locator('.province-severity-list li[data-tone="low"] strong');
      const mediumItem = severitySection.locator(
        '.province-severity-list li[data-tone="medium"] strong',
      );
      const highItem = severitySection.locator('.province-severity-list li[data-tone="high"] strong');

      await expect(lowItem).toHaveText("18");
      await expect(mediumItem).toHaveText("12");
      await expect(highItem).toHaveText("8");

      const lowCount = Number((await lowItem.textContent())?.trim() || 0);
      const mediumCount = Number((await mediumItem.textContent())?.trim() || 0);
      const highCount = Number((await highItem.textContent())?.trim() || 0);
      const totalCount = Number((await totalCasesEl.textContent())?.trim() || 0);
      expect(lowCount + mediumCount + highCount).toBe(totalCount);
      await page.waitForTimeout(1000);
    });

    await test.step("TS-STS-08-22 (TC-STS-08-22-01 & TC-STS-08-22-02): ตรวจสอบการแสดงผลเปรียบเทียบระหว่างโรงเรียน และการส่งออกข้อมูลตารางเปรียบเทียบ", async () => {
      // TC-STS-08-22-01: ตรวจสอบข้อมูลตารางเปรียบเทียบนักเรียน/เคส/ขาดเฉลี่ย
      const comparisonSection = page.locator('section[aria-labelledby="school-comparison-title"]');
      await comparisonSection.scrollIntoViewIfNeeded();
      await expect(comparisonSection).toBeVisible();
      await expect(comparisonSection.locator("#school-comparison-title")).toContainText(
        "เปรียบเทียบระหว่างโรงเรียน",
      );

      // ตรวจสอบไอคอนที่หัวตารางเปรียบเทียบระหว่างโรงเรียน
      await expect(comparisonSection.locator("header svg").first()).toBeVisible();

      const comparisonTable = comparisonSection.locator("table.province-school-table");
      await comparisonTable.scrollIntoViewIfNeeded();
      await expect(comparisonTable).toBeVisible();

      // ตรวจสอบคอลัมน์หัวตาราง: โรงเรียน, นักเรียน, เคส, ขาดเฉลี่ย
      const headers = comparisonTable.locator("thead th");
      await expect(headers.nth(0)).toContainText("โรงเรียน");
      await expect(headers.nth(1)).toContainText("นักเรียน");
      await expect(headers.nth(2)).toContainText("เคส");
      await expect(headers.nth(3)).toContainText("ขาดเฉลี่ย");

      // ตรวจสอบข้อมูลในตารางแต่ละโรงเรียน (ชื่อโรงเรียน, นักเรียน, เคส, ขาดเฉลี่ย) รวมทั้ง โรงเรียนทดสอบ เอ และ โรงเรียนทดสอบ บี ตาม Test Data
      const rows = comparisonTable.locator("tbody tr");
      await expect(rows).toHaveCount(4);

      const chonburiRow = rows.filter({ hasText: "โรงเรียนชลบุรีวิทยา" });
      await expect(chonburiRow).toContainText("1,200");
      await expect(chonburiRow).toContainText("22");
      await expect(chonburiRow).toContainText("4.5%");

      const testARow = rows.filter({ hasText: "โรงเรียนทดสอบ เอ (ชลบุรี)" });
      await expect(testARow).toContainText("550");
      await expect(testARow).toContainText("10");
      await expect(testARow).toContainText("3.9%");

      const testBRow = rows.filter({ hasText: "โรงเรียนทดสอบ บี (ชลบุรี)" });
      await expect(testBRow).toContainText("250");
      await expect(testBRow).toContainText("4");
      await expect(testBRow).toContainText("3.5%");

      const sampleRow = rows.filter({ hasText: "โรงเรียนตัวอย่างทดสอบ" });
      await expect(sampleRow).toContainText("150");
      await expect(sampleRow).toContainText("2");
      await expect(sampleRow).toContainText("3.2%");
      await page.waitForTimeout(1200);

      // TC-STS-08-22-02: ตรวจสอบการส่งออกข้อมูลรายงานและตารางเปรียบเทียบระหว่างโรงเรียน (PDF / Excel)
      await page.goto("/province/reports");
      await expect(page).toHaveURL(/\/province\/reports/);

      await expect(
        page.getByText(/รายงานระดับเขต|รายงานระดับจังหวัด|รายงานเขต/i).first(),
      ).toBeVisible();
      await expect(page.getByText(/ไม่มีข้อมูลนักเรียนรายบุคคล/i).first()).toBeVisible();

      // 1) ทดสอบแท็บ "เปรียบเทียบโรงเรียน" และการส่งออกตารางเปรียบเทียบระหว่างโรงเรียน
      const compTab = page.getByRole("tab", { name: /เปรียบเทียบโรงเรียน/i });
      await expect(compTab).toBeVisible();
      await compTab.click();
      await expect(compTab).toHaveAttribute("aria-selected", "true");

      const compPanel = page.locator("#panel-comparison");
      await expect(compPanel).toBeVisible();

      const generateCompBtn = compPanel.locator("#generate-comp-btn").first();
      await expect(generateCompBtn).toBeVisible();

      const crossSchoolResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/reports/cross-school") && res.status() === 200,
      );
      await generateCompBtn.click();
      await crossSchoolResponsePromise;

      // ตรวจสอบว่าแสดงข้อมูลเปรียบเทียบระหว่างโรงเรียนและปุ่มส่งออก PDF / Excel
      await expect(compPanel).toContainText(/โรงเรียนทดสอบ เอ \(ชลบุรี\)/);
      await expect(compPanel).toContainText(/โรงเรียนทดสอบ บี \(ชลบุรี\)/);

      const exportCompPdfBtn = compPanel.locator("#export-pdf-btn");
      const exportCompExcelBtn = compPanel.locator("#export-excel-btn");
      await expect(exportCompPdfBtn).toBeVisible();
      await expect(exportCompExcelBtn).toBeVisible();

      const compPdfExportPromise = page.waitForResponse(
        (res) => res.url().includes("/api/reports") && res.url().includes("export") && res.status() === 200,
      );
      await exportCompPdfBtn.click();
      await compPdfExportPromise;

      const compExcelExportPromise = page.waitForResponse(
        (res) => res.url().includes("/api/reports") && res.url().includes("export") && res.status() === 200,
      );
      await exportCompExcelBtn.click();
      await compExcelExportPromise;

      // 2) ทดสอบแท็บ "สร้างรายงาน" (Report Builder) และการส่งออก PDF / Excel
      const builderTab = page.getByRole("tab", { name: /สร้างรายงาน/i });
      await builderTab.click();
      await expect(builderTab).toHaveAttribute("aria-selected", "true");

      const createPanel = page.locator("#panel-create, #panel-builder").first();
      await expect(createPanel).toBeVisible();

      const generateReportBtn = createPanel.locator("#generate-report-btn").first();
      await expect(generateReportBtn).toBeVisible();
      await generateReportBtn.click();

      const exportReportPdfBtn = createPanel.locator("#export-pdf-btn");
      const exportReportExcelBtn = createPanel.locator("#export-excel-btn");
      await expect(exportReportPdfBtn).toBeVisible();
      await expect(exportReportExcelBtn).toBeVisible();

      const builderPdfPromise = page.waitForResponse(
        (res) => res.url().includes("/api/reports") && res.url().includes("export") && res.status() === 200,
      );
      await exportReportPdfBtn.click();
      await builderPdfPromise;

      const builderExcelPromise = page.waitForResponse(
        (res) => res.url().includes("/api/reports") && res.url().includes("export") && res.status() === 200,
      );
      await exportReportExcelBtn.click();
      await builderExcelPromise;
    });

    // =========================================================================
    // 3. ออกจากระบบ (Logout) และยืนยันไม่มี Runtime Page Error
    // =========================================================================
    await test.step("ออกจากระบบ (Logout) และตรวจสอบความสมบูรณ์ของระบบ", async () => {
      const userMenuBtn = page.locator("#topbar-user-menu");
      await expect(userMenuBtn).toBeVisible();
      await userMenuBtn.click();

      const logoutMenuItem = page.getByRole("menuitem", { name: /ออกจากระบบ/i });
      await expect(logoutMenuItem).toBeVisible();
      await logoutMenuItem.click();

      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      expect(pageErrors).toHaveLength(0);
    });
  });
});
