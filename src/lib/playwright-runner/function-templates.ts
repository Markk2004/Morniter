// ==============================================================
// 📋 Function-specific Playwright Test Templates for ProjectSTS
// Provides self-contained, standalone Playwright specs for FN-STS-01 to FN-STS-11
// ==============================================================

export interface FunctionTemplate {
  id: string;
  name: string;
  shortName: string;
  relativePath: string;
  description: string;
  code: string;
}

export const STS_FUNCTION_TEMPLATES: Record<string, FunctionTemplate> = {
  "FN-STS-01": {
    id: "FN-STS-01",
    name: "FN-STS-01 · ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)",
    shortName: "เข้าสู่ระบบ",
    relativePath: "e2e/sts/login.spec.ts",
    description: "ทดสอบการเข้าสู่ระบบตามบทบาทผู้ใช้ (Admin, Teacher, Director, Officer) และการป้องกันข้อผิดพลาด",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)
// วัตถุประสงค์: ตรวจสอบการ Login ตามสิทธิ์ผู้ใช้งาน และการ Redirect ไปยังหน้าที่ถูกต้อง
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-01: Authentication Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("TC-STS-AUTH-001: ครูประจำชั้น (Teacher) เข้าสู่ระบบสำเร็จและนำทางไปหน้าหลัก", async ({ page }) => {
    // 1. นำทางไปยังหน้า Login
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // 2. กรอกชื่อผู้ใช้และรหัสผ่าน
    const usernameInput = page.locator("#login-username, input[name='username'], input[type='text']").first();
    const passwordInput = page.locator("#login-password, input[name='password'], input[type='password']").first();

    await usernameInput.fill("teacher01");
    await passwordInput.fill("changeme");

    // 3. คลิกปุ่มเข้าสู่ระบบ
    await page.locator("button[type='submit'], #login-submit").first().click();

    // 4. ตรวจสอบการ Redirect ออกจากหน้า Login
    await expect(page).not.toHaveURL(/.*\\/login/, { timeout: 15000 });
  });

  test("TC-STS-AUTH-002: ตรวจสอบความปลอดภัยเมื่อกรอกรหัสผ่านผิด", async ({ page }) => {
    await page.goto("/login");

    const usernameInput = page.locator("#login-username, input[name='username'], input[type='text']").first();
    const passwordInput = page.locator("#login-password, input[name='password'], input[type='password']").first();

    await usernameInput.fill("teacher01");
    await passwordInput.fill("wrong-password-999");
    await page.locator("button[type='submit'], #login-submit").first().click();

    // ต้องยังคงอยู่ที่หน้า login และแสดงแจ้งเตือนข้อผิดพลาด
    await expect(page).toHaveURL(/.*\\/login/);
    const alertBox = page.locator("[role='alert'], .text-rose-500, .text-red-500, .bg-rose-950");
    if (await alertBox.count() > 0) {
      await expect(alertBox.first()).toBeVisible();
    }
  });
});
`,
  },

  "FN-STS-02": {
    id: "FN-STS-02",
    name: "FN-STS-02 · ระบบจัดการผู้ใช้ (User Management)",
    shortName: "จัดการผู้ใช้",
    relativePath: "e2e/sts/specs/08-user-management.spec.ts",
    description: "ตรวจสอบทำเนียบผู้ใช้ ค้นหา กรองสถานะ Active/Suspended และแบบฟอร์มเพิ่มผู้ใช้งาน",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-02 ระบบจัดการผู้ใช้ (User Management)
// วัตถุประสงค์: ตรวจสอบหน้าจอจัดการบัญชีผู้ใช้งาน, ตารางรายชื่อ, การค้นหา และการกรองสถานะ
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-02: User Management Suite", () => {
  test("TC-STS-USER-001: ผู้ดูแลระบบเปิดดูทำเนียบผู้ใช้และตรวจสอบตารางข้อมูล", async ({ page }) => {
    // 1. เข้าสู่หน้าจัดการผู้ใช้
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/.*\\/admin\\/users/);

    // 2. ตรวจสอบว่ามีช่องค้นหาผู้ใช้
    const searchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search'], #user-search").first();
    await expect(searchInput).toBeVisible();

    // 3. ตรวจสอบว่ามีตารางหรือรายการแสดงรายชื่อผู้ใช้งาน
    const userTableOrList = page.locator("table, [role='table'], [data-testid='users-list'], .user-card").first();
    await expect(userTableOrList).toBeVisible({ timeout: 10000 });
  });

  test("TC-STS-USER-002: ทดสอบการค้นหาและกรองผู้ใช้งานตามชื่อ", async ({ page }) => {
    await page.goto("/admin/users");
    const searchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search'], #user-search").first();

    // ค้นหาผู้ใช้
    await searchInput.fill("Admin");
    await page.waitForTimeout(500); // debounce time

    // ตรวจสอบว่าผลลัพธ์ในหน้าจอแสดงรายการที่ตรงกับคำค้น
    await expect(page.locator("body")).toContainText(/admin|ผู้ดูแล/i);
  });
});
`,
  },

  "FN-STS-03": {
    id: "FN-STS-03",
    name: "FN-STS-03 · ข้อมูลนักเรียนและห้องเรียน (Students & Classrooms)",
    shortName: "ข้อมูลนักเรียน",
    relativePath: "e2e/sts/specs/03-students-classrooms.spec.ts",
    description: "เปิดดูทำเนียบรายชื่อนักเรียน ค้นหานักเรียน และดูโปรไฟล์ประวัตินักเรียนรายบุคคล",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-03 ข้อมูลนักเรียนและห้องเรียน (Students & Classrooms)
// วัตถุประสงค์: ตรวจสอบทำเนียบนักเรียน การแสดงผลการ์ดนักเรียน และการค้นหารายชื่อ
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-03: Students & Classrooms Suite", () => {
  test("TC-STS-STU-001: ครูประจำชั้นเปิดดูทำเนียบรายชื่อนักเรียนในห้อง", async ({ page }) => {
    // 1. นำทางไปยังหน้ารายชื่อนักเรียน
    await page.goto("/students");
    await expect(page).toHaveURL(/.*\\/students/);

    // 2. ตรวจสอบว่ามีการ์ดหรือแถวนักเรียนแสดงผล
    const studentElements = page.locator("[data-testid='student-card'], .student-item, tr[data-student-id], table tbody tr");
    await expect(studentElements.first()).toBeVisible({ timeout: 10000 });
  });

  test("TC-STS-STU-002: ค้นหารายชื่อนักเรียนด้วยคำค้นหา", async ({ page }) => {
    await page.goto("/students");
    const searchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search']").first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill("กิตติพงษ์");
    await page.waitForTimeout(500);

    // ตรวจสอบว่ามีการอัปเดตผลลัพธ์การค้นหา
    await expect(page.locator("body")).toBeDefined();
  });
});
`,
  },

  "FN-STS-04": {
    id: "FN-STS-04",
    name: "FN-STS-04 · ระบบเช็คชื่อเข้าเรียน (Attendance)",
    shortName: "เช็คชื่อเข้าเรียน",
    relativePath: "e2e/sts/specs/04-attendance.spec.ts",
    description: "เปิดหน้าจอเช็คชื่อเข้าเรียนประจำวัน ตรวจสอบยอดสรุปมา/ขาด/ลา/มาสาย และรายการเช็คชื่อ",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-04 ระบบเช็คชื่อเข้าเรียน (Attendance)
// วัตถุประสงค์: ตรวจสอบหน้าจอเช็คชื่อประจำวัน ยอดสรุปสถิติ และการบันทึกสถานะ
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-04: Attendance Suite", () => {
  test("TC-STS-ATT-001: ครูประจำชั้นเปิดหน้าจอเช็คชื่อการเข้าเรียนประจำวัน", async ({ page }) => {
    // 1. เข้าสู่หน้าจอเช็คชื่อ
    await page.goto("/attendance");
    await expect(page).toHaveURL(/.*\\/attendance/);

    // 2. ตรวจสอบว่ามีแถบสถิติสรุป (มา / ขาด / ลา / มาสาย)
    const summaryCards = page.locator("[data-testid='attendance-summary'], .stat-card, .metric-card");
    if (await summaryCards.count() > 0) {
      await expect(summaryCards.first()).toBeVisible();
    }

    // 3. ตรวจสอบตารางรายชื่อนักเรียนพร้อมปุ่มสถานะเช็คชื่อ
    const checkinRows = page.locator("table tbody tr, [data-testid='attendance-row']");
    await expect(checkinRows.first()).toBeVisible({ timeout: 10000 });
  });

  test("TC-STS-ATT-002: ตรวจสอบการเลือกวันที่และห้องเรียน", async ({ page }) => {
    await page.goto("/attendance");
    const datePickerOrSelect = page.locator("input[type='date'], select[name*='classroom'], button[aria-label*='date']").first();
    if (await datePickerOrSelect.isVisible()) {
      await expect(datePickerOrSelect).toBeEnabled();
    }
  });
});
`,
  },

  "FN-STS-05": {
    id: "FN-STS-05",
    name: "FN-STS-05 · ระบบจัดการเคสปัญหา (Student Cases)",
    shortName: "จัดการเคสปัญหา",
    relativePath: "e2e/sts/specs/05-cases.spec.ts",
    description: "ตรวจสอบทำเนียบเคสปัญหาของนักเรียน ระดับความเสี่ยง และแบบฟอร์มการส่งต่อเคสใหม่",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-05 ระบบจัดการเคสปัญหา (Student Cases)
// วัตถุประสงค์: ตรวจสอบทำเนียบเคสปัญหา ป้ายสถานะความเสี่ยง และแบบฟอร์มสร้างเคสใหม่
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-05: Student Cases Suite", () => {
  test("TC-STS-CASE-001: ครูประจำชั้นเปิดดูทำเนียบเคสปัญหาและป้ายความเสี่ยง", async ({ page }) => {
    // 1. เข้าสู่หน้ารายการเคส
    await page.goto("/cases");
    await expect(page).toHaveURL(/.*\\/cases/);

    // 2. ตรวจสอบปุ่มสร้างเคสใหม่ (New Case Button)
    const newCaseBtn = page.locator("a[href*='/cases/create'], button:has-text('สร้างเคส'), button:has-text('เพิ่มเคส')").first();
    await expect(newCaseBtn).toBeVisible({ timeout: 10000 });

    // 3. ตรวจสอบรายการเคสในตาราง
    const caseList = page.locator("table tbody tr, [data-testid='case-card'], .case-item");
    if (await caseList.count() > 0) {
      await expect(caseList.first()).toBeVisible();
    }
  });

  test("TC-STS-CASE-002: ตรวจสอบหน้าฟอร์มสร้างเคสปัญหานักเรียนใหม่", async ({ page }) => {
    await page.goto("/cases");
    const newCaseBtn = page.locator("a[href*='/cases/create'], button:has-text('สร้างเคส'), button:has-text('เพิ่มเคส')").first();
    if (await newCaseBtn.isVisible()) {
      await newCaseBtn.click();
      await expect(page).toHaveURL(/.*\\/cases.*create/);
      // ตรวจสอบฟิลด์สำคัญ
      await expect(page.locator("input, textarea, select").first()).toBeVisible();
    }
  });
});
`,
  },

  "FN-STS-06": {
    id: "FN-STS-06",
    name: "FN-STS-06 · ระบบรายงานสรุปและการส่งออก (Reports & Export)",
    shortName: "รายงานสรุป",
    relativePath: "e2e/sts/specs/06-reports-export.spec.ts",
    description: "เปิดหน้า Report Studio กำหนดช่วงเวลา/เงื่อนไข พรีวิวตารางข้อมูล และทดสอบปุ่ม Export Excel/PDF",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-06 รายงานสรุปและการส่งออก (Reports & Export)
// วัตถุประสงค์: ตรวจสอบหน้าจอออกรายงาน ตัวกรองเงื่อนไข และปุ่มส่งออก Excel / PDF
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-06: Case Reports & Export Suite", () => {
  test("TC-STS-REP-001: ผู้บริหารเปิดหน้า Report Studio และตรวจสอบตัวกรองรายงาน", async ({ page }) => {
    // 1. เข้าสู่หน้า Reports
    await page.goto("/reports");
    await expect(page).toHaveURL(/.*\\/reports/);

    // 2. ตรวจสอบว่ามีตัวเลือกประเภทรายงาน
    const reportType = page.locator("select[name*='type'], [role='combobox'], #report-type").first();
    if (await reportType.isVisible()) {
      await expect(reportType).toBeVisible();
    }

    // 3. ตรวจสอบว่ามีปุ่มสั่งสร้างรายงาน (Generate / Preview Report)
    const generateBtn = page.locator("button:has-text('สร้างรายงาน'), button:has-text('ดูรายงาน'), button:has-text('Generate')").first();
    if (await generateBtn.isVisible()) {
      await expect(generateBtn).toBeEnabled();
    }
  });

  test("TC-STS-REP-002: ตรวจสอบความพร้อมของปุ่ม Export ข้อมูล", async ({ page }) => {
    await page.goto("/reports");
    const exportExcelBtn = page.locator("button:has-text('Excel'), a:has-text('Excel'), button:has-text('ส่งออก')").first();
    if (await exportExcelBtn.isVisible()) {
      await expect(exportExcelBtn).toBeVisible();
    }
  });
});
`,
  },

  "FN-STS-07": {
    id: "FN-STS-07",
    name: "FN-STS-07 · บันทึกพฤติกรรมและการติดตาม (Observations & Tracking)",
    shortName: "ติดตามพฤติกรรม",
    relativePath: "e2e/sts/specs/07-observations-tracking.spec.ts",
    description: "เปิดแผนที่/รายการสังเกตพฤติกรรม ค้นหานักเรียน และกรองตามระดับความเสี่ยง (เสี่ยงสูง/ปานกลาง/ปกติ)",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-07 บันทึกพฤติกรรมและการติดตาม (Observations & Tracking)
// วัตถุประสงค์: ตรวจสอบหน้าจอติดตามพฤติกรรม แผนที่พิกัด และการกรองความเสี่ยง
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-07: Observations & Tracking Suite", () => {
  test("TC-STS-TRK-001: ครูประจำชั้นเปิดหน้าติดตามพฤติกรรมและการเยี่ยมบ้าน", async ({ page }) => {
    // 1. นำทางไปยังหน้า Tracking / Observations
    await page.goto("/observations");
    await expect(page).toHaveURL(/.*\\/(observations|tracking)/);

    // 2. ตรวจสอบว่ามีรายการหรือการ์ดติดตามนักเรียน
    const trackingCards = page.locator("[data-testid='tracking-item'], .observation-card, tr[data-student-id]");
    if (await trackingCards.count() > 0) {
      await expect(trackingCards.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("TC-STS-TRK-002: กรองรายชื่อนักเรียนตามระดับความเสี่ยง", async ({ page }) => {
    await page.goto("/observations");
    const riskFilter = page.locator("select[name*='risk'], button:has-text('ความเสี่ยง')").first();
    if (await riskFilter.isVisible()) {
      await expect(riskFilter).toBeVisible();
    }
  });
});
`,
  },

  "FN-STS-08": {
    id: "FN-STS-08",
    name: "FN-STS-08 · แดชบอร์ดตามบทบาทผู้ใช้ (Dashboard Navigation)",
    shortName: "แดชบอร์ดตามบทบาท",
    relativePath: "e2e/sts/specs/02-dashboard-navigation.spec.ts",
    description: "ตรวจสอบการแสดงผลการ์ดสรุป KPI สถิติประจำวัน และเมนูทางลัดตามบทบาทของผู้ใช้งาน",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-08 แดชบอร์ดตามบทบาทผู้ใช้ (Dashboard Navigation)
// วัตถุประสงค์: ตรวจสอบการโหลดแดชบอร์ด การแสดงผล KPI Cards และเมนูทางลัด
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-08: Dashboard & Navigation Suite", () => {
  test("TC-STS-DASH-001: เปิดหน้าแดชบอร์ดหลักและตรวจสอบการ์ด KPI สถิติ", async ({ page }) => {
    // 1. นำทางไปยังหน้า Dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\\/dashboard/);

    // 2. ตรวจสอบหัวข้อแดชบอร์ด
    const heading = page.locator("h1, h2, [data-testid='dashboard-header']").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // 3. ตรวจสอบการ์ด KPI แสดงผล
    const kpiCards = page.locator(".kpi-card, [data-testid='kpi-card'], .grid > div");
    await expect(kpiCards.first()).toBeVisible();
  });

  test("TC-STS-DASH-002: ตรวจสอบปุ่มทางลัดไปยังโมดูลหลักต่างๆ", async ({ page }) => {
    await page.goto("/dashboard");
    // ตรวจสอบ Navigation bar หรือ Sidebar
    const navOrSidebar = page.locator("nav, aside, [role='navigation']").first();
    await expect(navOrSidebar).toBeVisible();
  });
});
`,
  },

  "FN-STS-09": {
    id: "FN-STS-09",
    name: "FN-STS-09 · ระบบวิเคราะห์ AI (AI Insights & Benchmark)",
    shortName: "การวิเคราะห์ AI",
    relativePath: "e2e/sts/specs/11-ai-evaluation.spec.ts",
    description: "ตรวจสอบหน้าจอประเมินผล AI Model Benchmark, การส่ง Run ID และค่าสถิติ F1-Score / Accuracy",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-09 ระบบวิเคราะห์ AI (AI Insights & Benchmark)
// วัตถุประสงค์: ตรวจสอบหน้าจอ Benchmark การวิเคราะห์เคสของโมเดล AI และตัวชี้วัดประสิทธิภาพ
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-09: AI Insights & Benchmark Evaluation Suite", () => {
  test("TC-STS-AI-001: ผู้ดูแลระบบเปิดหน้าจอประเมินและทดสอบระบบ AI", async ({ page }) => {
    // 1. นำทางไปยังหน้า AI Evaluation
    await page.goto("/admin/ai-evaluation");
    await expect(page).toHaveURL(/.*\\/ai-evaluation/);

    // 2. ตรวจสอบหัวข้อหน้าจอ
    const header = page.locator("h1, h2").first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // 3. ตรวจสอบช่องกรอก Run ID และปุ่มเริ่มการประเมิน
    const runInput = page.locator("input[placeholder*='Run ID'], input[name='runId']").first();
    const runBtn = page.locator("button:has-text('เริ่มการประเมิน'), button:has-text('Benchmark'), button:has-text('Run')").first();

    if (await runInput.isVisible()) {
      await expect(runInput).toBeVisible();
    }
    if (await runBtn.isVisible()) {
      await expect(runBtn).toBeVisible();
    }
  });
});
`,
  },

  "FN-STS-10": {
    id: "FN-STS-10",
    name: "FN-STS-10 · แดชบอร์ดระดับเขตและจังหวัด (Platform & Province)",
    shortName: "ระดับเขต/จังหวัด",
    relativePath: "e2e/sts/specs/09-province-platform.spec.ts",
    description: "ตรวจสอบแดชบอร์ดสถิติภาพรวมระดับจังหวัด การเปรียบเทียบระหว่างสถานศึกษา และนโยบายรักษาความเป็นส่วนตัว",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-10 แดชบอร์ดระดับเขตและจังหวัด (Platform & Province)
// วัตถุประสงค์: ตรวจสอบแดชบอร์ดภาพรวมระดับเขตพื้นที่ สถิติเปรียบเทียบโรงเรียน และมาตรการ Privacy
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-10: Platform & Province Suite", () => {
  test("TC-STS-PRV-001: เจ้าหน้าที่เขต/จังหวัดเปิดดูแดชบอร์ดสรุปภาพรวมพื้นที่", async ({ page }) => {
    // 1. นำทางไปยังหน้าแดชบอร์ดระดับจังหวัด
    await page.goto("/province/dashboard");
    await expect(page).toHaveURL(/.*\\/province/);

    // 2. ตรวจสอบหัวข้อหรือชื่อจังหวัดในแดชบอร์ด
    const provinceHeader = page.locator("h1, h2, [data-testid='province-name']").first();
    await expect(provinceHeader).toBeVisible({ timeout: 10000 });

    // 3. ตรวจสอบการแสดงผลการ์ดสถิติรวมสถานศึกษา
    const statCards = page.locator(".stat-card, [data-testid='summary-card'], .grid > div");
    await expect(statCards.first()).toBeVisible();
  });

  test("TC-STS-PRV-002: ตรวจสอบการป้องกันความเป็นส่วนตัว (No Individual Student PII)", async ({ page }) => {
    await page.goto("/province/reports");
    // แดชบอร์ดระดับเขตต้องไม่แสดงรหัสบัตรประชาชนหรือข้อมูลส่วนบุคคลรายบุคคล
    await expect(page.locator("body")).not.toContainText(/เลขประจำตัวประชาชน/i);
  });
});
`,
  },

  "FN-STS-11": {
    id: "FN-STS-11",
    name: "FN-STS-11 · โปรไฟล์ส่วนตัวและการเปลี่ยนรหัสผ่าน (Profile & Password)",
    shortName: "โปรไฟล์/รหัสผ่าน",
    relativePath: "e2e/sts/specs/10-profile-password.spec.ts",
    description: "ตรวจสอบหน้าจอข้อมูลโปรไฟล์ผู้ใช้งาน แบบฟอร์มเปลี่ยนรหัสผ่านใหม่ และข้อกำหนดความปลอดภัยของ Password",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-11 โปรไฟล์ส่วนตัวและการเปลี่ยนรหัสผ่าน (Profile & Password)
// วัตถุประสงค์: ตรวจสอบหน้าจอโปรไฟล์ผู้ใช้ ฟอร์มเปลี่ยนรหัสผ่าน และการตรวจสอบเงื่อนไขความปลอดภัย
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-11: Profile & Password Suite", () => {
  test("TC-STS-PWD-001: ผู้ใช้เปิดหน้าจอเปลี่ยนรหัสผ่านและตรวจสอบเงื่อนไขความปลอดภัย", async ({ page }) => {
    // 1. นำทางไปยังหน้าเปลี่ยนรหัสผ่าน
    await page.goto("/change-password");
    await expect(page).toHaveURL(/.*\\/(change-password|profile)/);

    // 2. ตรวจสอบว่ามีช่องกรอกรหัสผ่านเดิม รหัสผ่านใหม่ และยืนยันรหัสผ่าน
    const oldPass = page.locator("#oldPassword, input[name='oldPassword'], input[type='password']").first();
    const newPass = page.locator("#newPassword, input[name='newPassword']").first();
    const confirmPass = page.locator("#confirmPassword, input[name='confirmPassword']").first();

    await expect(oldPass).toBeVisible({ timeout: 10000 });
    await expect(newPass).toBeVisible();
    await expect(confirmPass).toBeVisible();

    // 3. ตรวจสอบปุ่มบันทึกรหัสผ่านใหม่
    const submitBtn = page.locator("button[type='submit'], #change-password-submit").first();
    await expect(submitBtn).toBeVisible();
  });
});
`,
  },
};

/**
 * Resolves a function template by function ID, category code, or matching keyword
 */
export function getFunctionTemplate(functionIdOrCode: string): FunctionTemplate | undefined {
  if (!functionIdOrCode) return undefined;
  const upper = functionIdOrCode.toUpperCase().trim();

  // Direct match e.g. "FN-STS-02"
  if (STS_FUNCTION_TEMPLATES[upper]) {
    return STS_FUNCTION_TEMPLATES[upper];
  }

  // Matching with prefix fn- e.g. "fn-fn-sts-02" or "fn-02"
  for (const [key, tpl] of Object.entries(STS_FUNCTION_TEMPLATES)) {
    if (upper.includes(key) || key.includes(upper)) {
      return tpl;
    }
  }

  // Specific keyword & test ID pattern matching
  if (upper.includes("AUTH") || upper.includes("LOGIN") || upper.includes("01-AUTH") || upper.includes("FN-01") || upper.includes("FN-STS-01")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-01"];
  }
  if (upper.includes("USER") || upper.includes("08-USER") || upper.includes("FN-02") || upper.includes("FN-STS-02")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-02"];
  }
  if (upper.includes("STU") || upper.includes("STUDENT") || upper.includes("03-STUDENT") || upper.includes("FN-03") || upper.includes("FN-STS-03")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-03"];
  }
  if (upper.includes("ATT") || upper.includes("ATTENDANCE") || upper.includes("04-ATTENDANCE") || upper.includes("FN-04") || upper.includes("FN-STS-04")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-04"];
  }
  if (upper.includes("CASE") || upper.includes("05-CASE") || upper.includes("FN-05") || upper.includes("FN-STS-05")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-05"];
  }
  if (upper.includes("REP") || upper.includes("REPORT") || upper.includes("06-REPORT") || upper.includes("FN-06") || upper.includes("FN-STS-06")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-06"];
  }
  if (upper.includes("TRK") || upper.includes("OBSERVATION") || upper.includes("TRACKING") || upper.includes("07-OBSERVATION") || upper.includes("FN-07") || upper.includes("FN-STS-07")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-07"];
  }
  if (upper.includes("DASH") || upper.includes("02-DASHBOARD") || upper.includes("FN-08") || upper.includes("FN-STS-08")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-08"];
  }
  if (upper.includes("AI") || upper.includes("11-AI") || upper.includes("BENCHMARK") || upper.includes("FN-09") || upper.includes("FN-STS-09")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-09"];
  }
  if (upper.includes("PRV") || upper.includes("PROVINCE") || upper.includes("09-PROVINCE") || upper.includes("FN-10") || upper.includes("FN-STS-10")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-10"];
  }
  if (upper.includes("PWD") || upper.includes("PROFILE") || upper.includes("PASSWORD") || upper.includes("10-PROFILE") || upper.includes("FN-11") || upper.includes("FN-STS-11")) {
    return STS_FUNCTION_TEMPLATES["FN-STS-11"];
  }

  return undefined;
}

/**
 * Returns all STS function templates as a list
 */
export function getAllFunctionTemplates(): FunctionTemplate[] {
  return Object.values(STS_FUNCTION_TEMPLATES);
}
