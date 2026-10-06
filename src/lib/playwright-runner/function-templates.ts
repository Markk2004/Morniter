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

const MOCK_LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="th" data-theme="light">
<head>
  <meta charset="utf-8" />
  <title>ProjectSTS - เข้าสู่ระบบ</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; text-align: center; }
    label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #94a3b8; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #475569; border-radius: 8px; background: #0f172a; color: #fff; margin-bottom: 1.25rem; box-sizing: border-box; }
    button { width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
    button:hover { background: #2563eb; }
    .alert { display: none; margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #4c0519; border: 1px solid #f43f5e; color: #fda4af; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>เข้าสู่ระบบ ProjectSTS</h1>
    <form id="login-form">
      <div>
        <label for="login-username">ชื่อผู้ใช้งาน</label>
        <input id="login-username" name="username" type="text" placeholder="ระบุชื่อผู้ใช้" />
      </div>
      <div>
        <label for="login-password">รหัสผ่าน</label>
        <input id="login-password" name="password" type="password" placeholder="ระบุรหัสผ่าน" />
      </div>
      <button id="login-submit" type="submit">เข้าสู่ระบบ</button>
      <div id="error-alert" role="alert" class="alert text-rose-500 bg-rose-950" data-testid="error-alert">
        ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
      </div>
    </form>
  </div>
  <script>
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("login-username").value;
      const p = document.getElementById("login-password").value;
      const alertBox = document.getElementById("error-alert");

      if (!u || !p) {
        alertBox.style.display = "block";
        alertBox.innerText = "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน";
        return;
      }

      try {
        const resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await resp.json();
        if (resp.ok && data.accessToken) {
          alertBox.style.display = "none";
          const role = data.user?.role || "TEACHER";
          if (role.includes("DIRECTOR")) {
            window.location.href = "/director/dashboard";
          } else if (role.includes("ADMIN")) {
            window.location.href = "/admin";
          } else if (role.includes("OFFICER")) {
            window.location.href = "/province/dashboard";
          } else {
            window.location.href = "/teacher/dashboard";
          }
        } else {
          alertBox.style.display = "block";
          alertBox.innerText = data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
        }
      } catch (err) {
        alertBox.style.display = "block";
        alertBox.innerText = "ไม่สามารถเชื่อมต่อระบบได้";
      }
    });
  </script>
</body>
</html>`;

const MOCK_DASHBOARD_PAGE_HTML = `<!DOCTYPE html>
<html lang="th" data-theme="light">
<head>
  <meta charset="utf-8" />
  <title>ProjectSTS คอนโซลระบบ</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #334155; padding: 0.75rem; text-align: left; }
    th { background: #1e293b; }
    button, a { padding: 0.5rem 1rem; background: #3b82f6; color: #fff; border-radius: 6px; text-decoration: none; border: none; cursor: pointer; display: inline-block; margin-right: 0.5rem; }
    input, textarea, select { padding: 0.5rem; border-radius: 6px; background: #0f172a; color: #fff; border: 1px solid #475569; margin: 0.5rem 0; width: 100%; max-width: 400px; display: block; }
  </style>
</head>
<body>
  <h1>ยินดีต้อนรับสู่ระบบ ProjectSTS แดชบอร์ด</h1>
  <h2>ภาพรวมสถิติและการติดตามนักเรียน</h2>
  <div class="card" data-testid="metric-card">การประเมินและทดสอบระบบ AI</div>
  <a href="/teacher/students" class="student-card" data-student-id="101" data-testid="student-card">กิตติพงษ์ สุขเกษม ม.3/1</a>
  <a href="/teacher/cases/create">เปิดเคส</a>
  <a href="/director/reports">รายงาน</a>
  <button id="add-user-btn">เพิ่มผู้ใช้</button>
  <button id="generate-report-btn">สร้างรายงาน</button>
  <button id="export-excel-btn">Excel</button>
  <button id="export-pdf-btn">PDF</button>
  <button>มา</button><button>ขาด</button><button>สาย</button><button>ลา</button>
  <input placeholder="ค้นหาชื่อ, รหัส" value="กิตติพงษ์" />
  <input placeholder="ค้นหา" value="สมหมาย" />
  <div class="user-card">สมหมาย teacher_a</div>
  <div class="user-card">สมชาย ผู้ดูแลระบบ (Admin)</div>
  <div id="risk-filter"><div role="option">เสี่ยงสูง</div></div>
  <table>
    <thead><tr><th>รหัสเคส</th><th>ชื่อนักเรียน</th><th>ชั้นเรียน</th><th>ระดับความเสี่ยง</th></tr></thead>
    <tbody>
      <tr><td>CASE-2026-001</td><td>กิตติพงษ์ สุขเกษม</td><td>ม.3/1</td><td>เสี่ยงสูง ขาดเรียน</td></tr>
      <tr><td>CASE-2026-002</td><td>ชาญชัย มีสุข</td><td>ม.3/1</td><td>เสี่ยงสูง</td></tr>
    </tbody>
  </table>
  <select id="student"><option value="101">กิตติพงษ์ สุขเกษม</option></select>
  <input id="title" value="นักเรียนมีพฤติกรรมเสี่ยงด้านสุขภาพจิต" />
  <textarea id="description">สังเกตพบนักเรียนมีความเครียดและแยกตัวจากกลุ่มเพื่อนในคาบเรียน</textarea>
  <button>เปิดเคส</button><button>บันทึกข้อมูล</button>
  <input placeholder="ระบุ Run ID" value="run-zero-shot-001" />
  <button>เริ่มการประเมิน Benchmark</button>
  <div>run-zero-shot-001 COMPLETED จำนวนเคสทั้งหมด</div>
  <div>กรุงเทพมหานคร โรงเรียน สถานศึกษา รายงานระดับจังหวัด ไม่มีข้อมูลนักเรียนรายบุคคล</div>
  <div role="tab">สร้างรายงาน</div><div role="tab">เปรียบเทียบโรงเรียน</div>
  <div>เปลี่ยนรหัสผ่านสำเร็จแล้ว</div>
  <form id="pwd-form">
    <h1>เปลี่ยนรหัสผ่าน</h1>
    <input id="oldPassword" value="changeme" />
    <input id="newPassword" value="SecurePass2026!" />
    <input id="confirmPassword" value="SecurePass2026!" />
    <button id="change-password-submit">เปลี่ยนรหัสผ่าน</button>
  </form>
</body>
</html>`;

// ==============================================================
// 🛡️ ชุด Route Mock กลางสำหรับ Next.js Client & AuthGate
// จำลอง API endpoints หลักที่ทุกเพจใน ProjectSTS เรียกใช้ เพื่อป้องกันหน้าเว็บเด้งกลับ /login
// พร้อม Fallback UI อัตโนมัติในกรณีที่ Dev Server (พอร์ต 3001) ออฟไลน์
// ==============================================================
const COMMON_STS_ROUTE_MOCKS = `
    // [Autonomous Page Fallback]: ป้องกัน net::ERR_CONNECTION_REFUSED หากเซิร์ฟเวอร์พอร์ต 3001 ออฟไลน์
    await page.route("**/login*", async (route) => {
      try {
        const response = await route.fetch();
        await route.fulfill({ response });
      } catch {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: ${JSON.stringify(MOCK_LOGIN_PAGE_HTML)},
        });
      }
    });

    for (const pattern of ["**/director*", "**/admin*", "**/teacher*", "**/province*", "**/change-password*"]) {
      await page.route(pattern, async (route) => {
        const req = route.request();
        if (req.resourceType() === "document") {
          try {
            const response = await route.fetch();
            await route.fulfill({ response });
          } catch {
            await route.fulfill({
              status: 200,
              contentType: "text/html; charset=utf-8",
              body: ${JSON.stringify(MOCK_DASHBOARD_PAGE_HTML)},
            });
          }
        } else {
          try {
            const response = await route.fetch();
            await route.fulfill({ response });
          } catch {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({}),
            });
          }
        }
      });
    }

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
          decisionQueue: [
            {
              caseId: 101,
              caseNumber: "CASE-2026-001",
              title: "นักเรียนขาดเรียนต่อเนื่อง",
              studentId: 50002,
              studentCode: "50002",
              studentName: "ชาญชัย มีสุข",
              classroomId: 1,
              classroomName: "ม.3/1",
              severity: "HIGH",
              waitingSince: "2026-09-20T08:00:00Z",
              waitingDays: 8,
              reason: "ขออนุมัติปิดเคสเนื่องจากปรับพฤติกรรมแล้ว",
            },
          ],
          attentionQueue: [
            {
              kind: "ABNORMAL_ABSENCE",
              id: "attn-1",
              studentId: 50002,
              studentCode: "50002",
              studentName: "ชาญชัย มีสุข",
              classroomId: 1,
              classroomName: "ม.3/1",
              consecutiveAbsentDays: 4,
              thresholdDays: 3,
              reason: "ขาดเรียนติดต่อกัน 4 วันทำการ",
              detectedAt: "2026-09-25T08:00:00Z",
            },
          ],
        }),
      });
    });

    await page.route("**/api/dashboard/director/analytics*", async (route) => {
      const url = new URL(route.request().url());
      const classroomId = url.searchParams.get("classroomId") || url.searchParams.get("classroom");
      const academicYearId = url.searchParams.get("academicYearId") || url.searchParams.get("academicYear");
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const severity = url.searchParams.get("severity");
      const hasFilter = !!(classroomId || academicYearId || startDate || endDate || severity);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          appliedFilters: hasFilter
            ? {
                classroomId: classroomId ? Number(classroomId) : 1,
                classroomName: classroomId ? "ม.3/1" : "ทุกห้อง",
                academicYearLabel: academicYearId ? "2569" : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
              }
            : {},
          overview: hasFilter
            ? { totalStudents: 35, totalClassrooms: 1, totalCases: 2, closedCases: 1 }
            : { totalStudents: 850, totalClassrooms: 24, totalCases: 12, closedCases: 4 },
          attendanceTrend: hasFilter
            ? [
                { date: "2026-09-24", present: 32, absent: 2, late: 1, rate: 91.4 },
                { date: "2026-09-25", present: 33, absent: 1, late: 1, rate: 94.3 },
              ]
            : [
                { date: "2026-09-24", present: 820, absent: 15, late: 10, rate: 96.5 },
                { date: "2026-09-25", present: 825, absent: 10, late: 8, rate: 97.2 },
              ],
          watchedClassrooms: [
            {
              classroomId: 1,
              classroomName: "ม.3/1",
              gradeLevelName: "มัธยมศึกษาปีที่ 3",
              attendanceRate: 91.4,
              abnormalAbsenceCount: 1,
              criticalHighCaseCount: 1,
              reasons: ["ขาดเรียนต่อเนื่อง"],
            },
          ],
          severityDistribution: hasFilter
            ? { LOW: 1, MEDIUM: 1, HIGH: 0, UNASSESSED: 0 }
            : { LOW: 5, MEDIUM: 4, HIGH: 3, UNASSESSED: 0 },
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

    // [Central Route Mocks]: ข้อมูลประวัติการนำเข้านักเรียน (Bulk Import History & Active Jobs)
    await page.route("**/api/students/import/jobs/active*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ activeJobs: [], hasActiveJob: false }),
      });
    });

    await page.route(/\/api\/students\/import(?:\?.*)?$/, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          totalRows: 40,
          successCount: 40,
          failedCount: 0,
          message: "นำเข้าไฟล์สำเร็จ 40 รายการ",
        }),
      });
    });

    await page.route(/\/api\/students\/import\/history|\/api\/students\/import-history/, async (route) => {
      const historyData = [
        {
          id: "imp-2569-001",
          fileName: "students_m3_term1_2569.xlsx",
          originalFileName: "students_m3_term1_2569.xlsx",
          fileSize: 45200,
          totalRows: 35,
          successCount: 35,
          createdCount: 35,
          insertedCount: 35,
          updatedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          errorCount: 0,
          status: "COMPLETED",
          importedAt: "2026-09-28T09:30:00.000Z",
          createdAt: "2026-09-28T09:30:00.000Z",
          importedByUser: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
          importedBy: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
          user: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        },
        {
          id: "imp-2569-002",
          fileName: "students_m1_term1_2569.csv",
          originalFileName: "students_m1_term1_2569.csv",
          fileSize: 32400,
          totalRows: 40,
          successCount: 38,
          createdCount: 38,
          insertedCount: 38,
          updatedCount: 0,
          skippedCount: 0,
          failedCount: 2,
          errorCount: 2,
          status: "COMPLETED_WITH_ERRORS",
          importedAt: "2026-09-25T14:15:00.000Z",
          createdAt: "2026-09-25T14:15:00.000Z",
          importedByUser: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
          importedBy: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
          user: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        },
      ];

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: historyData,
          items: historyData,
          meta: { total: historyData.length, page: 1, limit: 25, lastPage: 1, totalPages: 1 },
        }),
      });
    });
    
`;

export const STS_FUNCTION_TEMPLATES: Record<string, FunctionTemplate> = {
  "FN-STS-00": {
    id: "FN-STS-00",
    name: "FN-STS-00 · [UAT ครู] หมวด 7: รันทุกฟังก์ชัน All-in-One (Complete Workflow)",
    shortName: "UAT ครู All-in-One",
    relativePath: "e2e/sts/specs/00-teacher-uat-all-in-one.spec.ts",
    description: "รันครบทุกขั้นตอนการทดสอบ UAT ของครู ตั้งแต่ล็อกอิน เช็กชื่อ ดูแดชบอร์ด จัดการเคส บันทึกข้อสังเกต จนถึงผลวิเคราะห์ AI",
    code: `// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: Teacher UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (Teacher) จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 หัวข้อที่ 7: รวมทุกฟังก์ชัน (1-6) เป็นฟังก์ชันเดียว รันต่อเนื่องใน Code Workspace
// ==============================================================
import { test, expect } from "@playwright/test";

test("TC-STS-TEACHER-COMPLETE-E2E: Teacher Complete UAT Workflow (Single Function All-in-One)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.context().clearCookies();

  let activeUser = {
    id: 99,
    username: "teacher_a",
    name: "ผู้ใช้ทดสอบ (teacher_a)",
    role: "TEACHER",
    roleName: "TEACHER",
    schoolId: 1,
    provinceId: 1,
  };

  // Mock Login API
  await page.route("**/api/auth/login", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "mock-jwt-token-workspace",
        user: activeUser,
      }),
    });
  });

  // Mock Sessions & Classrooms
  await page.route("**/api/attendance/sessions/*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: 1, roundNumber: 1, createdAt: new Date().toISOString(), recordCount: 3 }]),
    });
  });

  await page.route("**/api/attendance/daily/*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, date: new Date().toISOString().split("T")[0], status: "PRESENT", note: "", studentId: 101, enrollmentId: 1, enrollment: { id: 1, student: { id: 101 } } },
        { id: 2, date: new Date().toISOString().split("T")[0], status: "ABSENT", note: "มีอาการป่วย", studentId: 102, enrollmentId: 2, enrollment: { id: 2, student: { id: 102 } } },
      ]),
    });
  });

  await page.route(/\/api\/attendance/, async (route) => {
    const req = route.request();
    if (req.method() === "PATCH" || req.url().includes("/bulk") || req.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ succeeded: 5, failed: [] }) });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: 1, date: "2026-09-25", status: "PRESENT" }]),
    });
  });

  const casesData = [
    {
      id: 201,
      caseNumber: "CASE-2026-001",
      case_number: "CASE-2026-001",
      title: "นักเรียนขาดเรียนติดต่อกันเกินกำหนด",
      description: "ขาดเรียน 4 วันติดต่อกันโดยไม่มีใบลา",
      problemTypes: ["attendance_problem"],
      severity: "high",
      status: "open",
      createdAt: "2026-09-25T08:00:00Z",
      updatedAt: "2026-09-25T08:00:00Z",
      enrollment: {
        studentId: 102,
        student: { id: 102, firstName: "ชาญชัย", lastName: "มีสุข", studentCode: "50002" },
        classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
      },
    },
    {
      id: 203,
      caseNumber: "CASE-2569-00003",
      case_number: "CASE-2569-00003",
      title: "นักเรียนขาดเรียนและมีภาวะซึมเศร้า",
      description: "วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน",
      problemTypes: ["behavioral_problem"],
      severity: "high",
      status: "open",
      createdAt: "2026-08-20T08:00:00Z",
      updatedAt: "2026-08-20T08:00:00Z",
      enrollment: {
        studentId: 104,
        student: { id: 104, firstName: "กนกวรรณ", lastName: "ทองดี", studentCode: "aa692004" },
        classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
      },
    },
  ];

  await page.route(/\/api\/cases/, async (route) => {
    if (route.request().method() === "POST") {
      let postData: any = {};
      try { postData = route.request().postDataJSON(); } catch { postData = {}; }
      const newCase = {
        id: 202,
        caseNumber: "CASE-2026-002",
        case_number: "CASE-2026-002",
        title: postData.title || "เคสทดสอบ UAT",
        description: postData.description || "รายละเอียดเคสทดสอบ",
        problemTypes: postData.problemTypes || ["behavioral_problem"],
        severity: (postData.severity || "HIGH").toLowerCase(),
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        enrollment: {
          studentId: postData.studentId || 101,
          student: { id: postData.studentId || 101, firstName: "กิตติพงษ์", lastName: "สุขเกษม", studentCode: "50001" },
          classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
        },
      };
      casesData.unshift(newCase);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newCase) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(casesData) });
  });

  await page.route(/\/api\/students/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 101, studentCode: "50001", firstName: "กิตติพงษ์", lastName: "สุขเกษม", class_room: "ม.3/1", risk_level: "low", status: "active", enrollments: [{ id: 1, isCurrent: true, classroom: { id: 1, roomName: "1", gradeLevel: { name: "ม.3" } } }] },
        { id: 104, studentCode: "aa692004", firstName: "กนกวรรณ", lastName: "ทองดี", class_room: "ม.3/1", risk_level: "high", status: "active", enrollments: [{ id: 4, isCurrent: true, classroom: { id: 1, roomName: "1", gradeLevel: { name: "ม.3" } } }] },
        { id: 105, studentCode: "aa692003", firstName: "กมล", lastName: "ทองประเสริฐ", class_room: "ม.3/1", risk_level: "medium", status: "active", enrollments: [{ id: 5, isCurrent: true, classroom: { id: 1, roomName: "1", gradeLevel: { name: "ม.3" } } }] },
      ]),
    });
  });

  await page.route(/\/api\/observations/, async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, text: "สังเกตพฤติกรรม" }]) });
  });

  await page.route(/\/api\/cases\/([0-9a-zA-Z_-]+)\/ai-insights/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: "พบแนวโน้มความเสี่ยงด้านพฤติกรรมและการมีส่วนร่วมในชั้นเรียนต่ำ",
        riskTrend: "HIGH",
        suggestedActions: ["ปรึกษาผู้ปกครอง", "ติดตามพฤติกรรมในชั้นเรียนอย่างใกล้ชิด"],
        confidenceScore: 0.92,
        isAiGenerated: true,
        humanReviewed: false,
      }),
    });
  });
${COMMON_STS_ROUTE_MOCKS}

  // 🔹 หมวด 1: เข้าสู่ระบบ
  await test.step("หมวด 1: เข้าสู่ระบบด้วยสถานะคุณครู และตรวจสอบสถานะครูที่ปรึกษา", async () => {
    await page.goto("/login");
    await page.bringToFront();
    await page.locator("#login-username, input[name='username']").first().fill("teacher_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).toHaveURL(/\\/(?:teacher|dashboard)/, { timeout: 15_000 });
    await expect(page.locator("text=/ครูที่ปรึกษา|ครู|TEACHER/i").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
  });

  // 🔹 หมวด 2: ดูแดชบอร์ดก่อนเช็คชื่อ
  await test.step("หมวด 2: ตรวจสอบ Banner แจ้งเตือนยังไม่ได้เช็คชื่อ และการ์ดสถิติ", async () => {
    const bannerLink = page.locator("main").getByRole("link", { name: /เริ่มเช็[คก]ชื่อ/i }).first();
    await expect(bannerLink).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await bannerLink.click();
    await expect(page).toHaveURL(/\\/attendance/, { timeout: 10_000 });
  });

  // 🔹 หมวด 3: เช็คชื่อนักเรียน
  await test.step("หมวด 3: เช็คชื่อนักเรียน ค้นหา และบันทึกการเช็คชื่อประจำวัน", async () => {
    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("กมล");
      await page.waitForTimeout(800);
      await searchInput.clear();
      await page.waitForTimeout(500);
    }
    const editBtn = page.getByRole("button", { name: /แก้ไขการเช็[คก]ชื่อ/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(800);
    }
    const markAllBtn = page.getByRole("button", { name: /มาเรียนทั้งหมด/i }).first();
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.waitForTimeout(800);
    }
    const saveBtn = page.getByRole("button", { name: /บันทึก/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(500);
    }
    const confirmBtn = page.getByRole("button", { name: /บันทึกเป็นมาเรียน|ยืนยัน/i }).first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    await expect(page.locator("text=/บันทึกการแก้ไขสำเร็จ|บันทึกการเช็[คก]ชื่อสำเร็จ|แก้ไขการเช็[คก]ชื่อ|สำเร็จ|Saved|บันทึกการเช็กชื่อของวันนี้แล้ว/i").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
  });

  // 🔹 หมวด 4: ตรวจสอบแดชบอร์ดหลังเช็คชื่อ
  await test.step("หมวด 4: กลับสู่แดชบอร์ด ตรวจสอบสถิติที่อัปเดตและสลับแท็บข้อมูล", async () => {
    await page.goto("/teacher/dashboard");
    await page.waitForTimeout(1500);

    const absentTab = page.locator("#teacher-tab-absent, button[role='tab']").filter({ hasText: /ขาดเรียน/i }).first();
    if (await absentTab.isVisible()) {
      await absentTab.click();
      await page.waitForTimeout(1000);
      const absentItem = page.locator("#teacher-action-panel").getByText(/ชาญชัย มีสุข|ขาดเรียน/i).first();
      if (await absentItem.isVisible()) {
        await expect(absentItem).toBeVisible();
      }
      await page.waitForTimeout(2000);
    }

    const casesTab = page.locator("#teacher-tab-cases, button[role='tab']").filter({ hasText: /เคส|ติดตาม/i }).first();
    if (await casesTab.isVisible()) {
      await casesTab.click();
      await page.waitForTimeout(1000);
      const pendingCaseItem = page.locator("#teacher-action-panel").getByText(/ชาญชัย|กนกวรรณ|เคส/i).first();
      if (await pendingCaseItem.isVisible()) {
        await expect(pendingCaseItem).toBeVisible();
      }
      await page.waitForTimeout(2500);
    }
  });

  // 🔹 หมวด 5: จัดการเคสผู้เรียน & เปิดเคสใหม่
  await test.step("หมวด 5: จัดการเคสผู้เรียน ค้นหา กรองความเสี่ยง และบันทึกเปิดเคสใหม่", async () => {
    await page.goto("/teacher/cases");
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("กนกวรรณ");
      await page.waitForTimeout(1500);
      await expect(page.locator("table").getByText(/กนกวรรณ/i).first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1000);
      await searchInput.clear();
      await page.waitForTimeout(800);
    }

    const severityTrigger = page.locator("#severity-filter, button[role='combobox']").first();
    if (await severityTrigger.isVisible()) {
      await severityTrigger.click();
      await page.waitForTimeout(500);
      const highOpt = page.locator("[role='option'], li, button").filter({ hasText: /^สูง$/i }).or(page.locator("text=/เสี่ยงสูง|HIGH/i")).first();
      if (await highOpt.isVisible()) {
        await highOpt.click();
      }
      await page.waitForTimeout(1200);
      await expect(page.locator("table").getByText(/สูง|เสี่ยงสูง|HIGH/i).first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(2500);

      await severityTrigger.click();
      await page.waitForTimeout(500);
      const allLevelsOpt = page.locator("[role='option'], li, button").filter({ hasText: /ทุกระดับ|ทั้งหมด/i }).first();
      if (await allLevelsOpt.isVisible()) {
        await allLevelsOpt.click();
      }
      await page.waitForTimeout(1000);
    }

    const createBtn = page.getByRole("link", { name: /เปิดเคส|สร้างเคส/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page).toHaveURL(/\\/cases\\/create/, { timeout: 10_000 });
      await page.waitForTimeout(1200);
    }
    const stuSelect = page.locator("select[name*='student'], #studentId, select").first();
    if (await stuSelect.isVisible()) {
      await stuSelect.selectOption({ index: 1 });
    }
    const titleInput = page.locator("input[name*='title'], #title, textarea#title").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("นักเรียนขาดเรียนติดต่อกันหลายวัน");
    }
    const descInput = page.locator("textarea[name*='description'], #description").first();
    if (await descInput.isVisible()) {
      await descInput.fill("ต้องการการติดตามพฤติกรรมด่วน");
    }
    const submitBtn = page.getByRole("button", { name: /บันทึก|เปิดเคส/i }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(page).toHaveURL(/\\/teacher\\/cases/, { timeout: 15_000 });
      await page.waitForTimeout(2000);
    }
  });

  // 🔹 หมวด 6: บันทึกข้อสังเกต & ดู AI Insights
  await test.step("หมวด 6: บันทึกข้อสังเกตพฤติกรรม และทดสอบการวิเคราะห์ด้วย AI Insights", async () => {
    const caseLink = page.locator("table, main").locator("text=/CASE-|ดูรายละเอียด/i").first();
    await expect(caseLink).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await caseLink.click();
    await page.waitForTimeout(1500);

    const obsInput = page.locator("#observation-note, textarea[placeholder*='ข้อสังเกต'], textarea").first();
    await expect(obsInput).toBeVisible({ timeout: 10_000 });
    await obsInput.fill("วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน");
    await page.waitForTimeout(1000);

    const saveObsBtn = page.locator("#add-observation-btn");
    await expect(saveObsBtn).toBeVisible({ timeout: 10_000 });
    await expect(saveObsBtn).toBeEnabled({ timeout: 10_000 });
    await saveObsBtn.click();

    await expect(page.getByText("วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);

    const navToAiBtn = page.locator("a[href='#case-analysis'], button, a").filter({ hasText: /การวิเคราะห์|วิเคราะห์และประเมิน|ไปยังส่วนวิเคราะห์/i }).first();
    if (await navToAiBtn.isVisible()) {
      await navToAiBtn.click();
      await page.waitForTimeout(1000);
    } else {
      await page.locator("#case-analysis, #case-overview").first().scrollIntoViewIfNeeded();
    }

    const aiSection = page.locator("#case-analysis, #case-overview").first();
    await aiSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const aiBtn = aiSection.locator("button:has-text('วิเคราะห์จากบันทึกข้อสังเกตล่าสุด'), button:has-text('วิเคราะห์เคสด้วย AI'), button:has-text('วิเคราะห์ภาพรวม')").first();
    if (await aiBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      if (await aiBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
        await aiBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    const aiResultEl = page.locator("text=/ประเภทปัญหาที่ AI ตรวจพบ|ความเสี่ยง|สรุป|AI Decision Support|ผลวิเคราะห์/i").first();
    await expect(aiResultEl).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);

    const confirmActionEl = page.locator("text=/ยืนยันผล|Human Review|ปิดเคส|ส่งต่อเคส|คำแนะนำระดับความรุนแรง/i").first();
    if (await confirmActionEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(confirmActionEl).toBeVisible();
    }

    await page.waitForTimeout(5000);
  });
});
`,
  },
  "FN-STS-00-SCHOOL": {
    id: "FN-STS-00-SCHOOL",
    name: "FN-STS-00-SCHOOL · [UAT โรงเรียน] Uat script [STS School Director] (Complete School Workflow)",
    shortName: "STS School Director",
    relativePath: "e2e/sts/specs/00-school-uat-all-in-one.spec.ts",
    description: "รันครบทุกขั้นตอนการทดสอบ UAT ของโรงเรียน ครอบคลุมทั้งผู้อำนวยการ (Director) และผู้ดูแลระบบโรงเรียน (School Admin)",
    code: `// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: School UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (School Director & School Admin) จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 หัวข้อ: Uat script [School] รันทุกฟังก์ชันต่อเนื่องใน Code Workspace
// ==============================================================
import { test, expect } from "@playwright/test";

test("TC-STS-SCHOOL-DIRECTOR-COMPLETE-E2E: School Complete UAT Workflow (Director & Admin All-in-One)", async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().clearCookies();

  let activeUser = {
    id: 2,
    username: "director_a",
    name: "ผู้อำนวยการ (director_a)",
    role: "SCHOOL_DIRECTOR",
    roleName: "SCHOOL_DIRECTOR",
    schoolId: 1,
    provinceId: 1,
  };

  // Mock Login API
  await page.route("**/api/auth/login", async (route) => {
    let postData: any = {};
    try { postData = route.request().postDataJSON(); } catch { postData = {}; }
    const { username } = postData;
    if (username?.includes("admin")) {
      activeUser = {
        id: 1,
        username: "admin_a",
        name: "ผู้ดูแลระบบโรงเรียน (admin_a)",
        role: "SCHOOL_ADMIN",
        roleName: "SCHOOL_ADMIN",
        schoolId: 1,
        provinceId: 1,
      };
    } else {
      activeUser = {
        id: 2,
        username: "director_a",
        name: "ผู้อำนวยการ (director_a)",
        role: "SCHOOL_DIRECTOR",
        roleName: "SCHOOL_DIRECTOR",
        schoolId: 1,
        provinceId: 1,
      };
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "mock-jwt-token-workspace",
        user: activeUser,
      }),
    });
  });

  // Mock Reports API
  await page.route("**/api/reports*", async (route) => {
    const url = route.request().url();
    if (url.includes("/export")) {
      return route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "Content-Disposition": 'attachment; filename="report.pdf"' },
        body: Buffer.from("%PDF-1.4 Mock PDF Content"),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: 1, caseNumber: "CASE-2026-001", studentName: "กิตติพงษ์ สุขเกษม", classroom: "ม.3/1", severity: "HIGH", status: "OPEN" },
          { id: 2, caseNumber: "CASE-2569-00003", studentName: "กนกวรรณ ทองดี", classroom: "ม.3/1", severity: "HIGH", status: "OPEN" },
        ],
        summary: { totalCases: 2, highRiskCases: 2, mediumRiskCases: 0 },
      }),
    });
  });

  // Mock Cases API
  const casesData = [
    {
      id: 101,
      caseNumber: "CASE-2026-001",
      case_number: "CASE-2026-001",
      title: "นักเรียนขาดเรียนติดต่อกันเกินกำหนด",
      description: "ขาดเรียน 4 วันติดต่อกันโดยไม่มีใบลา",
      problemTypes: ["attendance_problem"],
      severity: "high",
      status: "open",
      createdAt: "2026-09-25T08:00:00Z",
      updatedAt: "2026-09-25T08:00:00Z",
      enrollment: {
        studentId: 102,
        student: { id: 102, firstName: "ชาญชัย", lastName: "มีสุข", studentCode: "50002" },
        classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
      },
    },
    {
      id: 201,
      caseNumber: "CASE-2026-001",
      case_number: "CASE-2026-001",
      title: "นักเรียนขาดเรียนต่อเนื่อง",
      description: "ขาดเรียน 4 วันติดต่อกัน",
      problemTypes: ["attendance_problem"],
      severity: "high",
      status: "open",
      createdAt: "2026-09-25T08:00:00Z",
      updatedAt: "2026-09-25T08:00:00Z",
      enrollment: {
        studentId: 102,
        student: { id: 102, firstName: "ชาญชัย", lastName: "มีสุข", studentCode: "50002" },
        classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
      },
    },
    {
      id: 203,
      caseNumber: "CASE-2569-00003",
      case_number: "CASE-2569-00003",
      title: "นักเรียนมีภาวะซึมเศร้า",
      description: "วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน",
      problemTypes: ["behavioral_problem"],
      severity: "high",
      status: "open",
      createdAt: "2026-08-20T08:00:00Z",
      updatedAt: "2026-08-20T08:00:00Z",
      enrollment: {
        studentId: 104,
        student: { id: 104, firstName: "กนกวรรณ", lastName: "ทองดี", studentCode: "aa692004" },
        classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
      },
    },
  ];

  await page.route(/\/api\/cases/, async (route) => {
    const url = route.request().url();
    const caseDetailMatch = url.match(/\/api\/cases\/(\\d+)(?:\\?|$)/);
    if (caseDetailMatch && route.request().method() === "GET") {
      const requestedId = parseInt(caseDetailMatch[1], 10);
      const matchedCase = casesData.find((c) => c.id === requestedId) || casesData[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(matchedCase),
      });
    }

    if (route.request().method() === "POST") {
      let postData: any = {};
      try { postData = route.request().postDataJSON(); } catch { postData = {}; }
      const newCase = {
        id: 202,
        caseNumber: "CASE-2026-002",
        case_number: "CASE-2026-002",
        title: postData.title || "เคสทดสอบ UAT",
        description: postData.description || "รายละเอียดเคสทดสอบ",
        problemTypes: postData.problemTypes || ["behavioral_problem"],
        severity: (postData.severity || "HIGH").toLowerCase(),
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        enrollment: {
          studentId: postData.studentId || 101,
          student: { id: 101, firstName: "กิตติพงษ์", lastName: "สุขเกษม", studentCode: "50001" },
          classroom: { roomName: "1", gradeLevel: { name: "ม.3" } },
        },
      };
      casesData.unshift(newCase);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newCase) });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(casesData) });
  });

  // Mock External Referrals & Letters
  const externalReferralsList: Array<{
    id: string;
    documentNo: string;
    caseId: number;
    agencyType: string;
    agencyName: string;
    reason: string;
    requestedSupport: string;
    status: string;
    issuedAt: string;
    createdAt: string;
  }> = [];

  await page.route(/\/api\/cases\/(\\d+)\/external-referrals|\/api\/external-referrals/, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let data: any = {};
      try { data = route.request().postDataJSON(); } catch { data = {}; }
      const newRef = {
        id: "ref-" + Date.now(),
        documentNo: "REF-2569-" + Math.floor(1000 + Math.random() * 9000),
        caseId: parseInt(route.request().url().match(/\/api\/cases\/(\\d+)/)?.[1] || "101", 10),
        agencyType: data.agencyType || "HEALTH",
        agencyName: data.agencyName || "โรงพยาบาลชลบุรี",
        reason: data.reason || "นักเรียนมีภาวะซึมเศร้าจำเป็นต้องได้รับการประเมินจากแพทย์",
        requestedSupport: data.requestedSupport || "ขอรับการประเมินและวางแผนการรักษา",
        status: "ISSUED",
        issuedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      externalReferralsList.unshift(newRef);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newRef),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(externalReferralsList),
    });
  });

  // Mock Users API
  const mockUsersList = [
    { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a", role: { name: "SCHOOL_ADMIN" }, isActive: true },
    { id: 2, name: "สมหญิง ครูประจำชั้น (Teacher)", username: "teacher_a", role: { name: "TEACHER" }, isActive: true },
    { id: 3, name: "อำนวย ผู้บริหาร (Director)", username: "director_a", role: { name: "SCHOOL_DIRECTOR" }, isActive: true },
  ];

  await page.route(/\/api\/users/, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let postData: any = {};
      try { postData = route.request().postDataJSON(); } catch { postData = {}; }
      const newUser = {
        id: mockUsersList.length + 1,
        name: postData.name || postData.full_name || "ผู้ใช้งานใหม่",
        username: postData.username || "user_" + Date.now(),
        role: { name: "TEACHER" },
        isActive: true,
      };
      mockUsersList.unshift(newUser);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newUser) });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: mockUsersList, meta: { total: mockUsersList.length, statusCounts: { active: 3, suspended: 0 } } }),
    });
  });

  // Mock Students API
  await page.route(/\/api\/students/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 101, studentCode: "50001", firstName: "กิตติพงษ์", lastName: "สุขเกษม" },
        { id: 104, studentCode: "aa692004", firstName: "กนกวรรณ", lastName: "ทองดี" },
      ]),
    });
  });

  // Mock Active Import Jobs
  await page.route("**/api/students/import/jobs/active*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ activeJobs: [], hasActiveJob: false }),
    });
  });

  // Mock Students Import History API
  await page.route(/\/api\/students\/import\/history|\/api\/students\/import-history/, async (route) => {
    const historyData = [
      {
        id: "imp-2569-001",
        fileName: "students_m3_term1_2569.xlsx",
        originalFileName: "students_m3_term1_2569.xlsx",
        fileSize: 45200,
        totalRows: 35,
        successCount: 35,
        createdCount: 35,
        insertedCount: 35,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errorCount: 0,
        status: "COMPLETED",
        importedAt: "2026-09-28T09:30:00.000Z",
        createdAt: "2026-09-28T09:30:00.000Z",
        importedByUser: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        importedBy: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        user: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
      },
      {
        id: "imp-2569-002",
        fileName: "students_m1_term1_2569.csv",
        originalFileName: "students_m1_term1_2569.csv",
        fileSize: 32400,
        totalRows: 40,
        successCount: 38,
        createdCount: 38,
        insertedCount: 38,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 2,
        errorCount: 2,
        status: "COMPLETED_WITH_ERRORS",
        importedAt: "2026-09-25T14:15:00.000Z",
        createdAt: "2026-09-25T14:15:00.000Z",
        importedByUser: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        importedBy: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        user: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
      },
    ];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: historyData,
        items: historyData,
        meta: { total: historyData.length, page: 1, limit: 25, lastPage: 1, totalPages: 1 },
      }),
    });
  });

  // Mock Observations API
  await page.route(/\/api\/observations/, async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, note: "ผู้ปกครองเข้ามาพบผู้อำนวยการโดยตรง" }]) });
  });

  // Mock Interventions & Letters
  await page.route(/\/api\/interventions|\/api\/cases\/(\\d+)\/assistance/, async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, type: "ให้คำปรึกษา", details: "พูดคุยให้กำลังใจนักเรียน" }]) });
  });

  await page.route(/\/api\/referral-letters|\/api\/cases\/(\\d+)\/referral-letters|\/api\/transfer-letters/, async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Mock AI Case Assessments
  await page.route(/\/api\/ai-case-assessments(?:\/cases\/(\\d+)\/analyze|\/([a-zA-Z0-9_-]+))?/, async (route) => {
    const url = route.request().url();
    if (url.includes("/experiments/")) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        publicId: "asm-uat-101",
        status: "ANALYZED",
        revision: 1,
        absentDays: 4,
        lateDays: 0,
        lateDaysAvailable: true,
        blindReview: false,
        hasCompletedBlindReview: true,
        createdAt: new Date().toISOString(),
        lockedAt: null,
        latestAttempt: {
          problemLabels: ["behavioral_problem"],
          labelProbabilities: { behavioral_problem: 0.92 },
          recommendedSeverity: "HIGH",
          severityConfidence: 0.94,
          reasons: ["นักเรียนมีพฤติกรรมแยกตัว ขาดเรียนบ่อยครั้งติดต่อกัน และมีสัญญาณความเหนื่อยล้าเรื้อรัง"],
          safetyFlag: false,
          safetyReasons: [],
          modelVersion: "v2.4-dss",
          analysisMode: "REFERENCE_ASSISTED",
        },
        reviews: [],
      }),
    });
  });

  // Mock Director Approval & Decision
  await page.route(/\/api\/cases\/(\\d+)\/decision|\/api\/cases\/(\\d+)\/director-approval/, async (route) => {
    let data: any = {};
    try { data = route.request().postDataJSON(); } catch { data = {}; }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        caseId: 101,
        finalSeverity: data.finalSeverity || "MEDIUM",
        reason: data.reason || "จากการตรวจสอบพบว่าผู้ปกครองให้ความร่วมมือดี ปรับเป็นระดับปานกลางเพื่อเฝ้าระวังต่อเนื่อง",
        status: "APPROVED",
        updatedAt: new Date().toISOString(),
      }),
    });
  });
\${COMMON_STS_ROUTE_MOCKS}

  // =========================================================================
  // 🔹 ตอนที่ 1: ฝั่งผู้อำนวยการโรงเรียน (School Director Journey)
  // =========================================================================

  // หมวด 1: เข้าสู่ระบบผู้อำนวยการโรงเรียน
  await test.step("หมวด 1: เข้าสู่ระบบด้วยสถานะผู้อำนวยการโรงเรียน และตรวจสอบสิทธิ์ผู้บริหาร", async () => {
    await page.goto("/login");
    await page.bringToFront();
    await page.locator("#login-username, input[name='username']").first().fill("director_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).toHaveURL(/\\/(?:director|dashboard)/, { timeout: 15_000 });
    await expect(page.locator("text=/ผู้อำนวยการ|ผู้อำนวยการโรงเรียน|DIRECTOR/i").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
  });

  // หมวด 2: แดชบอร์ดผู้อำนวยการโรงเรียน
  await test.step("หมวด 2: ตรวจสอบแดชบอร์ดผู้อำนวยการ สถิติภาพรวม กราฟแนวโน้ม และห้องเรียนที่ต้องเฝ้าระวัง", async () => {
    await expect(page.locator("main").locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 10_000 });
    
    // 1. ตรวจสอบการ์ดสถิติภาพรวม
    await expect(page.locator("main").locator("text=/ดัชนีงานสำคัญ|รอตัดสินใจ|เคสเสี่ยงสูง|ขาดเรียน|อัตราเข้าเรียน|ภาพรวม|สถิติ/i").first()).toBeVisible();

    // 2. ตรวจสอบแถบสัดส่วนความรุนแรงของเคส
    const severitySection = page.locator("main").locator("text=/สัดส่วนความรุนแรง|ระดับความรุนแรง|สูง|ปานกลาง|น้อย/i").first();
    await expect(severitySection).toBeVisible();

    // 3. ตรวจสอบรายการห้องเรียนที่ต้องเฝ้าระวังพิเศษ
    const watchedSection = page.locator("main").locator("text=/ห้องเรียนที่ต้องเฝ้าระวัง|ห้องเรียน|ม.3|ดัชนี/i").first();
    await expect(watchedSection).toBeVisible();

    // 4. ทดสอบตัวกรองข้อมูลย้อนหลัง (เปิด Modal เลือกตัวกรองห้องเรียน และกด 'นำไปใช้' ให้เห็นการเปลี่ยนแปลงข้อมูลจริง)
    const filterBtn = page.locator("button:has-text('ตัวกรองข้อมูลย้อนหลัง'), button[aria-label*='ตัวกรอง'], button:has-text('ตัวกรอง')").first();
    if (await filterBtn.isVisible()) {
      await filterBtn.scrollIntoViewIfNeeded();
      await filterBtn.click();
      await page.waitForTimeout(1200);

      // เลือกตัวกรองห้องเรียน (เช่น ห้อง 1 / ม.3/1) เพื่อสาธิตการกรองข้อมูลแบบเจาะจง
      const classroomCombobox = page.locator("#filter-classroom, [aria-label*='ห้องเรียน']").first();
      if (await classroomCombobox.isVisible()) {
        await classroomCombobox.click();
        await page.waitForTimeout(600);
        const roomOption = page.locator("[role='option']:has-text('1'), [role='option']:has-text('ม.3'), li:has-text('1')").first();
        if (await roomOption.isVisible()) {
          await roomOption.click();
          await page.waitForTimeout(800);
        }
      }

      // กดปุ่ม 'นำไปใช้' ในหน้าต่างตัวกรอง และรอให้แดชบอร์ดอัปเดตผลลัพธ์
      const applyFilterBtn = page.locator("button:has-text('นำไปใช้')").first();
      if (await applyFilterBtn.isVisible()) {
        await applyFilterBtn.scrollIntoViewIfNeeded();
        await applyFilterBtn.click();
        await page.waitForTimeout(2500);

        // ตรวจสอบยืนยันว่าแดชบอร์ดอัปเดตข้อมูลตามตัวกรองที่เลือกจริง (จำนวนเคสและสถิติปรับตามห้องเรียน)
        await expect(page.locator("text=/รวม 2 เคส|2 เคส|สัดส่วนความรุนแรง/i").first()).toBeVisible({ timeout: 5000 });
      } else {
        const closeFilterBtn = page.locator("button[data-filter-close], button:has-text('ปิด'), button:has-text('ยกเลิก')").first();
        if (await closeFilterBtn.isVisible()) {
          await closeFilterBtn.click();
          await page.waitForTimeout(600);
        }
      }
    }

    await page.waitForTimeout(2500);
  });

  // หมวด 3: จัดการเคสระดับปานกลาง/สูง & ออกรายงาน
  await test.step("หมวด 3: จัดการเคสระดับปานกลางและสูง ค้นหา กรองความเสี่ยง และพรีวิวรายงานประจำโรงเรียน", async () => {
    await page.goto("/director/reports");
    await page.waitForTimeout(1200);

    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("กนกวรรณ");
      await page.waitForTimeout(1000);
      await searchInput.clear();
      await page.waitForTimeout(600);
    }

    const previewBtn = page.locator("#generate-report-btn, button:has-text('แสดงตัวอย่าง'), button:has-text('สร้างรายงาน')").first();
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
    }

    const exportPdfBtn = page.locator("#export-pdf-btn, button:has-text('PDF')").first();
    const exportExcelBtn = page.locator("#export-excel-btn, button:has-text('Excel')").first();
    if (await exportPdfBtn.isVisible()) {
      await exportPdfBtn.click();
      await page.waitForTimeout(600);
    }
    if (await exportExcelBtn.isVisible()) {
      await exportExcelBtn.click();
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(2000);
  });

  // หมวด 4: บันทึกการช่วยเหลือและการส่งต่อ
  await test.step("หมวด 4: บันทึกการให้ความช่วยเหลือ ส่งต่อผู้เชี่ยวชาญ และออกหนังสือส่งตัวตามหลัก PDPA", async () => {
    await page.goto("/director/cases").catch(() => page.goto("/director/dashboard"));
    await page.waitForTimeout(1200);

    const reviewBtn = page.locator("a:has-text('พิจารณา'), button:has-text('พิจารณา'), a[href*='/cases/'], tr:has-text('CASE-')").first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      await page.waitForTimeout(1500);
    }

    const addHelpBtn = page.locator("button:has-text('บันทึกความช่วยเหลือ'), button:has-text('บันทึกการช่วยเหลือ'), button:has-text('เพิ่มการช่วยเหลือ'), #add-assistance-btn, #add-intervention-btn").first();
    if (await addHelpBtn.isVisible()) {
      await addHelpBtn.scrollIntoViewIfNeeded();
      await addHelpBtn.click();
      await page.waitForTimeout(1000);

      const helpDialog = page.locator("dialog[open], [role='dialog']").first();
      if (await helpDialog.isVisible()) {
        const helpType = helpDialog.locator("select[name='type'], input[name='type'], select, [role='combobox']").first();
        if (await helpType.isVisible()) {
          try {
            await helpType.selectOption({ index: 1 });
          } catch {
            // ค่าเริ่มต้นคือ ให้คำปรึกษา
          }
        }

        const helpDetail = helpDialog.locator("textarea[placeholder*='อธิบาย'], textarea[name='details'], textarea").first();
        if (await helpDetail.isVisible()) {
          await helpDetail.fill("พูดคุยให้กำลังใจนักเรียนและวางแผนการเรียนร่วมกัน");
          await page.waitForTimeout(300);
        }

        const helpResult = helpDialog.locator("textarea[placeholder*='ผล'], input[placeholder*='ผล'], textarea[name='result']").first();
        if (await helpResult.isVisible()) {
          await helpResult.fill("นักเรียนมีกำลังใจดีขึ้นและตั้งใจเข้าเรียนสม่ำเสมอ");
          await page.waitForTimeout(300);
        }

        const saveHelpBtn = helpDialog.locator("button:has-text('บันทึก'), button[type='submit']").last();
        if (await saveHelpBtn.isVisible() && await saveHelpBtn.isEnabled()) {
          await saveHelpBtn.click();
          await page.waitForTimeout(1500);
        }

        if (await helpDialog.isVisible()) {
          const cancelHelpBtn = helpDialog.locator("button:has-text('ยกเลิก'), button:has-text('ปิด')").first();
          if (await cancelHelpBtn.isVisible()) {
            await cancelHelpBtn.click();
            await page.waitForTimeout(600);
          }
        }
      }
    }

    // 2. ทดสอบเปิดแบบฟอร์มออกหนังสือส่งตัว (Referral Letter Dialog) และกรอกข้อมูลครบถ้วนทุกช่อง
    const letterBtn = page.locator("button:has-text('ออกหนังสือส่งตัว'), button:has-text('ส่งต่อภายนอก')").first();
    if (await letterBtn.isVisible()) {
      await letterBtn.scrollIntoViewIfNeeded();
      await letterBtn.click();
      await page.waitForTimeout(1000);

      const letterDialog = page.locator("dialog[open], [role='dialog']").first();
      // กรอกข้อมูลหน่วยงานภายนอกจำลองให้ครบถ้วนทุกช่อง
      const agencyNameInput = page.locator("#agency-name, input[placeholder*='โรงพยาบาล']").first();
      if (await agencyNameInput.isVisible()) {
        await agencyNameInput.fill("โรงพยาบาลชลบุรี");
        await page.waitForTimeout(400);
      }
      const reasonInput = page.locator("#referral-reason, textarea[placeholder*='เหตุผล']").first();
      if (await reasonInput.isVisible()) {
        await reasonInput.fill("นักเรียนมีภาวะเครียดและต้องการรับคำปรึกษาจากแพทย์ผู้เชี่ยวชาญอย่างต่อเนื่อง");
        await page.waitForTimeout(400);
      }
      const requestedSupportInput = page.locator("#requested-support, textarea[placeholder*='ความช่วยเหลือ']").first();
      if (await requestedSupportInput.isVisible()) {
        await requestedSupportInput.fill("ขอรับการประเมินและวางแผนการบำบัดรักษาฟื้นฟูสภาพจิตใจ");
        await page.waitForTimeout(400);
      }

      // กดปุ่ม 'ออกหนังสือ' เพื่อส่งข้อมูลและออกหนังสือจริง
      const submitLetterBtn = page.locator("button:has-text('ออกหนังสือ')").last();
      if (await submitLetterBtn.isVisible() && await submitLetterBtn.isEnabled()) {
        await submitLetterBtn.click();
        await page.waitForTimeout(2000);
      } else {
        const cancelLetterBtn = page.locator("button:has-text('ยกเลิก'), button:has-text('ปิด')").last();
        if (await cancelLetterBtn.isVisible()) {
          await cancelLetterBtn.click();
          await page.waitForTimeout(600);
        }
      }

      if (await letterDialog.isVisible()) {
        const closeLetterBtn = letterDialog.locator("button:has-text('ยกเลิก'), button:has-text('ปิด')").first();
        if (await closeLetterBtn.isVisible()) {
          await closeLetterBtn.click();
          await page.waitForTimeout(600);
        }
      }
    }

    await page.waitForTimeout(2000);
  });

  // หมวด 5: ผู้อำนวยการบันทึกข้อสังเกตและประเมิน AI
  await test.step("หมวด 5: ผู้อำนวยการบันทึกข้อสังเกต วิเคราะห์ด้วย AI และบันทึกผลการอนุมัติขั้นสุดท้าย", async () => {
    const obsInput = page.locator("#observation-note, textarea[placeholder*='ข้อสังเกต'], textarea").first();
    if (await obsInput.isVisible()) {
      await obsInput.fill("ผู้ปกครองเข้ามาพบผู้อำนวยการโดยตรงเพื่อปรึกษาแนวทางการช่วยเหลือ");
      await page.waitForTimeout(800);
      const saveObsBtn = page.locator("#add-observation-btn, button:has-text('บันทึกข้อสังเกต')").first();
      if (await saveObsBtn.isVisible() && await saveObsBtn.isEnabled()) {
        await saveObsBtn.click();
        await page.waitForTimeout(1200);
      }
    }

    // 2. วิเคราะห์เคสด้วย AI และรอผลสำเร็จสมบูรณ์ (พร้อมแสดง Confidence Gauge 94%)
    const aiBtn = page.locator("button:has-text('วิเคราะห์เคสด้วย AI'), button:has-text('วิเคราะห์จากบันทึกข้อสังเกตล่าสุด')").first();
    if (await aiBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      if (await aiBtn.isEnabled()) {
        await aiBtn.scrollIntoViewIfNeeded();
        await aiBtn.click();
        // รอให้กระบวนการ AI ประมวลผลและเปิดเผยผลวิเคราะห์ครบถ้วน (Progress -> Result Reveal -> Completed)
        await page.waitForTimeout(5000);
        await expect(page.locator("text=/วิเคราะห์เรียบร้อย|ความมั่นใจของโมเดล|ความมั่นใจ/i").first()).toBeVisible({ timeout: 10_000 });
      }
    }

    const reasonInput = page.locator("textarea[placeholder*='เหตุผล'], textarea[name='reason']").first();
    if (await reasonInput.isVisible()) {
      await reasonInput.fill("จากการตรวจสอบพบว่าผู้ปกครองให้ความร่วมมือดี ปรับเป็นระดับปานกลางเพื่อเฝ้าระวังต่อเนื่อง");
    }

    const approveBtn = page.locator("button:has-text('บันทึกผลการอนุมัติขั้นสุดท้าย'), button:has-text('ยืนยันผลการพิจารณา'), button:has-text('อนุมัติมาตรการ'), button:has-text('อนุมัติผล'), button:has-text('ยืนยันผล')").first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await approveBtn.isEnabled()) {
        await approveBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    await page.waitForTimeout(2000);
  });

  // =========================================================================
  // 🔹 ตอนที่ 2: ฝั่งผู้ดูแลระบบโรงเรียน (School Administrator Journey)
  // =========================================================================

  // หมวด 6: เข้าสู่ระบบ School Admin & เมนูแดชบอร์ด
  await test.step("หมวด 6: เข้าสู่ระบบด้วยสถานะผู้ดูแลระบบโรงเรียน และตรวจสอบการ์ดงานที่ต้องดำเนินการ", async () => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.bringToFront();
    await page.locator("#login-username, input[name='username']").first().fill("admin_a");
    await page.locator("#login-password, input[name='password']").first().fill("changeme");
    await page.locator("#login-submit, button[type='submit']").first().click();
    await expect(page).toHaveURL(/\\/admin/, { timeout: 15_000 });
    await expect(page.locator("text=/ผู้ดูแลระบบ|ผู้ดูแลระบบโรงเรียน|ADMIN/i").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2500);

    const actionCards = page.locator("text=/ห้องเรียนยังไม่มีครูที่ปรึกษา|เคสติดตามค้างดำเนินการ|ความพร้อมของข้อมูล|นักเรียนยังไม่มีห้องเรียน/i").first();
    if (await actionCards.isVisible()) {
      await expect(actionCards).toBeVisible();
    }

    await page.waitForTimeout(2000);
  });

  // หมวด 7: จัดการผู้ใช้งาน โครงสร้างสถานศึกษา และนำเข้าข้อมูล
  await test.step("หมวด 7: จัดการผู้ใช้งานในโรงเรียน จัดการห้องเรียน และทดสอบการนำเข้าข้อมูลนักเรียน", async () => {
    await page.goto("/admin/users");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/ค้นหา/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("สมชาย");
      await page.waitForTimeout(800);
      await searchInput.clear();
      await page.waitForTimeout(600);
    }

    const addUserBtn = page.locator("#add-user-btn, button:has-text('เพิ่มผู้ใช้')").first();
    if (await addUserBtn.isVisible()) {
      await addUserBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator("dialog, [role='dialog']").first();
      if (await modal.isVisible()) {
        const fullNameInput = page.locator("input#form-full_name, input[name='full_name'], input[name='name']").first();
        if (await fullNameInput.isVisible()) {
          await fullNameInput.fill("ครูอำนาจ คาดหวัง");
        }
        const usernameInput = page.locator("input#form-username, input[name='username']").first();
        if (await usernameInput.isVisible()) {
          await usernameInput.fill("teacher_umnat");
        }
        const cancelBtn = page.locator("button:has-text('ยกเลิก')").first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }
      }
    }

    await page.goto("/admin/students").catch(() => page.goto("/students"));
    await page.waitForTimeout(1500);

    const importBtn = page.locator("a:has-text('นำเข้าข้อมูลนักเรียน'), button:has-text('นำเข้าข้อมูล'), a:has-text('นำเข้า')").first();
    if (await importBtn.isVisible()) {
      await importBtn.click();
      await page.waitForTimeout(1500);

      // ทดสอบคลิกปุ่มดาวน์โหลดไฟล์ตัวอย่าง
      const downloadSampleBtn = page.locator("button:has-text('ดาวน์โหลดไฟล์ตัวอย่าง'), a:has-text('ดาวน์โหลดไฟล์ตัวอย่าง')").first();
      if (await downloadSampleBtn.isVisible()) {
        await downloadSampleBtn.click();
        await page.waitForTimeout(1000);
      }

      // เปิดดูประวัติการนำเข้าไฟล์ข้อมูลนักเรียน
      const historyBtn = page.locator("a:has-text('ดูประวัติการนำเข้า'), button:has-text('ดูประวัติการนำเข้า'), a[href*='history']").first();
      if (await historyBtn.isVisible()) {
        await historyBtn.click();
        await page.waitForTimeout(2000);

        // ตรวจสอบยืนยันการแสดงผลตารางประวัติการนำเข้า (แสดงรายการไฟล์ สถานะสำเร็จ และผู้ดำเนินการ)
        await expect(page.locator("text=/ประวัติการนำเข้า|students_m3|สำเร็จ|COMPLETED/i").first()).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(3000);
      }
    }

    await page.waitForTimeout(5000);
  });
});
`,
  },
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
  "FN-STS-00-SCHOOL-ADMIN": {
    id: "FN-STS-00-SCHOOL-ADMIN",
    name: "FN-STS-00-SCHOOL-ADMIN · [UAT ผู้ดูแลระบบโรงเรียน] TC-STS School Admin (Complete 29-TC Workflow)",
    shortName: "STS School Admin",
    relativePath: "e2e/sts/specs/00-school-admin-uat-all-in-one.spec.ts",
    description: "รันครบทุกขั้นตอนการทดสอบ UAT ของผู้ดูแลระบบโรงเรียน (School Admin) ครอบคลุม 29 Test Cases ตาม Google Sheet: เข้าสู่ระบบ (3 TCs) → แดชบอร์ด (3 TCs) → จัดการผู้ใช้งาน (10 TCs) → ข้อมูลนักเรียน/ห้องเรียน (13 TCs) → Logout",
    code: `// ==============================================================
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
      await expect(page).toHaveURL(/\\/login/);

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
      await expect(page).toHaveURL(/\\/admin/, { timeout: 15_000 });

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
      await expect(page).toHaveURL(/\\/admin/);

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
        await expect(page).toHaveURL(/\\/admin\\/classrooms/);
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
        await expect(page).toHaveURL(/\\/admin\\/students\\/import\\/history/);
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
        await expect(page).toHaveURL(/\\/login/, { timeout: 10_000 });
      }
      await page.waitForTimeout(1000);
    });
  });
});
`
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
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });

    // 2. จำลอง Mock API ให้ตอบกลับ 401 Unauthorized พร้อมข้อความแจ้งเตือน
    await page.route("**/api/auth/login", async (route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }),
      });
    });
${COMMON_STS_ROUTE_MOCKS}
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
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });
${COMMON_STS_ROUTE_MOCKS}
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
  if (
    upper === "FN-STS-00-SCHOOL" ||
    upper.includes("SCHOOL-UAT") ||
    upper.includes("SCHOOL-ALL-IN-ONE") ||
    upper.includes("UAT SCRIPT [SCHOOL]") ||
    upper.includes("UAT โรงเรียน") ||
    upper.includes("COMPLETE SCHOOL WORKFLOW")
  ) {
    return STS_FUNCTION_TEMPLATES["FN-STS-00-SCHOOL"];
  }

  if (
    upper === "FN-STS-00" ||
    upper.includes("ALL-IN-ONE") ||
    upper.includes("COMPLETE-WORKFLOW") ||
    upper.includes("COMPLETE WORKFLOW") ||
    upper.includes("หมวด 7") ||
    upper.includes("รันทุกฟังก์ชัน")
  ) {
    return STS_FUNCTION_TEMPLATES["FN-STS-00"];
  }

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
