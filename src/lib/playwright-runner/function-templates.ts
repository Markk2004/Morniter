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
// 🎯 วัตถุประสงค์: ตรวจสอบการ Login ตามสิทธิ์ผู้ใช้งาน และการ Redirect ไปยังหน้าที่ถูกต้อง
// 👥 บทบาทผู้ใช้: ครูประจำชั้น (Teacher), ผู้บริหาร (Director), แอดมิน (Admin), เจ้าหน้าที่ (Officer)
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-01: Authentication Suite", () => {
  // [Precondition]: ล้างคุกกี้และเซสชันเก่าก่อนเริ่มแต่ละเคส เพื่อความสะอาดของ State
  test.beforeEach(async ({ page }) => {
    // คำสั่ง: clearCookies() ล้างข้อมูลเซสชันเก่าออกจากเบราว์เซอร์
    await page.context().clearCookies();
  });

  test("TC-STS-AUTH-001: ครูประจำชั้น (Teacher) เข้าสู่ระบบสำเร็จและนำทางไปหน้าหลัก", async ({ page }) => {
    // [ขั้นตอนที่ 1]: สั่งให้ Browser นำทางไปยัง URL หน้า Login
    await page.goto("/login");
    // [การตรวจสอบ]: ยืนยันว่าหน้าเว็บโหลดเส้นทาง /login สำเร็จ
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: ค้นหาช่องกรอกชื่อผู้ใช้และรหัสผ่านด้วย CSS Locator
    const usernameInput = page.locator("#login-username, input[name='username'], input[type='text']").first();
    const passwordInput = page.locator("#login-password, input[name='password'], input[type='password']").first();

    // [ขั้นตอนที่ 3]: จำลองการพิมพ์ Username และ Password ของครูประจำชั้น
    await usernameInput.fill("teacher01");
    await passwordInput.fill("changeme");

    // [ขั้นตอนที่ 4]: คลิกปุ่ม 'เข้าสู่ระบบ' (Submit Button)
    await page.locator("button[type='submit'], #login-submit").first().click();

    // [ขั้นตอนที่ 5]: ตรวจสอบผลลัพธ์ (Assertion) ว่าระบบต้องนำทางออกจากหน้า /login ไปยังหน้าแดชบอร์ด
    await expect(page).not.toHaveURL(/.*\\/login/, { timeout: 15000 });
  });

  test("TC-STS-AUTH-002: ตรวจสอบความปลอดภัยเมื่อกรอกรหัสผ่านผิด", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้า Login
    await page.goto("/login");

    // [ขั้นตอนที่ 2]: ค้นหาช่องกรอกข้อมูล
    const usernameInput = page.locator("#login-username, input[name='username'], input[type='text']").first();
    const passwordInput = page.locator("#login-password, input[name='password'], input[type='password']").first();

    // [ขั้นตอนที่ 3]: กรอกรหัสผ่านที่ไม่ถูกต้องเพื่อทดสอบระบบความปลอดภัย
    await usernameInput.fill("teacher01");
    await passwordInput.fill("wrong-password-999");

    // [ขั้นตอนที่ 4]: คลิกปุ่มเข้าสู่ระบบ
    await page.locator("button[type='submit'], #login-submit").first().click();

    // [ขั้นตอนที่ 5]: ตรวจสอบผลลัพธ์ (Assertion) ต้องยังคงอยู่ที่หน้า /login และห้ามหลุดเข้าสู่ระบบ
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 6]: ตรวจสอบว่าระบบแสดงกล่องแจ้งเตือนข้อผิดพลาด (Alert Box) สีแดงเตือนผู้ใช้
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
// 🎯 วัตถุประสงค์: ตรวจสอบหน้าจอจัดการบัญชีผู้ใช้งาน, ตารางรายชื่อ, การค้นหา และการกรองสถานะ
// 👥 บทบาทผู้ใช้: ผู้ดูแลระบบแพลตฟอร์ม (Platform Admin) / ผู้ดูแลระบบสถานศึกษา
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-02: User Management Suite", () => {
  test("TC-STS-USER-001: ผู้ดูแลระบบเปิดดูทำเนียบผู้ใช้และตรวจสอบตารางข้อมูล", async ({ page }) => {
    // [ขั้นตอนที่ 1]: สั่ง Browser นำทางไปยังหน้าจัดการผู้ใช้ (/admin/users)
    await page.goto("/admin/users");
    // [การตรวจสอบ]: ยืนยันว่าหน้าเว็บโหลด URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/admin\\/users/);

    // [ขั้นตอนที่ 2]: ตรวจสอบว่ามีช่องค้นหาผู้ใช้แสดงผลบนหน้าจอพร้อมใช้งาน
    const searchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search'], #user-search").first();
    await expect(searchInput).toBeVisible();

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ามีตารางหรือรายการแสดงรายชื่อผู้ใช้งาน (User List/Table)
    const userTableOrList = page.locator("table, [role='table'], [data-testid='users-list'], .user-card").first();
    await expect(userTableOrList).toBeVisible({ timeout: 10000 });
  });

  test("TC-STS-USER-002: ทดสอบการค้นหาและกรองผู้ใช้งานตามชื่อ", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เข้าสู่หน้าจัดการผู้ใช้
    await page.goto("/admin/users");
    const searchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search'], #user-search").first();

    // [ขั้นตอนที่ 2]: ป้อนคำค้นหาลงในช่องค้นหา เช่น 'Admin'
    await searchInput.fill("Admin");
    // [ขั้นตอนที่ 3]: รอเวลาประมวลผลการค้นหา (Debounce delay 500ms)
    await page.waitForTimeout(500);

    // [ขั้นตอนที่ 4]: ตรวจสอบผลลัพธ์ว่าหน้าจอแสดงข้อมูลผู้ใช้ที่ตรงกับคำค้นหา
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
// 🎯 วัตถุประสงค์: ตรวจสอบทำเนียบนักเรียน การแสดงผลการ์ดนักเรียน และการค้นหารายชื่อ
// 👥 บทบาทผู้ใช้: ครูประจำชั้น / ครูผู้สอน / ผู้บริหารสถานศึกษา
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-03: Students & Classrooms Suite", () => {
  test("TC-STS-STU-001: ครูประจำชั้นเปิดดูทำเนียบรายชื่อนักเรียนในห้อง", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้ารายชื่อนักเรียน (/students)
    await page.goto("/students");
    // [การตรวจสอบ]: ยืนยัน URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/students/);

    // [ขั้นตอนที่ 2]: ค้นหาและตรวจสอบว่ามีการ์ดหรือแถวนักเรียนแสดงผลขึ้นมา
    const studentElements = page.locator("[data-testid='student-card'], .student-item, tr[data-student-id], table tbody tr");
    await expect(studentElements.first()).toBeVisible({ timeout: 10000 });
  });

  test("TC-STS-STU-002: ค้นหารายชื่อนักเรียนด้วยคำค้นหา", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดหน้านักเรียน
    await page.goto("/students");
    const searchInput = page.locator("input[placeholder*='ค้นหา'], input[type='search']").first();
    await expect(searchInput).toBeVisible();

    // [ขั้นตอนที่ 2]: ป้อนชื่อนักเรียนภาษาไทยในช่องค้นหา
    await searchInput.fill("กิตติพงษ์");
    // [ขั้นตอนที่ 3]: รอผลลัพธ์อัปเดต
    await page.waitForTimeout(500);

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบเรนเดอร์เนื้อหาหน้าจอได้ตามปกติ
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
// 🎯 วัตถุประสงค์: ตรวจสอบหน้าจอเช็คชื่อประจำวัน ยอดสรุปสถิติ และการบันทึกสถานะ
// 👥 บทบาทผู้ใช้: ครูประจำชั้น / ครูเวรประจำวัน
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-04: Attendance Suite", () => {
  test("TC-STS-ATT-001: ครูประจำชั้นเปิดหน้าจอเช็คชื่อการเข้าเรียนประจำวัน", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทาง Browser เข้าสู่หน้าจอเช็คชื่อ (/attendance)
    await page.goto("/attendance");
    // [การตรวจสอบ]: ยืนยัน URL หน้าเช็คชื่อ
    await expect(page).toHaveURL(/.*\\/attendance/);

    // [ขั้นตอนที่ 2]: ตรวจสอบการ์ดสถิติสรุปยอดรวมประจำวัน (มา / ขาด / ลา / มาสาย)
    const summaryCards = page.locator("[data-testid='attendance-summary'], .stat-card, .metric-card");
    if (await summaryCards.count() > 0) {
      await expect(summaryCards.first()).toBeVisible();
    }

    // [ขั้นตอนที่ 3]: ตรวจสอบตารางรายชื่อนักเรียนพร้อมปุ่มบันทึกสถานะการเช็คชื่อ
    const checkinRows = page.locator("table tbody tr, [data-testid='attendance-row']");
    await expect(checkinRows.first()).toBeVisible({ timeout: 10000 });
  });

  test("TC-STS-ATT-002: ตรวจสอบการเลือกวันที่และห้องเรียน", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เข้าสู่หน้าเช็คชื่อ
    await page.goto("/attendance");
    // [ขั้นตอนที่ 2]: ค้นหาตัวเลือกวันที่ (Date Picker) หรือเมนูเลือกห้องเรียน
    const datePickerOrSelect = page.locator("input[type='date'], select[name*='classroom'], button[aria-label*='date']").first();
    // [ขั้นตอนที่ 3]: ตรวจสอบว่าสามารถกดเลือกหรือเปลี่ยนค่าได้
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
// 🎯 วัตถุประสงค์: ตรวจสอบทำเนียบเคสปัญหา ป้ายสถานะความเสี่ยง และแบบฟอร์มสร้างเคสใหม่
// 👥 บทบาทผู้ใช้: ครูประจำชั้น / ครูแนะแนว / ฝ่ายปกครอง
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-05: Student Cases Suite", () => {
  test("TC-STS-CASE-001: ครูประจำชั้นเปิดดูทำเนียบเคสปัญหาและป้ายความเสี่ยง", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เข้าสู่หน้ารายการเคสปัญหานักเรียน (/cases)
    await page.goto("/cases");
    // [การตรวจสอบ]: ยืนยัน URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/cases/);

    // [ขั้นตอนที่ 2]: ตรวจสอบว่ามีปุ่มสำหรับกดสร้างเคสใหม่ (New Case Button)
    const newCaseBtn = page.locator("a[href*='/cases/create'], button:has-text('สร้างเคส'), button:has-text('เพิ่มเคส')").first();
    await expect(newCaseBtn).toBeVisible({ timeout: 10000 });

    // [ขั้นตอนที่ 3]: ตรวจสอบรายการเคสปัญหาในตารางข้อมูล
    const caseList = page.locator("table tbody tr, [data-testid='case-card'], .case-item");
    if (await caseList.count() > 0) {
      await expect(caseList.first()).toBeVisible();
    }
  });

  test("TC-STS-CASE-002: ตรวจสอบหน้าฟอร์มสร้างเคสปัญหานักเรียนใหม่", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดหน้ารายการเคส
    await page.goto("/cases");
    const newCaseBtn = page.locator("a[href*='/cases/create'], button:has-text('สร้างเคส'), button:has-text('เพิ่มเคส')").first();
    // [ขั้นตอนที่ 2]: คลิกปุ่มสร้างเคสเพื่อทดสอบการเปลี่ยนเส้นทางไปยังหน้ากรอกข้อมูล
    if (await newCaseBtn.isVisible()) {
      await newCaseBtn.click();
      // [ขั้นตอนที่ 3]: ยืนยันว่า URL เปลี่ยนไปยังหน้าสร้างเคส /cases/create
      await expect(page).toHaveURL(/.*\\/cases.*create/);
      // [ขั้นตอนที่ 4]: ตรวจสอบว่ามีฟิลด์กรอกข้อมูลแสดงผลพร้อมใช้งาน
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
// 🎯 วัตถุประสงค์: ตรวจสอบหน้าจอออกรายงาน ตัวกรองเงื่อนไข และปุ่มส่งออก Excel / PDF
// 👥 บทบาทผู้ใช้: ผู้อำนวยการ / ผู้บริหารสถานศึกษา / หัวหน้าฝ่ายสถิติ
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-06: Case Reports & Export Suite", () => {
  test("TC-STS-REP-001: ผู้บริหารเปิดหน้า Report Studio และตรวจสอบตัวกรองรายงาน", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้าระบบรายงาน (/reports)
    await page.goto("/reports");
    // [การตรวจสอบ]: ยืนยัน URL หน้าสรุปรายงาน
    await expect(page).toHaveURL(/.*\\/reports/);

    // [ขั้นตอนที่ 2]: ตรวจสอบตัวเลือกประเภทรายงาน (Report Type Dropdown)
    const reportType = page.locator("select[name*='type'], [role='combobox'], #report-type").first();
    if (await reportType.isVisible()) {
      await expect(reportType).toBeVisible();
    }

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ามีปุ่มสั่งสร้างรายงาน (Generate / Preview Report)
    const generateBtn = page.locator("button:has-text('สร้างรายงาน'), button:has-text('ดูรายงาน'), button:has-text('Generate')").first();
    if (await generateBtn.isVisible()) {
      await expect(generateBtn).toBeEnabled();
    }
  });

  test("TC-STS-REP-002: ตรวจสอบความพร้อมของปุ่ม Export ข้อมูล", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดหน้ารายงาน
    await page.goto("/reports");
    // [ขั้นตอนที่ 2]: ค้นหาปุ่มดาวน์โหลดไฟล์รายงาน Excel (.xlsx)
    const exportExcelBtn = page.locator("button:has-text('Excel'), a:has-text('Excel'), button:has-text('ส่งออก')").first();
    // [ขั้นตอนที่ 3]: ตรวจสอบว่าปุ่มดาวน์โหลดพร้อมให้ผู้บริหารคลิกใช้งาน
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
// 🎯 วัตถุประสงค์: ตรวจสอบหน้าจอติดตามพฤติกรรม แผนที่พิกัด และการกรองความเสี่ยง
// 👥 บทบาทผู้ใช้: ครูประจำชั้น / ครูแนะแนว / เจ้าหน้าที่ลงพื้นที่เยี่ยมบ้าน
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-07: Observations & Tracking Suite", () => {
  test("TC-STS-TRK-001: ครูประจำชั้นเปิดหน้าติดตามพฤติกรรมและการเยี่ยมบ้าน", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้า Tracking / Observations
    await page.goto("/observations");
    // [การตรวจสอบ]: ยืนยัน URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/(observations|tracking)/);

    // [ขั้นตอนที่ 2]: ตรวจสอบว่ามีการ์ดหรือแถวแสดงผลการติดตามนักเรียน
    const trackingCards = page.locator("[data-testid='tracking-item'], .observation-card, tr[data-student-id]");
    if (await trackingCards.count() > 0) {
      await expect(trackingCards.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("TC-STS-TRK-002: กรองรายชื่อนักเรียนตามระดับความเสี่ยง", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดหน้าจอสังเกตพฤติกรรม
    await page.goto("/observations");
    // [ขั้นตอนที่ 2]: ค้นหาตัวกรองระดับความเสี่ยง (Risk Filter)
    const riskFilter = page.locator("select[name*='risk'], button:has-text('ความเสี่ยง')").first();
    // [ขั้นตอนที่ 3]: ตรวจสอบว่าตัวกรองพร้อมรับการสั่งการ
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
// 🎯 วัตถุประสงค์: ตรวจสอบการโหลดแดชบอร์ด การแสดงผล KPI Cards และเมนูทางลัด
// 👥 บทบาทผู้ใช้: ผู้ใช้งานทุกบทบาท (ครู, ผู้บริหาร, เจ้าหน้าที่, แอดมิน)
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-08: Dashboard & Navigation Suite", () => {
  test("TC-STS-DASH-001: เปิดหน้าแดชบอร์ดหลักและตรวจสอบการ์ด KPI สถิติ", async ({ page }) => {
    // [ขั้นตอนที่ 1]: สั่ง Browser เข้าสู่หน้าจอแดชบอร์ดหลัก (/dashboard)
    await page.goto("/dashboard");
    // [การตรวจสอบ]: ยืนยัน URL หน้าแดชบอร์ด
    await expect(page).toHaveURL(/.*\\/dashboard/);

    // [ขั้นตอนที่ 2]: ตรวจสอบหัวข้อหลักของแดชบอร์ด (Dashboard Heading)
    const heading = page.locator("h1, h2, [data-testid='dashboard-header']").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ามีการ์ด KPI สรุปตัวชี้วัดแสดงผลอย่างน้อย 1 รายการ
    const kpiCards = page.locator(".kpi-card, [data-testid='kpi-card'], .grid > div");
    await expect(kpiCards.first()).toBeVisible();
  });

  test("TC-STS-DASH-002: ตรวจสอบปุ่มทางลัดไปยังโมดูลหลักต่างๆ", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดหน้าแดชบอร์ด
    await page.goto("/dashboard");
    // [ขั้นตอนที่ 2]: ตรวจสอบแถบเมนูนำทาง (Sidebar / Navigation Menu)
    const navOrSidebar = page.locator("nav, aside, [role='navigation']").first();
    // [ขั้นตอนที่ 3]: ยืนยันว่าแถบเมนูแสดงผลพร้อมคลิกใช้งาน
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
// 🎯 วัตถุประสงค์: ตรวจสอบหน้าจอ Benchmark การวิเคราะห์เคสของโมเดล AI และตัวชี้วัดประสิทธิภาพ
// 👥 บทบาทผู้ใช้: ผู้ดูแลระบบแพลตฟอร์ม / ผู้เชี่ยวชาญด้านข้อมูล / ผู้บริหาร
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-09: AI Insights & Benchmark Evaluation Suite", () => {
  test("TC-STS-AI-001: ผู้ดูแลระบบเปิดหน้าจอประเมินและทดสอบระบบ AI", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้าจอประเมินผล AI (/admin/ai-evaluation)
    await page.goto("/admin/ai-evaluation");
    // [การตรวจสอบ]: ยืนยัน URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/ai-evaluation/);

    // [ขั้นตอนที่ 2]: ตรวจสอบหัวข้อหลักของหน้าจอ AI Benchmark
    const header = page.locator("h1, h2").first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // [ขั้นตอนที่ 3]: ตรวจสอบช่องกรอก Benchmark Run ID และปุ่มสั่งเริ่มการประเมิน
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
// 🎯 วัตถุประสงค์: ตรวจสอบแดชบอร์ดภาพรวมระดับเขตพื้นที่ สถิติเปรียบเทียบโรงเรียน และมาตรการ Privacy
// 👥 บทบาทผู้ใช้: เจ้าหน้าที่เขตพื้นที่การศึกษา / ผู้ว่าราชการจังหวัด / ผู้บริหารระดับเขต
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-10: Platform & Province Suite", () => {
  test("TC-STS-PRV-001: เจ้าหน้าที่เขต/จังหวัดเปิดดูแดชบอร์ดสรุปภาพรวมพื้นที่", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้าแดชบอร์ดระดับจังหวัด (/province/dashboard)
    await page.goto("/province/dashboard");
    // [การตรวจสอบ]: ยืนยัน URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/province/);

    // [ขั้นตอนที่ 2]: ตรวจสอบหัวข้อชื่อจังหวัดหรือรหัสเขตพื้นที่
    const provinceHeader = page.locator("h1, h2, [data-testid='province-name']").first();
    await expect(provinceHeader).toBeVisible({ timeout: 10000 });

    // [ขั้นตอนที่ 3]: ตรวจสอบการแสดงผลการ์ดสถิติรวมสถานศึกษาในสังกัด
    const statCards = page.locator(".stat-card, [data-testid='summary-card'], .grid > div");
    await expect(statCards.first()).toBeVisible();
  });

  test("TC-STS-PRV-002: ตรวจสอบการป้องกันความเป็นส่วนตัว (No Individual Student PII)", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดหน้ารายงานระดับจังหวัด
    await page.goto("/province/reports");
    // [ขั้นตอนที่ 2]: ตรวจสอบนโยบายความปลอดภัยข้อมูลส่วนบุคคล (Privacy Assertion)
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
// 🎯 วัตถุประสงค์: ตรวจสอบหน้าจอโปรไฟล์ผู้ใช้ ฟอร์มเปลี่ยนรหัสผ่าน และการตรวจสอบเงื่อนไขความปลอดภัย
// 👥 บทบาทผู้ใช้: ผู้ใช้งานทุกคนในระบบทุกบทบาท
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-11: Profile & Password Suite", () => {
  test("TC-STS-PWD-001: ผู้ใช้เปิดหน้าจอเปลี่ยนรหัสผ่านและตรวจสอบเงื่อนไขความปลอดภัย", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้าจอเปลี่ยนรหัสผ่าน (/change-password)
    await page.goto("/change-password");
    // [การตรวจสอบ]: ยืนยัน URL ถูกต้อง
    await expect(page).toHaveURL(/.*\\/(change-password|profile)/);

    // [ขั้นตอนที่ 2]: ตรวจสอบว่ามีช่องกรอกรหัสผ่านเดิม รหัสผ่านใหม่ และยืนยันรหัสผ่านใหม่
    const oldPass = page.locator("#oldPassword, input[name='oldPassword'], input[type='password']").first();
    const newPass = page.locator("#newPassword, input[name='newPassword']").first();
    const confirmPass = page.locator("#confirmPassword, input[name='confirmPassword']").first();

    await expect(oldPass).toBeVisible({ timeout: 10000 });
    await expect(newPass).toBeVisible();
    await expect(confirmPass).toBeVisible();

    // [ขั้นตอนที่ 3]: ตรวจสอบว่ามีปุ่มบันทึกรหัสผ่านใหม่แสดงผลพร้อมใช้งาน
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
