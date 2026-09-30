// ==============================================================
// 📋 Function-specific Playwright Test Templates for ProjectSTS
// Provides self-contained, standalone Playwright specs for FN-STS-01 to FN-STS-11
// Each template includes embedded route mocks, real routes, realistic selectors,
// and visual delays for headed mode execution.
// ==============================================================

export interface FunctionTemplate {
  id: string;
  name: string;
  shortName: string;
  relativePath: string;
  description: string;
  code: string;
}

// ==============================================================
// 🛡️ ชุด Route Mock กลางสำหรับ Next.js Client & AuthGate
// จำลอง API endpoints หลักที่ทุกเพจใน ProjectSTS เรียกใช้ เพื่อป้องกันหน้าเว็บเด้งกลับ /login
// ==============================================================
const COMMON_STS_ROUTE_MOCKS = `
    // [Central Route Mocks]: จำลอง Session Refresh และสิทธิ์ผู้ใช้งานปัจจุบัน
    await page.route("**/api/auth/refresh*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-workspace",
          user: activeUser,
        }),
      });
    });

    await page.route("**/api/auth/me*", async (route) => {
      const url = route.request().url();
      if (url.includes("/avatar")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ dataUri: null }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: activeUser.id || 99,
          username: activeUser.username,
          name: activeUser.name,
          role: activeUser.role,
          roleName: activeUser.roleName || activeUser.role,
          avatarUrl: null,
        }),
      });
    });

    // [Central Route Mocks]: ข้อมูลปีการศึกษาและเทอมปัจจุบัน (รองรับทั้ง /current และรายการ array)
    await page.route("**/api/academic-years*", async (route) => {
      const url = route.request().url();
      if (url.includes("/current")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 1,
            year: 2569,
            startDate: "2026-05-16",
            endDate: "2027-03-31",
            isCurrent: true,
            terms: [{ termNo: 1, startDate: "2026-05-16", endDate: "2026-10-15", isCurrent: true }],
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            year: 2569,
            startDate: "2026-05-16",
            endDate: "2027-03-31",
            isCurrent: true,
            terms: [{ termNo: 1, startDate: "2026-05-16", endDate: "2026-10-15", isCurrent: true }],
          },
        ]),
      });
    });

    // [Central Route Mocks]: ข้อมูลโรงเรียนและการแจ้งเตือนระบบ
    await page.route("**/api/schools*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, name: "โรงเรียนตัวอย่างทดสอบ" }]),
      });
    });

    await page.route("**/api/notifications*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // [Central Route Mocks]: ห้องเรียนและแดชบอร์ดครู
    await page.route("**/api/my-classrooms*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "1", name: "ม.3/1", gradeLevel: 9, studentCount: 35 }]),
      });
    });

    await page.route("**/api/classrooms*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, roomName: "1", grade: "ม.3", name: "ม.3/1", grade_level_id: 9, studentCount: 35, academic_year_id: 1 },
          { id: 2, roomName: "2", grade: "ม.3", name: "ม.3/2", grade_level_id: 9, studentCount: 32, academic_year_id: 1 },
        ]),
      });
    });

    await page.route("**/api/dashboard/teacher*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalStudents: 35,
          attendanceToday: { present: 32, absent: 1, late: 2, leave: 0, attendanceRate: 91.4 },
          attentionQueue: [],
          classrooms: [{ id: "1", name: "ม.3/1", studentCount: 35, attendanceRate: 91.4 }],
          myClassrooms: [{ id: 1, gradeLevelName: "ม.3", roomName: "1", studentCount: 35 }],
        }),
      });
    });

    // [Central Route Mocks]: Action Center & สถิติผู้บริหารสถานศึกษา
    await page.route("**/api/dashboard/director/action-center*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          scope: { schoolId: 1, schoolName: "โรงเรียนตัวอย่างทดสอบ", academicYearId: 1, academicYearLabel: "2569 / เทอม 1" },
          generatedAt: "2026-10-01T08:00:00.000Z",
          abnormalAbsenceThresholdDays: 3,
          summary: { waitingDecisionCount: 2, criticalHighCount: 1, abnormalAbsenceCount: 1, attendanceRateToday: 95.5, hasAttendanceData: true },
          decisionQueue: [],
          attentionQueue: [],
        }),
      });
    });

    await page.route("**/api/dashboard/director/analytics*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-10-01T08:00:00.000Z",
          appliedFilters: {},
          overview: { totalStudents: 850, totalClassrooms: 24, totalCases: 12, closedCases: 4 },
          attendanceTrend: [],
          watchedClassrooms: [],
          severityDistribution: { LOW: 5, MEDIUM: 4, HIGH: 3, UNASSESSED: 0 },
        }),
      });
    });

    // [Central Route Mocks]: แดชบอร์ดจัดการระบบของแอดมิน
    await page.route("**/api/dashboard/admin/operations*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          school: { id: 1, name: "โรงเรียนตัวอย่างทดสอบ" },
          currentAcademicYear: "2569",
          currentTerm: 1,
          window: { days: 7 },
          metrics: {
            attendanceRate: { value: 96.2, unit: "PERCENT", available: true },
            consecutiveAbsenceStudents: { value: 3, unit: "COUNT", available: true },
            pendingCases: { value: 8, unit: "COUNT", available: true },
            dataReadiness: { value: 98.0, unit: "PERCENT", available: true },
          },
          attendanceTrend: [],
          actionQueue: [],
          dataReadiness: { scorePercentage: 98, checks: [] },
          dataAvailability: "AVAILABLE",
          generatedAt: "2026-10-01T08:00:00.000Z",
        }),
      });
    });

    // [Central Route Mocks]: ข้อมูลระดับเขต/จังหวัด และกลุ่มสถานศึกษา
    await page.route("**/api/provinces*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, name: "กรุงเทพมหานคร" }]),
      });
    });

    await page.route("**/api/school-groups*", async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.route("**/api/referrals*", async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.route("**/api/users/access-change-requests*", async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.route("**/api/auth/change-password*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จแล้ว" }),
      });
    });
    
`;

export const STS_FUNCTION_TEMPLATES: Record<string, FunctionTemplate> = {
  "FN-STS-01": {
    id: "FN-STS-01",
    name: "FN-STS-01 · ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)",
    shortName: "เข้าสู่ระบบ",
    relativePath: "e2e/sts/login.spec.ts",
    description: "ทดสอบการเข้าสู่ระบบตามบทบาทผู้ใช้ (Teacher, Director, Admin, Officer) และการป้องกันข้อผิดพลาด",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)
// 🎯 วัตถุประสงค์: ตรวจสอบการ Login ตามสิทธิ์ผู้ใช้งาน และการ Redirect ไปยังหน้าที่ถูกต้อง
// 👥 บทบาทผู้ใช้: ครูประจำชั้น (Teacher), ผู้บริหาร (Director), แอดมิน (Admin), เจ้าหน้าที่ (Officer)
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-01: Authentication Suite", () => {
  let activeUser = {
    id: 99,
    username: "teacher_a",
    name: "ผู้ใช้ทดสอบ (teacher_a)",
    role: "TEACHER",
    roleName: "TEACHER",
    schoolId: 1,
    provinceId: 1,
  };

  // [Precondition]: ล้างคุกกี้และตั้งค่า Route Mocking ก่อนเริ่มแต่ละเคส
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });

    activeUser = {
      id: 99,
      username: "teacher_a",
      name: "ผู้ใช้ทดสอบ (teacher_a)",
      role: "TEACHER",
      roleName: "TEACHER",
      schoolId: 1,
      provinceId: 1,
    };

    // จำลอง Mock Auth Login API เพื่อให้รันได้อิสระโดยไม่ต้องมี Backend หรือ Database จริง
    await page.route("**/api/auth/login", async (route) => {
      let postData: { username?: string; password?: string } | null = null;
      try {
        postData = route.request().postDataJSON();
      } catch {
        postData = null;
      }
      const { username, password } = postData || {};

      if (password === "changeme") {
        let role = "TEACHER";
        let roleName = "TEACHER";
        let displayName = "ครูประจำชั้น (teacher_a)";
        if (username?.includes("director")) {
          role = "SCHOOL_DIRECTOR";
          roleName = "SCHOOL_DIRECTOR";
          displayName = "ผู้อำนวยการ (director_a)";
        } else if (username?.includes("admin")) {
          role = "SCHOOL_ADMIN";
          roleName = "SCHOOL_ADMIN";
          displayName = "ผู้ดูแลระบบ (admin_a)";
        } else if (username?.includes("officer")) {
          role = "PROVINCE_OFFICER";
          roleName = "PROVINCE_OFFICER";
          displayName = "เจ้าหน้าที่เขต (province_officer)";
        } else if (username?.includes("platform")) {
          role = "PLATFORM_ADMIN";
          roleName = "PLATFORM_ADMIN";
          displayName = "ผู้ดูแลระบบกลาง (platform_admin)";
        }

        activeUser = {
          id: username?.includes("director") ? 2 : username?.includes("admin") ? 1 : 99,
          username: username || "teacher_a",
          name: displayName,
          role,
          roleName,
          schoolId: 1,
          provinceId: 1,
        };

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "mock-jwt-token-workspace",
            user: activeUser,
          }),
        });
      }

      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
  });

  test("TC-STS-AUTH-001: ครูประจำชั้น (Teacher) เข้าสู่ระบบสำเร็จและนำทางไปหน้าหลัก", async ({ page }) => {
    // [ขั้นตอนที่ 1]: สั่งให้ Browser นำทางไปยัง URL หน้า Login
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: ค้นหาช่องกรอกชื่อผู้ใช้และรหัสผ่าน
    const usernameInput = page.locator("#login-username, input[name='username']").first();
    const passwordInput = page.locator("#login-password, input[name='password']").first();

    // [ขั้นตอนที่ 3]: จำลองการพิมพ์ Username และ Password ของครูประจำชั้น
    await usernameInput.fill("teacher_a");
    await passwordInput.fill("changeme");

    // [ขั้นตอนที่ 4]: คลิกปุ่ม 'เข้าสู่ระบบ' (Submit Button)
    await page.locator("#login-submit, button[type='submit']").first().click();

    // [ขั้นตอนที่ 5]: ตรวจสอบผลลัพธ์ว่าระบบต้องนำทางออกจากหน้า /login ไปยังแดชบอร์ดครู
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/(?:teacher|students|dashboard)/, { timeout: 15000 });

    // [ขั้นตอนที่ 6]: หน่วงเวลา 2.5 วินาทีเพื่อให้เห็นผลลัพธ์บนจอในโหมด Headed
    await page.waitForTimeout(2500);
  });

  test("TC-STS-AUTH-002: ผู้บริหาร (Director) เข้าสู่ระบบสำเร็จและนำทางไปแดชบอร์ด", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้า Login
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: กรอกข้อมูลบัญชีผู้บริหาร
    await page.locator("#login-username, input[name='username']").first().fill("director_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");

    // [ขั้นตอนที่ 3]: คลิกเข้าสู่ระบบ
    await page.locator("#login-submit, button[type='submit']").first().click();

    // [ขั้นตอนที่ 4]: ตรวจสอบการนำทางไปยังหน้าแดชบอร์ดผู้บริหาร
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/(?:director|reports|dashboard)/, { timeout: 15000 });
    await page.waitForTimeout(2500);
  });

  test("TC-STS-AUTH-003: ตรวจสอบความปลอดภัยเมื่อกรอกรหัสผ่านผิด", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เข้าสู่หน้า Login
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: กรอกรหัสผ่านที่ไม่ถูกต้องเพื่อทดสอบความปลอดภัย
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("wrong-password-999");

    // [ขั้นตอนที่ 3]: คลิกปุ่มเข้าสู่ระบบ
    await page.locator("#login-submit, button[type='submit']").first().click();

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบต้องไม่หลุดออกจากหน้า /login
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 5]: ตรวจสอบว่ามีกล่องแจ้งเตือนสีแดงแสดงข้อความเตือนผู้ใช้
    const alertBox = page.locator("[role='alert']:not(#__next-route-announcer__), .text-rose-500, .bg-rose-950, [data-testid='error-alert']");
    await expect(alertBox.first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2500);
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
  let activeUser = { id: 1, username: "admin", name: "ผู้ดูแลระบบ", role: "PLATFORM_ADMIN", roleName: "PLATFORM_ADMIN" };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-admin",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Users List API (รองรับทั้ง /api/users และ /api/admin/users)
    const mockUsers = [
      { id: 1, username: "admin", name: "สมชาย ผู้ดูแลระบบ (Admin)", full_name: "สมชาย ผู้ดูแลระบบ (Admin)", role: { name: "PLATFORM_ADMIN" }, roleName: "PLATFORM_ADMIN", status: "active", isActive: true, email: "admin@sts.ac.th" },
      { id: 2, username: "teacher_a", name: "สมหญิง ครูประจำชั้น (Teacher)", full_name: "สมหญิง ครูประจำชั้น (Teacher)", role: { name: "TEACHER" }, roleName: "TEACHER", status: "active", isActive: true, email: "sommai@sts.ac.th" },
      { id: 3, username: "director_a", name: "ผู้อำนวยการ วิชัย", full_name: "ผู้อำนวยการ วิชัย", role: { name: "SCHOOL_DIRECTOR" }, roleName: "SCHOOL_DIRECTOR", status: "active", isActive: true, email: "director@sts.ac.th" },
      { id: 4, username: "suspended_user", name: "ผู้ใช้ระงับสิทธิ์", full_name: "ผู้ใช้ระงับสิทธิ์", role: { name: "TEACHER" }, roleName: "TEACHER", status: "suspended", isActive: false, email: "suspended@sts.ac.th" },
    ];

    await page.route("**/api/users*", async (route) => {
      const url = route.request().url();
      if (url.includes("access-change-requests")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockUsers) });
    });

    await page.route("**/api/admin/users*", async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockUsers) });
    });

    await page.route("**/api/provinces*", async (route) => {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, name: "กรุงเทพมหานคร" }]) });
    });

    // เข้าสู่ระบบด้วยบัญชีแอดมินก่อนเริ่มทดสอบ
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("admin");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/(?:admin|users|dashboard)/, { timeout: 15000 });
  });

  test("TC-STS-USER-001: ผู้ดูแลระบบเปิดดูทำเนียบผู้ใช้และตรวจสอบตารางข้อมูล", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/.*\\/admin\\/users/);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const rows = page.locator("tbody tr, .user-card, table tr");
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });

  test("TC-STS-USER-002: ทดสอบการค้นหาและกรองผู้ใช้งานตามชื่อ", async ({ page }) => {
    await page.goto("/admin/users");

    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill("สมหมาย");
    await page.waitForTimeout(500);

    await expect(page.locator("body")).toContainText(/สมหมาย|teacher_a/i);

    await page.waitForTimeout(2500);
  });

  test("TC-STS-USER-003: ผู้ดูแลระบบเปิด Modal เพิ่มผู้ใช้งานใหม่และตรวจสอบฟิลด์", async ({ page }) => {
    await page.goto("/admin/users");

    const addBtn = page.locator("#add-user-btn, button:has-text('เพิ่มผู้ใช้')").first();
    if (await addBtn.isVisible()) {
      await addBtn.click();

      const modal = page.locator("dialog, [role='dialog'], .modal").first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      await expect(modal.locator("input").first()).toBeVisible();
    }

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 99, username: "teacher_a", name: "ครูประจำชั้น", role: "TEACHER", roleName: "TEACHER", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-teacher",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Students
    await page.route("**/api/students*", async (route) => {
      const url = route.request().url();
      const isStudentDetail = url.includes("/api/students/") && !url.endsWith("/api/students");
      if (isStudentDetail) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 101,
            studentCode: "50001",
            student_id: "50001",
            firstName: "กิตติพงษ์",
            first_name: "กิตติพงษ์",
            lastName: "สุขเกษม",
            last_name: "สุขเกษม",
            gender: { name: "ชาย" },
            currentAddress: "123 กรุงเทพมหานคร",
            enrollments: [
              {
                id: 1,
                isCurrent: true,
                classroom: { id: 1, roomName: "1", gradeLevel: { name: "มัธยมศึกษาปีที่ 3" } },
              },
            ],
            cases: [],
            attendance_stats: { present: 45, absent: 0, late: 1, leave: 0 },
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 101,
            studentCode: "50001",
            student_id: "50001",
            firstName: "กิตติพงษ์",
            first_name: "กิตติพงษ์",
            lastName: "สุขเกษม",
            last_name: "สุขเกษม",
            class_room: "ม.3/1",
            risk_level: "low",
            status: "active",
            enrollments: [{ id: 1, isCurrent: true, classroom: { id: 1, roomName: "1", gradeLevel: { name: "ม.3" } } }],
          },
          {
            id: 102,
            studentCode: "50002",
            student_id: "50002",
            firstName: "ชาญชัย",
            first_name: "ชาญชัย",
            lastName: "มีสุข",
            last_name: "มีสุข",
            class_room: "ม.3/1",
            risk_level: "high",
            status: "active",
            enrollments: [{ id: 2, isCurrent: true, classroom: { id: 1, roomName: "1", gradeLevel: { name: "ม.3" } } }],
          },
        ]),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีครูก่อนเริ่มทดสอบ
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/teacher\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-STU-001: ครูประจำชั้นเปิดดูทำเนียบรายชื่อนักเรียนในห้อง", async ({ page }) => {
    await page.goto("/teacher/students");
    await expect(page).toHaveURL(/.*\\/teacher\\/students/);

    const studentCards = page.locator("a[href*='/teacher/students/'], [data-testid='student-card'], tr[data-student-id]");
    await expect(studentCards.first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });

  test("TC-STS-STU-002: ค้นหารายชื่อนักเรียนด้วยคำค้นหา", async ({ page }) => {
    await page.goto("/teacher/students");

    const searchInput = page.getByPlaceholder(/ค้นหาชื่อ, รหัส/i).first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill("กิตติพงษ์");
    await page.waitForTimeout(600);

    await expect(page.locator("body")).toContainText("กิตติพงษ์");

    await page.waitForTimeout(2500);
  });

  test("TC-STS-STU-003: คลิกเลือกนักเรียนเพื่อดูข้อมูลโปรไฟล์รายบุคคล", async ({ page }) => {
    await page.goto("/teacher/students");

    const studentCard = page.locator("a[href*='/teacher/students/']", { hasText: "กิตติพงษ์" }).first();
    if (await studentCard.isVisible()) {
      await studentCard.click();
      await expect(page).toHaveURL(/.*\\/teacher\\/students\\/.+/);
      await expect(page.locator("body")).toContainText("กิตติพงษ์");
    }

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 99, username: "teacher_a", name: "ครูประจำชั้น", role: "TEACHER", roleName: "TEACHER", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-teacher",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Classrooms and Attendance APIs
    await page.route("**/api/classrooms*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "1", name: "ม.3/1", gradeLevel: 9, studentCount: 35 }]),
      });
    });

    await page.route("**/api/attendance/sessions/*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, roundNumber: 1, createdAt: "2026-10-01T08:00:00.000Z", recordCount: 3 }]),
      });
    });

    await page.route("**/api/attendance/daily/*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, date: "2026-10-01", status: "PRESENT", studentId: 101, studentName: "กิตติพงษ์ สุขเกษม", enrollment: { student: { firstName: "กิตติพงษ์", lastName: "สุขเกษม" } } },
          { id: 2, date: "2026-10-01", status: "ABSENT", studentId: 102, studentName: "ชาญชัย มีสุข", enrollment: { student: { firstName: "ชาญชัย", lastName: "มีสุข" } } },
        ]),
      });
    });

    await page.route("**/api/attendance/summary/*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ presentCount: 32, absentCount: 1, lateCount: 2, leaveCount: 0, total: 35 }),
      });
    });

    await page.route("**/api/attendance*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: "2026-10-01",
          summary: { present: 32, absent: 1, late: 2, leave: 0, total: 35 },
          records: [
            { studentId: "50001", studentName: "กิตติพงษ์ สุขเกษม", status: "present" },
            { studentId: "50002", studentName: "ชาญชัย มีสุข", status: "absent" },
          ],
        }),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีครูก่อนเริ่มทดสอบ
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/teacher\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-ATT-001: ครูประจำชั้นเปิดหน้าจอเช็คชื่อและตรวจสอบยอดสรุปสถิติ", async ({ page }) => {
    await page.goto("/teacher/attendance");
    await expect(page).toHaveURL(/.*\\/teacher\\/attendance/);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });

  test("TC-STS-ATT-002: ตรวจสอบตารางรายชื่อนักเรียนและปุ่มสถานะเช็คชื่อ", async ({ page }) => {
    await page.goto("/teacher/attendance");

    const statusBtns = page.locator("button:has-text('มา'), button:has-text('ขาด'), button:has-text('สาย'), button:has-text('ลา')");
    await expect(statusBtns.first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });
});
`,
  },

  "FN-STS-05": {
    id: "FN-STS-05",
    name: "FN-STS-05 · ระบบจัดการเคสปัญหา (Student Cases)",
    shortName: "จัดการเคสปัญหา",
    relativePath: "e2e/sts/specs/05-cases.spec.ts",
    description: "ตรวจสอบทำเนียบเคสปัญหา ป้ายสถานะความเสี่ยง และแบบฟอร์มสร้างเคสใหม่",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-05 ระบบจัดการเคสปัญหา (Student Cases)
// 🎯 วัตถุประสงค์: ตรวจสอบทำเนียบเคสปัญหา ป้ายสถานะความเสี่ยง และแบบฟอร์มสร้างเคสใหม่
// 👥 บทบาทผู้ใช้: ครูประจำชั้น / ครูแนะแนว / ฝ่ายปกครอง
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-05: Student Cases Suite", () => {
  let activeUser = { id: 99, username: "teacher_a", name: "ครูประจำชั้น", role: "TEACHER", roleName: "TEACHER", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-teacher",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Students
    await page.route("**/api/students*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 101, studentId: 101, studentCode: "50001", student_id: "50001", firstName: "กิตติพงษ์", first_name: "กิตติพงษ์", lastName: "สุขเกษม", last_name: "สุขเกษม", class_room: "ม.3/1" },
        ]),
      });
    });

    // 3. Mock Cases List & Create
    let cases = [
      {
        id: 201,
        caseNumber: "CASE-2026-001",
        case_number: "CASE-2026-001",
        title: "นักเรียนขาดเรียนบ่อยครั้ง",
        description: "ขาดเรียนติดต่อกัน 3 วันโดยไม่แจ้งเหตุผล",
        severity: "HIGH",
        status: "open",
        enrollment: {
          studentId: 101,
          student: { id: 101, firstName: "กิตติพงษ์", lastName: "สุขเกษม", studentCode: "50001" },
          classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
        },
        student: { id: "101", student_id: "50001", first_name: "กิตติพงษ์", last_name: "สุขเกษม", class_room: "ม.3/1" },
        created_at: "2026-10-01T08:00:00.000Z",
      },
    ];

    await page.route("**/api/cases*", async (route) => {
      if (route.request().method() === "POST") {
        const postData = route.request().postDataJSON();
        const createdCase = {
          id: 202,
          caseNumber: "CASE-2026-002",
          case_number: "CASE-2026-002",
          title: postData?.title || "เคสทดสอบปัญหา",
          description: postData?.description || "รายละเอียดเคส",
          severity: "MEDIUM",
          status: "open",
          enrollment: {
            studentId: 101,
            student: { id: 101, firstName: "กิตติพงษ์", lastName: "สุขเกษม", studentCode: "50001" },
            classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
          },
          student: { id: "101", student_id: "50001", first_name: "กิตติพงษ์", last_name: "สุขเกษม", class_room: "ม.3/1" },
          created_at: "2026-10-01T08:00:00.000Z",
        };
        cases.unshift(createdCase);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(createdCase),
        });
      }

      const url = route.request().url();
      if (url.includes("page=")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: cases,
            meta: { total: cases.length, page: 1, limit: 25, totalPages: 1 },
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cases),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีครูก่อนเริ่มทดสอบ
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/teacher\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-CASE-001: ครูประจำชั้นเปิดดูทำเนียบเคสปัญหาและป้ายความเสี่ยง", async ({ page }) => {
    await page.goto("/teacher/cases");
    await expect(page).toHaveURL(/.*\\/teacher\\/cases/);

    const newCaseBtn = page.locator("a[href*='/teacher/cases/create'], button:has-text('เปิดเคส')").first();
    await expect(newCaseBtn).toBeVisible({ timeout: 10000 });

    await expect(page.locator("body")).toContainText(/ขาดเรียน|เปิดเคส/);

    await page.waitForTimeout(2500);
  });

  test("TC-STS-CASE-002: ตรวจสอบหน้าฟอร์มสร้างเคสปัญหานักเรียนใหม่", async ({ page }) => {
    await page.goto("/teacher/cases");

    const newCaseBtn = page.locator("a[href*='/teacher/cases/create'], button:has-text('เปิดเคส')").first();
    await newCaseBtn.click();

    await expect(page).toHaveURL(/.*\\/teacher\\/cases\\/create/);

    await expect(page.locator("button#student, select#student, [role='combobox']#student").first()).toBeVisible();
    await expect(page.locator("textarea#title, input#title").first()).toBeVisible();
    await expect(page.locator("textarea#description, input#description").first()).toBeVisible();

    await page.waitForTimeout(2500);
  });

  test("TC-STS-CASE-003: กรอกข้อมูลและบันทึกเปิดเคสใหม่ พร้อมส่งกลับหน้ารายการเคส", async ({ page }) => {
    await page.goto("/teacher/cases/create");

    const studentSelect = page.locator("button#student, select#student, [role='combobox']#student").first();
    if (await studentSelect.isVisible()) {
      await studentSelect.click();
      await page.waitForTimeout(300);
      const studentOpt = page.getByRole("option", { name: /กิตติพงษ์/i }).first();
      if (await studentOpt.isVisible()) {
        await studentOpt.click();
      } else {
        const anyOpt = page.getByRole("option");
        if (await anyOpt.count() > 1) await anyOpt.nth(1).click();
      }
    }

    await page.locator("textarea#title, input#title").first().fill("นักเรียนมีพฤติกรรมเสี่ยงด้านสุขภาพจิต");
    await page.locator("textarea#description, input#description").first().fill("สังเกตพบนักเรียนมีความเครียดและแยกตัวจากกลุ่มเพื่อนในคาบเรียน");

    const submitBtn = page.getByRole("button", { name: /เปิดเคส|บันทึกเปิดเคส|บันทึกข้อมูล/i }).first();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page).toHaveURL(/.*\\/teacher\\/cases/, { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/พฤติกรรมเสี่ยง|เปิดเคส/);

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 2, username: "director_a", name: "ผู้อำนวยการ", role: "SCHOOL_DIRECTOR", roleName: "SCHOOL_DIRECTOR", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-director",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Reports
    await page.route("**/api/reports*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalCases: 1,
          items: [
            {
              id: 1,
              caseNumber: "CASE-2026-001",
              studentName: "กิตติพงษ์ สุขเกษม",
              classroomName: "ม.3/1",
              severity: "HIGH",
              status: "IN_PROGRESS",
            },
          ],
        }),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีผู้บริหาร
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("director_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/director\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-REP-001: ผู้บริหารเปิดหน้า Report Studio และตรวจสอบตัวกรองรายงาน", async ({ page }) => {
    await page.goto("/director/reports");
    await expect(page).toHaveURL(/.*\\/director\\/reports/);

    const generateBtn = page.locator("#generate-report-btn, button:has-text('สร้างรายงาน')").first();
    await expect(generateBtn).toBeVisible({ timeout: 10000 });

    const reportType = page.locator("button#report-type, select#report-type").first();
    await expect(reportType).toBeVisible();

    await page.waitForTimeout(2500);
  });

  test("TC-STS-REP-002: ผู้บริหารกดสร้างรายงานพรีวิวและตรวจสอบตารางสรุปข้อมูล", async ({ page }) => {
    await page.goto("/director/reports");

    const generateBtn = page.locator("#generate-report-btn, button:has-text('สร้างรายงาน')").first();
    await generateBtn.click();

    const table = page.locator("table").first();
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("CASE-2026-001");

    await page.waitForTimeout(2500);
  });

  test("TC-STS-REP-003: ตรวจสอบความพร้อมของปุ่ม Export Excel และ PDF", async ({ page }) => {
    await page.goto("/director/reports");

    const generateBtn = page.locator("#generate-report-btn, button:has-text('สร้างรายงาน')").first();
    await generateBtn.click();
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10000 });

    const exportExcelBtn = page.locator("#export-excel-btn, button:has-text('Excel')").first();
    await expect(exportExcelBtn).toBeVisible();

    const exportPdfBtn = page.locator("#export-pdf-btn, button:has-text('PDF')").first();
    await expect(exportPdfBtn).toBeVisible();

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 99, username: "teacher_a", name: "ครูประจำชั้น", role: "TEACHER", roleName: "TEACHER", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-teacher",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Students for Tracking
    await page.route("**/api/students*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 101, studentCode: "50001", student_id: "50001", firstName: "กิตติพงษ์", first_name: "กิตติพงษ์", lastName: "สุขเกษม", last_name: "สุขเกษม", class_room: "ม.3/1", risk_level: "low", status: "active" },
          { id: 102, studentCode: "50002", student_id: "50002", firstName: "ชาญชัย", first_name: "ชาญชัย", lastName: "มีสุข", last_name: "มีสุข", class_room: "ม.3/1", risk_level: "high", status: "active" },
        ]),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีครู
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/teacher\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-TRK-001: ครูประจำชั้นเปิดหน้าติดตามพฤติกรรมและการเยี่ยมบ้าน", async ({ page }) => {
    await page.goto("/teacher/tracking");
    await expect(page).toHaveURL(/.*\\/teacher\\/tracking/);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });

  test("TC-STS-TRK-002: ค้นหารายชื่อนักเรียนในรายการติดตาม", async ({ page }) => {
    await page.goto("/teacher/tracking");

    const searchInput = page.getByPlaceholder(/ค้นหาชื่อ, รหัส/i).first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill("ชาญชัย");
    await page.waitForTimeout(500);

    await expect(page.locator("body")).toContainText("ชาญชัย");

    await page.waitForTimeout(2500);
  });

  test("TC-STS-TRK-003: กรองข้อมูลการติดตามตามระดับความเสี่ยง", async ({ page }) => {
    await page.goto("/teacher/tracking");

    const riskFilter = page.locator("#risk-filter, button:has-text('ความเสี่ยง')").first();
    if (await riskFilter.isVisible()) {
      await riskFilter.click();
      await page.waitForTimeout(400);

      const highRiskOption = page.getByRole("option", { name: /เสี่ยงสูง/i }).first();
      if (await highRiskOption.isVisible()) {
        await highRiskOption.click();
        await page.waitForTimeout(500);
        await expect(page.locator("body")).toContainText("ชาญชัย");
      }
    }

    await page.waitForTimeout(2500);
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
  let activeUser = {
    id: 2,
    username: "director_a",
    name: "ผู้อำนวยการ",
    role: "SCHOOL_DIRECTOR",
    roleName: "SCHOOL_DIRECTOR",
    schoolId: 1,
  };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      let postData: { username?: string; password?: string } | null = null;
      try {
        postData = route.request().postDataJSON();
      } catch {
        postData = null;
      }
      const { username } = postData || {};
      let role = "TEACHER";
      let roleName = "TEACHER";
      if (username?.includes("director")) { role = "SCHOOL_DIRECTOR"; roleName = "SCHOOL_DIRECTOR"; }
      else if (username?.includes("admin")) { role = "SCHOOL_ADMIN"; roleName = "SCHOOL_ADMIN"; }
      else if (username?.includes("officer")) { role = "PROVINCE_OFFICER"; roleName = "PROVINCE_OFFICER"; }

      activeUser = {
        id: username?.includes("director") ? 2 : username?.includes("admin") ? 1 : 99,
        username: username || "teacher_a",
        name: username?.includes("director") ? "ผู้อำนวยการ" : username?.includes("admin") ? "ผู้ดูแลระบบ" : "ครูประจำชั้น",
        role,
        roleName,
        schoolId: 1,
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-dashboard",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
  });

  test("TC-STS-DASH-001: ผู้อำนวยการเปิดดู Action Center และการ์ด KPI สรุปสถานศึกษา", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("director_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/director\\/dashboard/, { timeout: 15000 });

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const metricCards = page.locator(".card, [data-testid*='metric'], .grid > div");
    await expect(metricCards.first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });

  test("TC-STS-DASH-002: ครูเปิดดูแดชบอร์ดห้องเรียนและสถิติการเข้าเรียนประจำวัน", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/teacher\\/dashboard/, { timeout: 15000 });

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });

  test("TC-STS-DASH-003: นำทางผ่านเมนูทางลัดไปยังโมดูลจัดการเคสและระบบรายงาน", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("director_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/director\\/dashboard/, { timeout: 15000 });

    const reportsLink = page.getByRole("link", { name: /รายงาน/i }).first();
    if (await reportsLink.isVisible()) {
      await reportsLink.click();
      await expect(page).toHaveURL(/.*\\/reports/);
    }

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 1, username: "admin", name: "ผู้ดูแลระบบ", role: "SCHOOL_ADMIN", roleName: "SCHOOL_ADMIN", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-admin",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock AI Benchmark Evaluation API
    await page.route("**/api/ai-case-assessments/**", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          experimentId: "exp-001",
          runId: "run-zero-shot-001",
          status: "COMPLETED",
          totalCases: 25,
          successCases: 25,
          failedCases: 0,
          accuracy: 96.0,
          f1Score: 0.94,
          metrics: { precision: 0.95, recall: 0.93 },
        }),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีแอดมิน
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("admin_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/admin/, { timeout: 15000 });
  });

  test("TC-STS-AI-001: ผู้ดูแลระบบเปิดหน้าจอประเมินและทดสอบระบบ AI", async ({ page }) => {
    await page.goto("/admin/ai-evaluation");
    await expect(page).toHaveURL(/.*\\/admin\\/ai-evaluation/);

    const header = page.locator("h1").first();
    await expect(header).toContainText("การประเมินและทดสอบระบบ AI");

    const runInput = page.getByPlaceholder(/ระบุ Run ID/i).first();
    const runBtn = page.getByRole("button", { name: /เริ่มการประเมิน Benchmark/i }).first();

    await expect(runInput).toBeVisible({ timeout: 10000 });
    await expect(runBtn).toBeVisible();

    await page.waitForTimeout(2500);
  });

  test("TC-STS-AI-002: สั่งรันการประเมินโมเดล AI และตรวจสอบค่าสถิติความแม่นยำ", async ({ page }) => {
    await page.goto("/admin/ai-evaluation");

    await page.getByPlaceholder(/ระบุ Run ID/i).fill("run-zero-shot-001");
    await page.getByRole("button", { name: /เริ่มการประเมิน Benchmark/i }).click();

    await expect(page.getByText("run-zero-shot-001")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("COMPLETED")).toBeVisible();
    await expect(page.getByText("จำนวนเคสทั้งหมด").first()).toBeVisible();

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 5, username: "province_officer", name: "เจ้าหน้าที่เขต กทม.", role: "PROVINCE_OFFICER", roleName: "PROVINCE_OFFICER", provinceId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth สำหรับเจ้าหน้าที่จังหวัด
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-province",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Province & Dashboard API
    await page.route("**/api/provinces*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, name: "กรุงเทพมหานคร" }]),
      });
    });

    await page.route("**/api/dashboard/province*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provinceId: 1,
          provinceName: "กรุงเทพมหานคร",
          summary: { totalSchools: 50, totalStudents: 25000, highRiskCount: 12 },
          schools: [{ id: 1, name: "โรงเรียนสาธิต STS", totalStudents: 500, riskCount: 3 }],
        }),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่จังหวัด
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("province_officer");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/province\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-PRV-001: เจ้าหน้าที่เขต/จังหวัดเปิดดูแดชบอร์ดสรุปภาพรวมพื้นที่", async ({ page }) => {
    await page.goto("/province/dashboard");
    await expect(page).toHaveURL(/.*\\/province\\/dashboard/);

    await expect(page.getByText("กรุงเทพมหานคร").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/โรงเรียน|สถานศึกษา/i).first()).toBeVisible();

    await page.waitForTimeout(2500);
  });

  test("TC-STS-PRV-002: ตรวจสอบความปลอดภัยข้อมูลส่วนบุคคล (No Individual Student PII)", async ({ page }) => {
    await page.goto("/province/reports");
    await expect(page).toHaveURL(/.*\\/province\\/reports/);

    await expect(page.getByText(/รายงานระดับจังหวัด/i).first()).toBeVisible();
    await expect(page.getByText(/ไม่มีข้อมูลนักเรียนรายบุคคล/i).first()).toBeVisible();

    await expect(page.getByRole("tab", { name: /สร้างรายงาน/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /เปรียบเทียบโรงเรียน/i })).toBeVisible();

    await page.waitForTimeout(2500);
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
  let activeUser = { id: 99, username: "teacher_a", name: "ครูประจำชั้น", role: "TEACHER", roleName: "TEACHER", schoolId: 1 };

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();

    // 1. Mock Auth
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-teacher",
          user: activeUser,
        }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
    // 2. Mock Change Password API
    await page.route("**/api/auth/change-password*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จแล้ว" }),
      });
    });

    // เข้าสู่ระบบด้วยบัญชีครู
    await page.goto("/login");
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/teacher\\/dashboard/, { timeout: 15000 });
  });

  test("TC-STS-PWD-001: ผู้ใช้เปิดหน้าจอเปลี่ยนรหัสผ่านและตรวจสอบเงื่อนไขความปลอดภัย", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page).toHaveURL(/.*\\/change-password/);

    await expect(page.locator("h1")).toHaveText("เปลี่ยนรหัสผ่าน");

    await expect(page.locator("#oldPassword")).toBeVisible();
    await expect(page.locator("#newPassword")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    const submitBtn = page.locator("#change-password-submit");
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    await page.waitForTimeout(2500);
  });

  test("TC-STS-PWD-002: ผู้ใช้กรอกรหัสผ่านใหม่ที่ถูกต้องและบันทึกสำเร็จ", async ({ page }) => {
    await page.goto("/change-password");

    await page.locator("#oldPassword").fill("changeme");
    await page.locator("#newPassword").fill("SecurePass2026!");
    await page.locator("#confirmPassword").fill("SecurePass2026!");

    const submitBtn = page.locator("#change-password-submit");
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();

    await expect(page.getByText(/เปลี่ยนรหัสผ่านสำเร็จแล้ว/i)).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2500);
  });
});
`,
  },
};

export const STS_SUB_TEMPLATES: Record<string, FunctionTemplate> = {
  "FN-STS-01-ROLES": {
    id: "FN-STS-01-ROLES",
    name: "FN-STS-01 (Part 1) · เข้าสู่ระบบสำเร็จตามสิทธิ์ (Login as Role)",
    shortName: "เข้าสู่ระบบสำเร็จ",
    relativePath: "e2e/sts/specs/01-auth-login-roles.spec.ts",
    description: "ทดสอบการเข้าสู่ระบบตามบทบาทผู้ใช้ (Teacher, Director, Admin, Officer) และการ Redirect ไปยังแดชบอร์ดที่ถูกต้อง",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 (Part 1): เข้าสู่ระบบสำเร็จตามสิทธิ์ (Login as Role)
// 🎯 วัตถุประสงค์: ตรวจสอบการ Login ตามบทบาทผู้ใช้ และการ Redirect ไปยังแดชบอร์ดตามสิทธิ์
// 👥 บทบาทผู้ใช้: ครูประจำชั้น (Teacher), ผู้บริหาร (Director), แอดมิน (Admin), เจ้าหน้าที่ (Officer)
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-01 (Part 1): Login as Role Suite", () => {
  let activeUser = {
    id: 99,
    username: "teacher_a",
    name: "ผู้ใช้ทดสอบ (teacher_a)",
    role: "TEACHER",
    roleName: "TEACHER",
    schoolId: 1,
    provinceId: 1,
  };

  // [Precondition]: ล้างคุกกี้และตั้งค่า Route Mocking ก่อนเริ่มทดสอบ
  test.beforeEach(async ({ page }) => {
    // 1. ล้างคุกกี้ทั้งหมดเพื่อจำลองสถานะก่อนเริ่มล็อกอิน
    await page.context().clearCookies();
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });

    activeUser = {
      id: 99,
      username: "teacher_a",
      name: "ผู้ใช้ทดสอบ (teacher_a)",
      role: "TEACHER",
      roleName: "TEACHER",
      schoolId: 1,
      provinceId: 1,
    };

    // 2. จำลอง Mock Auth Login API ให้สำเร็จและคืนค่า Token ตาม Role
    await page.route("**/api/auth/login", async (route) => {
      let postData: { username?: string; password?: string } | null = null;
      try {
        postData = route.request().postDataJSON();
      } catch {
        postData = null;
      }
      const { username, password } = postData || {};

      if (password === "changeme") {
        let role = "TEACHER";
        let roleName = "TEACHER";
        let displayName = "ครูประจำชั้น (teacher_a)";
        if (username?.includes("director")) {
          role = "SCHOOL_DIRECTOR";
          roleName = "SCHOOL_DIRECTOR";
          displayName = "ผู้อำนวยการ (director_a)";
        } else if (username?.includes("admin")) {
          role = "SCHOOL_ADMIN";
          roleName = "SCHOOL_ADMIN";
          displayName = "ผู้ดูแลระบบ (admin_a)";
        } else if (username?.includes("officer")) {
          role = "PROVINCE_OFFICER";
          roleName = "PROVINCE_OFFICER";
          displayName = "เจ้าหน้าที่เขต (province_officer)";
        } else if (username?.includes("platform")) {
          role = "PLATFORM_ADMIN";
          roleName = "PLATFORM_ADMIN";
          displayName = "ผู้ดูแลระบบกลาง (platform_admin)";
        }

        activeUser = {
          id: username?.includes("director") ? 2 : username?.includes("admin") ? 1 : 99,
          username: username || "teacher_a",
          name: displayName,
          role,
          roleName,
          schoolId: 1,
          provinceId: 1,
        };

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "mock-jwt-token-workspace",
            user: activeUser,
          }),
        });
      }

      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
  });

  // [เคสทดสอบที่ 1]: ทดสอบเข้าสู่ระบบในฐานะครูประจำชั้น
  test("TC-STS-AUTH-TEACHER: Login as teacher succeeds and redirects", async ({ page }) => {
    // [ขั้นตอนที่ 1]: เปิดไปยังหน้าเข้าสู่ระบบ (/login)
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: กรอกชื่อผู้ใช้และรหัสผ่านของครูประจำชั้น
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");

    // [ขั้นตอนที่ 3]: คลิกปุ่ม 'เข้าสู่ระบบ' (Submit Button)
    await page.locator("#login-submit, button[type='submit']").first().click();

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบนำทางออกจากหน้า /login ไปยังหน้าห้องเรียน/แดชบอร์ดครู
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/(?:teacher|students|dashboard)/, { timeout: 15000 });

    // [ขั้นตอนที่ 5]: หน่วงเวลา 2.5 วินาทีเพื่อให้เห็นผลลัพธ์บนหน้าจอในโหมด Headed
    await page.waitForTimeout(2500);
  });

  // [เคสทดสอบที่ 2]: ทดสอบเข้าสู่ระบบในฐานะผู้บริหารสถานศึกษา
  test("TC-STS-AUTH-DIRECTOR: Login as director succeeds and redirects", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    await page.locator("#login-username, input[name='username']").first().fill("director_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();

    // ตรวจสอบการนำทางไปยังหน้าแดชบอร์ดสถิติผู้บริหาร
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/(?:director|reports|dashboard)/, { timeout: 15000 });
    await page.waitForTimeout(2500);
  });

  // [เคสทดสอบที่ 3]: ทดสอบเข้าสู่ระบบในฐานะแอดมินสถานศึกษา
  test("TC-STS-AUTH-ADMIN: Login as admin succeeds and redirects", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    await page.locator("#login-username, input[name='username']").first().fill("admin_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();

    // ตรวจสอบการนำทางไปยังหน้าคอนโซลแอดมิน
    await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\\/(?:admin|dashboard)/, { timeout: 15000 });
    await page.waitForTimeout(2500);
  });
});
`,
  },

  "FN-STS-01-INVALID": {
    id: "FN-STS-01-INVALID",
    name: "FN-STS-01 (Part 2) · ตรวจสอบความปลอดภัยเมื่อรหัสผ่านผิด (Invalid Credentials)",
    shortName: "รหัสผ่านผิด",
    relativePath: "e2e/sts/specs/01-auth-invalid-credentials.spec.ts",
    description: "ทดสอบการปฏิเสธการเข้าสู่ระบบเมื่อกรอกรหัสผ่านไม่ถูกต้อง และตรวจสอบว่าระบบต้องแสดง Alert แจ้งเตือนข้อผิดพลาด",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 (Part 2): ตรวจสอบความปลอดภัยเมื่อรหัสผ่านไม่ถูกต้อง
// 🎯 วัตถุประสงค์: ตรวจสอบว่าระบบปฏิเสธการเข้าถึง และแสดงข้อความเตือน Error Alert สีแดง
// 🛡️ ระดับความปลอดภัย: Authentication Security Check
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-01 (Part 2): Invalid Credentials Suite", () => {
  // [Precondition]: ล้างคุกกี้และตั้งค่า Route Mocking สำหรับกรณีรหัสผ่านผิด (401)
  test.beforeEach(async ({ page }) => {
    // 1. ล้างคุกกี้เพื่อจำลองสถานะยังไม่ได้ล็อกอิน
    await page.context().clearCookies();

    // 2. จำลอง Mock API ให้ตอบกลับ 401 Unauthorized พร้อมข้อความแจ้งเตือน
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }),
      });
    });
  });

  // [เคสทดสอบ]: ตรวจสอบการปฏิเสธและแสดงข้อความแจ้งเตือน Error Alert
  test("TC-STS-AUTH-INVALID: Invalid credentials displays an error alert", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้า Login
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: กรอกชื่อผู้ใช้จำลองและรหัสผ่านที่ไม่ถูกต้อง
    const usernameInput = page.locator("#login-username, input[name='username']").first();
    const passwordInput = page.locator("#login-password, input[name='password']").first();
    await usernameInput.fill("invalid_user");
    await passwordInput.fill("wrong_password_999");

    // [ขั้นตอนที่ 3]: คลิกปุ่มเข้าสู่ระบบ (Submit)
    await page.locator("#login-submit, button[type='submit']").first().click();

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าต้องมีกล่องข้อความเตือน Error Alert ปรากฏขึ้นบนหน้าจอ
    const alertBox = page.locator("[role='alert']:not(#__next-route-announcer__), .text-rose-500, .bg-rose-950, [data-testid='error-alert']");
    await expect(alertBox.first()).toBeVisible({ timeout: 10000 });

    // [ขั้นตอนที่ 5]: ตรวจสอบว่าระบบต้องไม่หลุดออกจากหน้า /login (URL ยังคงเป็น /login)
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 6]: หน่วงเวลา 2.5 วินาทีเพื่อให้ตรวจสอบ UI ในโหมด Headed
    await page.waitForTimeout(2500);
  });
});
`,
  },

  "FN-STS-01-EMPTY": {
    id: "FN-STS-01-EMPTY",
    name: "FN-STS-01 (Part 3) · ปฏิเสธการส่งฟอร์มเมื่อเว้นว่าง (Empty Credentials)",
    shortName: "เว้นว่างรหัสผ่าน",
    relativePath: "e2e/sts/specs/01-auth-empty-submission.spec.ts",
    description: "ทดสอบการส่งฟอร์มโดยไม่กรอก Username หรือ Password ระบบต้องปฏิเสธและแสดงข้อความแจ้งเตือนให้กรอกข้อมูล",
    code: `// ==============================================================
// 🧪 ชุดทดสอบ: FN-STS-01 (Part 3): ตรวจสอบการเว้นว่างฟิลด์เข้าสู่ระบบ (Empty Submission)
// 🎯 วัตถุประสงค์: ตรวจสอบว่าระบบปฏิเสธการส่งฟอร์มเมื่อเว้นว่าง Username หรือ Password
// 🛡️ ระดับความปลอดภัย: Client-side / Form Validation Check
// ==============================================================
import { test, expect } from "@playwright/test";

test.describe("FN-STS-01 (Part 3): Empty Submission Suite", () => {
  // [Precondition]: ล้างคุกกี้ก่อนเริ่มทดสอบ
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // [เคสทดสอบ]: เว้นว่าง Username และ Password แล้วกดส่งฟอร์ม
  test("TC-STS-AUTH-EMPTY: Empty username/password submission is rejected", async ({ page }) => {
    // [ขั้นตอนที่ 1]: นำทางไปยังหน้า Login
    await page.goto("/login");
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 2]: ไม่กรอกข้อมูลใดๆ ในช่อง Username และ Password (ปล่อยว่าง)
    const usernameInput = page.locator("#login-username, input[name='username']").first();
    const passwordInput = page.locator("#login-password, input[name='password']").first();
    await usernameInput.fill("");
    await passwordInput.fill("");

    // [ขั้นตอนที่ 3]: คลิกปุ่มเข้าสู่ระบบทันทีโดยไม่กรอกข้อมูล
    const submitBtn = page.locator("#login-submit, button[type='submit']").first();
    await submitBtn.click();

    // [ขั้นตอนที่ 4]: ตรวจสอบว่าระบบยังคงอยู่ที่หน้า /login ไม่เปลี่ยนเส้นทาง
    await expect(page).toHaveURL(/.*\\/login/);

    // [ขั้นตอนที่ 5]: ตรวจสอบว่ามี Alert หรือ Validation Message เตือนให้กรอกข้อมูล
    const validationOrAlert = page.locator("[role='alert'], :invalid, .text-rose-500, input:invalid");
    await expect(validationOrAlert.first()).toBeVisible({ timeout: 5000 });

    // [ขั้นตอนที่ 6]: หน่วงเวลา 2.5 วินาทีเพื่อให้สังเกตผลลัพธ์บนหน้าจอ
    await page.waitForTimeout(2500);
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

  // 1. Direct dictionary match by ID
  if (STS_SUB_TEMPLATES[upper]) {
    return STS_SUB_TEMPLATES[upper];
  }
  if (STS_FUNCTION_TEMPLATES[upper]) {
    return STS_FUNCTION_TEMPLATES[upper];
  }

  // 2. Granular sub-part templates (must be checked BEFORE general FN-STS-01 catch-all)
  if (
    upper === "FN-STS-01-INVALID" ||
    upper.includes("AUTH-INVALID") ||
    upper.includes("INVALID") ||
    upper.includes("รหัสผ่านผิด") ||
    upper.includes("รหัสผิด")
  ) {
    return STS_SUB_TEMPLATES["FN-STS-01-INVALID"];
  }

  if (
    upper === "FN-STS-01-EMPTY" ||
    upper.includes("AUTH-EMPTY") ||
    upper.includes("EMPTY") ||
    upper.includes("เว้นว่าง")
  ) {
    return STS_SUB_TEMPLATES["FN-STS-01-EMPTY"];
  }

  if (
    upper === "FN-STS-01-ROLES" ||
    upper.includes("ROLES") ||
    upper.includes("AUTH-ROLE") ||
    upper.includes("AUTH-TEACHER") ||
    upper.includes("AUTH-DIRECTOR") ||
    upper.includes("AUTH-ADMIN") ||
    upper.includes("AUTH-OFFICER") ||
    (upper.includes("AUTH") && upper.includes("SUCCEEDS")) ||
    (upper.includes("LOGIN") && upper.includes("SUCCEEDS"))
  ) {
    return STS_SUB_TEMPLATES["FN-STS-01-ROLES"];
  }

  // 3. Category & function matching
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
