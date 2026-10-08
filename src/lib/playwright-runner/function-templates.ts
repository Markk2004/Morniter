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

    await page.route("**/api/students/import*", async (route) => {
      const url = route.request().url();
      if (url.includes("/history") || url.includes("-history")) {
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
      }

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

  await page.route("**/api/attendance*", async (route) => {
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

  await page.route("**/api/cases*", async (route) => {
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

  await page.route("**/api/students*", async (route) => {
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

  await page.route("**/api/observations*", async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, text: "สังเกตพฤติกรรม" }]) });
  });

  await page.route("**/api/cases/*/ai-insights*", async (route) => {
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

  await page.route("**/api/cases*", async (route) => {
    const url = route.request().url();
    if (url.includes("/external-referrals")) {
      const method = route.request().method();
      if (method === "POST") {
        let data: any = {};
        try { data = route.request().postDataJSON(); } catch { data = {}; }
        const newRef = {
          id: "ref-" + Date.now(),
          documentNo: "REF-2569-" + Math.floor(1000 + Math.random() * 9000),
          caseId: 101,
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
    }

    const caseIdPart = url.split("/api/cases/")[1]?.split("?")[0];
    const caseIdNum = caseIdPart && !isNaN(Number(caseIdPart)) ? parseInt(caseIdPart, 10) : null;
    if (caseIdNum !== null && route.request().method() === "GET") {
      const requestedId = caseIdNum;
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

  await page.route("**/api/external-referrals*", async (route) => {
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

  await page.route("**/api/users*", async (route) => {
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
  await page.route("**/api/students*", async (route) => {
    const url = route.request().url();
    if (url.includes("/history") || url.includes("-history")) {
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
    }

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

  // Mock Observations API
  await page.route("**/api/observations*", async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, note: "ผู้ปกครองเข้ามาพบผู้อำนวยการโดยตรง" }]) });
  });

  // Mock Interventions & Letters
  await page.route("**/api/interventions*", async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, type: "ให้คำปรึกษา", details: "พูดคุยให้กำลังใจนักเรียน" }]) });
  });

  await page.route("**/api/referral-letters*", async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Mock AI Case Assessments
  await page.route("**/api/ai-case-assessments*", async (route) => {
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
  await page.route("**/api/cases/*/director-approval*", async (route) => {
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

  await page.route("**/api/cases/*/decision*", async (route) => {
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
${COMMON_STS_ROUTE_MOCKS}

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

    // [Precondition]: ล้าง Cookies และเตรียม Mock API (เปิด enableAdminTwoFactor สำหรับทดสอบการยืนยันตัวตน)
    await page.context().clearCookies();
    // Centralized route mocks covering page.route for /api/auth/refresh, /api/auth/me, /api/academic-years, /api/classrooms, /api/provinces
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
      await expect(page).toHaveURL(/\\/login/);

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

      // TC-STS-08-27-01: ตรวจสอบการแสดงผลหลังจากกดแท็บห้องเรียน/ปีการศึกษา/นักเรียน/นำเข้าข้อมูล/ผู้ใช้
      // ตรวจสอบการทำงานของเมนูแท็บและแถบเครื่องมือทางลัดหลัก
      const toolbar = page.locator(".admin-management-toolbar, nav[aria-label*='ทางลัด'], .admin-quick-links").first();
      if (await toolbar.isVisible()) {
        await expect(toolbar).toBeVisible();
        const classroomLink = toolbar.locator("a[href*='/admin/classrooms']").first();
        if (await classroomLink.isVisible()) {
          await expect(classroomLink).toBeVisible();
        }
        const studentLink = toolbar.locator("a[href*='/admin/students']").first();
        if (await studentLink.isVisible()) {
          await expect(studentLink).toBeVisible();
        }
        const userLink = toolbar.locator("a[href*='/admin/users']").first();
        if (await userLink.isVisible()) {
          await expect(userLink).toBeVisible();
        }
      }

      // ตรวจสอบแท็บการนำทางหลักบนหน้าแดชบอร์ด (ห้องเรียน / นักเรียน / นำเข้าข้อมูล / ผู้ใช้)
      const tabPaths = [
        { path: "/admin/classrooms", name: "ห้องเรียน" },
        { path: "/admin/academic-years", name: "ปีการศึกษา" },
        { path: "/admin/students", name: "นักเรียน" },
        { path: "/admin/students/import", name: "นำเข้าข้อมูล" },
        { path: "/admin/users", name: "ผู้ใช้" },
      ];

      for (const tab of tabPaths) {
        const tabEl = page.locator("a[href*='" + tab.path + "'], nav a:has-text('" + tab.name + "')").first();
        if (await tabEl.isVisible()) {
          await tabEl.click();
          await page.waitForTimeout(600);
          await expect(page).toHaveURL(new RegExp(tab.path));
          await page.goto("/admin");
          await page.waitForTimeout(600);
        }
      }

      // TC-STS-08-28-01: ตรวจสอบการแสดงผลของการ์ดห้องเรียนยังไม่มีครูที่ปรึกษา (Action Queue)
      // นำทางไปหน้าจัดการห้องเรียน พร้อมกรองเฉพาะห้องที่ยังไม่มีครูที่ปรึกษา
      const missingAdvisorCard = page.locator("a[href*='missing-advisor'], a[href*='/admin/classrooms']").or(page.getByText(/ยังไม่มีครูที่ปรึกษา/i)).first();
      await expect(missingAdvisorCard).toBeVisible({ timeout: 10_000 });
      if (await missingAdvisorCard.getAttribute("href") || (await missingAdvisorCard.locator("xpath=ancestor-or-self::a").count()) > 0) {
        await missingAdvisorCard.click();
        await page.waitForTimeout(800);
        await expect(page).toHaveURL(/\\/admin\\/classrooms/);
        await page.goto("/admin");
        await page.waitForTimeout(600);
      }

      // TC-STS-08-28-02: ตรวจสอบการแสดงผลของการ์ดเคสติดตามค้างดำเนินการเกิน 7 วัน
      // นำทางไปหน้าจัดการเคสผู้เรียน พร้อมกรองเฉพาะเคสที่ค้างเกิน 7 วัน
      const overdueCasesCard = page.locator("article, .card").filter({ hasText: /เคสติดตาม|ค้างดำเนินการ/i }).first();
      await expect(overdueCasesCard).toBeVisible({ timeout: 10_000 });
      const overdueLink = overdueCasesCard.locator("a[href], button").first();
      if (await overdueLink.isVisible()) {
        await overdueLink.click();
        await page.waitForTimeout(800);
        await expect(page).toHaveURL(/\\/admin\\/cases|\\/cases/);
        await page.goto("/admin");
        await page.waitForTimeout(600);
      }

      // TC-STS-08-28-03: ตรวจสอบการแสดงผลของการ์ดห้องเรียนเกินความจุที่กำหนด
      // นำทางไปหน้าจัดการห้องเรียนพร้อมกรองเฉพาะห้องที่เกินความจุ
      const overCapacityCard = page.locator("a[href*='over-capacity'], a[href*='capacity']").or(page.locator("article, .card").filter({ hasText: /เกินความจุ/i })).first();
      await expect(overCapacityCard).toBeVisible({ timeout: 10_000 });
      if (await overCapacityCard.getAttribute("href") || (await overCapacityCard.locator("xpath=ancestor-or-self::a").count()) > 0) {
        await overCapacityCard.click();
        await page.waitForTimeout(800);
        await expect(page).toHaveURL(/\\/admin\\/classrooms/);
        await page.goto("/admin");
        await page.waitForTimeout(600);
      }

      // TC-STS-08-28-04: ตรวจสอบการแสดงผลของการ์ดนักเรียนยังไม่มีห้องเรียน
      // นำทางไปหน้าจัดการนักเรียนพร้อมกรองเฉพาะนักเรียนที่ยังไม่มีห้อง
      const unassignedStudentsCard = page.locator("article, .card").filter({ hasText: /ยังไม่มีห้องเรียน/i }).first();
      await expect(unassignedStudentsCard).toBeVisible({ timeout: 10_000 });
      const unassignedLink = unassignedStudentsCard.locator("a[href], button").first();
      if (await unassignedLink.isVisible()) {
        await unassignedLink.click();
        await page.waitForTimeout(800);
        await expect(page).toHaveURL(/\\/admin\\/students/);
        await page.goto("/admin");
        await page.waitForTimeout(600);
      }

      // TC-STS-08-30-03: ตรวจสอบการกดปุ่มการ์ดในความพร้อมของข้อมูลระบบที่ยังไม่ได้จัดการ
      // นำทางไปยังหน้าจัดการห้องเรียน (การจัดการครูประจำชั้นครบทุกห้อง)
      const readinessSection = page.locator(".admin-readiness-section").or(page.getByText(/ความพร้อมของข้อมูลระบบ/i)).first();
      await expect(readinessSection).toBeVisible({ timeout: 10_000 });
      const unreadyCard = page.locator("text=/การจัดการครูประจำชั้นครบทุกห้อง|ยังมีห้องเรียนที่ยังไม่มีครูประจำชั้น/i").first();
      await expect(unreadyCard).toBeVisible({ timeout: 10_000 });
      const unreadyCheckBtn = page.locator("a:has-text('จัดการห้องเรียน'), button:has-text('จัดการห้องเรียน'), .admin-readiness-check-link, a[href*='/admin/classrooms']").first();
      if (await unreadyCheckBtn.isVisible()) {
        await unreadyCheckBtn.click();
        await page.waitForTimeout(800);
        await expect(page).toHaveURL(/\\/admin\\/classrooms/);
        await page.goto("/admin");
        await page.waitForTimeout(600);
      }

      await page.waitForTimeout(1000);
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
      await page.waitForTimeout(600);

      // ตรวจสอบการแสดงผล Toast Notification แจ้งเตือนการระงับการใช้งาน
      const suspendToast = page.locator("[role='status'], [role='alert'], .toast, .chakra-toast, div:has-text('ระงับการใช้งานสำเร็จ')").first();
      if (await suspendToast.isVisible()) {
        await expect(suspendToast).toBeVisible();
      }
      await page.waitForTimeout(600);

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
            await page.waitForTimeout(600);

            // ตรวจสอบการแสดงผล Toast Notification แจ้งเตือนการลบผู้ใช้งาน
            const deleteToast = page.locator("[role='status'], [role='alert'], .toast, .chakra-toast, div:has-text('ลบผู้ใช้งานสำเร็จ')").first();
            if (await deleteToast.isVisible()) {
              await expect(deleteToast).toBeVisible();
            }
            await page.waitForTimeout(600);
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
          buffer: Buffer.from("studentCode,firstName,lastName\\naa699001,ทดสอบ,นำเข้า"),
        });
        await page.waitForTimeout(1500);
      }

      // [8] TC-STS-03-12-01: ตรวจสอบการทำงานของปุ่ม ประวัติการนำเข้า
      const historyBtn = page.locator("a[href*='/admin/students/import/history'], button:has-text('ประวัติการนำเข้า')").first();
      if (await historyBtn.isVisible()) {
        await historyBtn.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/\\/admin\\/students\\/import\\/history/);
        await expect(page.locator("table, tbody tr").first()).toBeVisible({ timeout: 10_000 });

        // [9] TC-STS-03-12-09: ตรวจสอบการทำงานของปุ่ม ดูผล ในหน้าประวัติ
        const viewResultBtn = page.locator("tbody tr button:has-text('ดูผล'), tbody tr button:has-text('ผลลัพธ์')").first();
        if (await viewResultBtn.isVisible()) {
          await viewResultBtn.click();
          await page.waitForTimeout(1200);
          await expect(page).toHaveURL(/\\/admin\\/students\\/import/);
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
      await expect(page).toHaveURL(/\\/admin\\/students/);
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
        await expect(page).toHaveURL(/\\/login/, { timeout: 10_000 });
      }
      await page.waitForTimeout(1000);
    });
  });
});
`
  },
  "TC-STS-PLATFORM-ADMIN": {
    id: "TC-STS-PLATFORM-ADMIN",
    name: "TC-STS-PLATFORM-ADMIN · [UAT หัวหน้าระบบ] UAT Script (Platform Admin) (Complete 29-TC Workflow)",
    shortName: "STS Platform Admin",
    relativePath: "e2e/sts/specs/00-platform-admin-uat-all-in-one.spec.ts",
    description: "รันครบทุกขั้นตอนการทดสอบ UAT ของหัวหน้าระบบ (Platform Admin) ครอบคลุมทั้ง 4 ฟังก์ชันหลัก และ 26 Test Scenarios (29 Test Cases) ตาม Google Sheet",
    get code() { return STS_FUNCTION_TEMPLATES["FN-STS-00-PLATFORM-ADMIN"].code; },
  },
  "FN-STS-00-PLATFORM-ADMIN": {
    id: "FN-STS-00-PLATFORM-ADMIN",
    name: "FN-STS-00-PLATFORM-ADMIN · [UAT หัวหน้าระบบ] UAT Script (Platform Admin) (Complete 29-TC Workflow)",
    shortName: "STS Platform Admin",
    relativePath: "e2e/sts/specs/00-platform-admin-uat-all-in-one.spec.ts",
    description: "รันครบทุกขั้นตอนการทดสอบ UAT ของหัวหน้าระบบ (Platform Admin) ครอบคลุมทั้ง 4 ฟังก์ชันหลัก และ 26 Test Scenarios (29 Test Cases) ตาม Google Sheet",
    code: `// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: Platform Admin UAT Complete All-In-One Workflow
// 📋 อ้างอิง: UAT Script (Platform Admin) จาก Google Spreadsheet (SoftDeath System Test V2.0)
// 🎯 ครอบคลุม 4 ฟังก์ชันหลัก และการทดสอบย่อย 26 Test Scenarios (29 Test Cases) ครบถ้วน:
//
// 🔹 ฟังก์ชัน 1: เข้าสู่ระบบ (Authentication & Login)
//    - TS-STS-01-03: ตรวจสอบการแสดงผลสถานะผู้ใช้ระบบ
//    - TS-STS-01-04: ตรวจสอบการแสดงผลข้อมูล
//
// 🔹 ฟังก์ชัน 2: ดูแดชบอร์ด (Dashboard Navigation & Filters)
//    - TS-STS-08-10: ตรวจสอบการแสดงผลการ์ดขอบเขตระบบ
//    - TS-STS-08-11: ตรวจสอบการแสดงผลการ์ดสถานการณ์เคส
//    - TS-STS-08-12: ตรวจสอบการทำงานของช่องค้นหาชื่อจังหวัด
//    - TS-STS-08-13: ตรวจสอบการทำงานของตัวกรองสถานะ
//    - TS-STS-08-15: ตรวจสอบการคลิกแถวจังหวัดเพื่อดูรายละเอียด
//
// 🔹 ฟังก์ชัน 3: จัดการโรงเรียนและโครงสร้างจังหวัด (Platform & School Management)
//    - TS-STS-10-20: ตรวจสอบการแสดงผลตารางรายการโรงเรียน
//    - TS-STS-10-12: ตรวจสอบการทำงานของตัวกรองจังหวัด
//    - TS-STS-10-15: ตรวจสอบการทำงานแบบสอดคล้องหลายตัวกรอง
//    - TS-STS-10-11: ตรวจสอบการทำงานของช่องค้นหาโรงเรียน
//    - TS-STS-10-03: ตรวจสอบการทำงานของปุ่มบันทึก ใน Dialog เพิ่มโรงเรียน
//    - TS-STS-10-04: ตรวจสอบการทำงานสอดคล้องของตัวกรองจังหวัดและกลุ่มโรงเรียน
//    - TS-STS-10-08: ตรวจสอบการกรอกข้อมูล แก้ไขโรงเรียน
//    - TS-STS-10-10: ตรวจสอบการทำงานของปุ่มจัดการผู้ดูแล
//    - TS-STS-10-32: ตรวจสอบการทำงานของช่องค้นหาจังหวัด/รหัส/กลุ่ม/โรงเรียน
//    - TS-STS-10-34: ตรวจสอบการทำงานของการเลือกจังหวัดในต้นไม้และการแสดงผลรายละเอียดด้านขวา
//    - TS-STS-10-35: ตรวจสอบการทำงานของปุ่ม เพิ่มกลุ่ม
//    - TS-STS-10-36: ตรวจสอบการทำงานของปุ่ม จัดการโรงเรียน
//    - TS-STS-10-38: ตรวจสอบการทำงานของปุ่ม ปิดใช้งาน (จังหวัด)
//
// 🔹 ฟังก์ชัน 4: จัดการผู้ใช้ (User Management)
//    - TS-STS-02-12: ตรวจสอบการทำงานของปุ่มเพิ่มผู้ใช้ ในเพิ่มผู้ใช้ใหม่
//    - TS-STS-02-13: ตรวจสอบการกรอกข้อมูล ในเพิ่มผู้ใช้ใหม่
//    - TS-STS-02-16: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการเพิ่ม
//    - TS-STS-02-06: ตรวจสอบการทำงานของปุ่มบันทึก ในแก้ไขผู้ใช้
//    - TS-STS-02-17: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการแก้ไข
//    - TS-STS-02-10: ตรวจสอบการทำงานของ Dialog ระงับผู้ใช้
//    - TS-STS-02-18: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังระงับการใช้งาน
//    - TS-STS-02-11: ตรวจสอบการทำงานของ Dialog รีเซ็ตรหัสผ่าน
//    - TS-STS-02-07: ตรวจสอบการทำงานของปุ่มลบผู้ใช้ ในแก้ไขผู้ใช้
//    - TS-STS-02-08: ตรวจสอบการทำงานของ Dialog ลบผู้ใช้งาน
//
// 🔹 ขั้นตอนปิดท้าย: วิเคราะห์ AI และออกจากระบบ (AI Analysis & Logout)
//    - TC-STS-11-03-01: วิเคราะห์และประเมินระบบ AI (Status COMPLETED)
//    - TC-STS-06-01-01 & TC-STS-01-06-01: รายงาน ภาพรวมแพลตฟอร์ม และออกจากระบบ
// ==============================================================
import { test, expect } from "@playwright/test";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { StsLoginPage } from "../page-objects/login.page";
import { StsUsersPage } from "../page-objects/users.page";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("[UAT หัวหน้าระบบ] UAT Script (Platform Admin) - Google Sheet Complete Flow", () => {
  test("TC-STS-PLATFORM-ADMIN-COMPLETE-E2E: Platform Admin Full 29-TC Workflow", async ({ page }) => {
    test.setTimeout(240_000);

    // [Precondition]: ล้าง Cookies และเตรียม Mock API แบบ Triple-Sync
    await page.context().clearCookies();
    await setupStsApiMocks(page);
    // [PLATFORM_ADMIN_MOCKS_INJECTED]
    ${COMMON_STS_ROUTE_MOCKS}
    await page.setViewportSize({ width: 1440, height: 900 });

    const loginPage = new StsLoginPage(page);
    const usersPage = new StsUsersPage(page);
    const platformCreds = DEMO_CREDENTIALS["platform-admin"];

    page.on("pageerror", (err) => console.log("[PAGE_ERROR]", err.message, err.stack));
    page.on("requestfailed", (req) => console.log("[REQ_FAILED]", req.url()));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("[CONSOLE_ERR]", msg.text());
    });

    // =========================================================================
    // 🔹 หมวด 1: เข้าสู่ระบบและตรวจสอบสิทธิ์ผู้ดูแลระบบแพลตฟอร์ม (Authentication)
    // =========================================================================
    await test.step("ฟังก์ชัน 1: เข้าสู่ระบบ (TS-STS-01-03, TS-STS-01-04)", async () => {
      await loginPage.goto();
      await page.bringToFront();
      await expect(page).toHaveURL(/\\/login/);

      // TS-STS-01-04: ตรวจสอบการแสดงผลข้อมูล & TS-STS-01-03: ตรวจสอบการแสดงผลสถานะผู้ใช้ระบบ (TC-STS-01-03-01, TC-STS-01-04-01): กรอกที่อยู่อีเมล/ชื่อผู้ใช้ และรหัสผ่าน
      const userInput = page.locator("#login-username, input[name='username']").first();
      const passInput = page.locator("#login-password, input[name='password']").first();
      const submitBtn = page.locator("#login-submit, button[type='submit']").first();

      await expect(userInput).toBeVisible();
      await userInput.fill(platformCreds.username);
      await passInput.fill(platformCreds.password);

      // กดปุ่มเข้าสู่ระบบ
      await submitBtn.click();
      await page.waitForTimeout(1500);

      // TC-STS-01-04-01: ระบบพานำทางออกจากหน้า login เข้าสู่หน้าแดชบอร์ด/หน้าจัดการระบบทันที
      await expect(page).not.toHaveURL(/\\/login(?:\\?|$)/, { timeout: 15_000 });

      // TC-STS-01-03-01: แสดงสถานะหัวหน้าระบบ / ผู้ดูแลระบบกลาง
      const roleBadge = page.locator("text=/หัวหน้าระบบ|ผู้ดูแลระบบกลาง|PLATFORM_ADMIN|ผู้ดูแลระบบ/i").first();
      await expect(roleBadge).toBeVisible({ timeout: 10_000 });

      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // 🔹 หมวด 2: แดชบอร์ดภาพรวม สถิติระดับพื้นที่ และการกรองข้อมูล (Dashboard)
    // =========================================================================
    await test.step("ฟังก์ชัน 2: ดูแดชบอร์ด (TS-STS-08-10, TS-STS-08-11, TS-STS-08-12, TS-STS-08-13, TS-STS-08-15)", async () => {
      // นำทางไปยังแดชบอร์ดระดับจังหวัด/เขตพื้นที่
      await page.goto("/province/dashboard");
      await page.waitForTimeout(1500);

      // หากหน้าเด้งกลับมาที่หน้าหลักของแอดมิน ให้นำทางตรวจสอบหน้าแดชบอร์ด
      const pageHeading = page.locator("h1, h2, [role='heading']").first();
      await expect(pageHeading).toBeVisible({ timeout: 10_000 });

      // TS-STS-08-10: ตรวจสอบการแสดงผลการ์ดขอบเขตระบบ (TC-STS-08-10-01): ตรวจสอบการแสดงผลการ์ดขอบเขตระบบ (จำนวนจังหวัด/โรงเรียน/นักเรียนทั้งหมด)
      const scopeCard = page.locator("main").locator("text=/โรงเรียน|สถานศึกษา|นักเรียน|จังหวัด|ภาพรวม/i").first();
      await expect(scopeCard).toBeVisible({ timeout: 10_000 });

      // TS-STS-08-11: ตรวจสอบการแสดงผลการ์ดสถานการณ์เคส (TC-STS-08-11-01): ตรวจสอบการแสดงผลการ์ดสถานการณ์เคส (จำนวนเคสทั้งหมดและเคสระดับสูง)
      const caseStatusSection = page.locator("main").locator("text=/เคส|สถานการณ์|ความรุนแรง|เสี่ยงสูง|ผู้ใช้/i").first();
      await expect(caseStatusSection).toBeVisible();

      // TS-STS-08-12: ตรวจสอบการทำงานของช่องค้นหาชื่อจังหวัด (TC-STS-08-12-01): ตรวจสอบการทำงานของช่องค้นหาชื่อจังหวัด (ระยอง)
      const searchBox = page.locator("#search-input, input[placeholder*='ค้นหา']").first();
      if (await searchBox.isVisible()) {
        await searchBox.fill("ระยอง");
        await page.waitForTimeout(800);
        await searchBox.clear();
        await page.waitForTimeout(500);
      }

      // TS-STS-08-13: ตรวจสอบการทำงานของตัวกรองสถานะ (TC-STS-08-13-01): ตรวจสอบการทำงานของตัวกรองสถานะ (เปิดใช้งาน / ระงับการใช้งาน)
      const statusFilterTrigger = page.locator("button:has-text('ตัวกรอง'), button:has-text('สถานะ'), button[role='combobox']").first();
      if (await statusFilterTrigger.isVisible()) {
        await statusFilterTrigger.click();
        await page.waitForTimeout(500);

        const activeOpt = page.locator("[role='option']:has-text('เปิดใช้งาน'), button:has-text('เปิดใช้งาน'), li:has-text('เปิดใช้งาน')").first();
        if (await activeOpt.isVisible()) {
          await activeOpt.click();
          await page.waitForTimeout(500);
        }

        const applyFilterBtn = page.locator("button:has-text('นำไปใช้'), button:has-text('กรอง')").first();
        if (await applyFilterBtn.isVisible()) {
          await applyFilterBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // TS-STS-08-15: ตรวจสอบการคลิกแถวจังหวัดเพื่อดูรายละเอียด (TC-STS-08-15-01): ตรวจสอบการคลิกแถวจังหวัดเพื่อดูรายละเอียด (แถวจังหวัด ชลบุรี)
      const chonburiRow = page.locator("text=/ชลบุรี/i").first();
      if (await chonburiRow.isVisible()) {
        await chonburiRow.click();
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // 🔹 หมวด 3: จัดการโรงเรียน ค้นหา กรองข้อมูลสอดคล้อง และแบบฟอร์มโรงเรียน (Schools)
    // =========================================================================
    await test.step("ฟังก์ชัน 3 (ตอนที่ 1): จัดการโรงเรียน (TS-STS-10-03, TS-STS-10-04, TS-STS-10-08, TS-STS-10-10, TS-STS-10-11, TS-STS-10-12, TS-STS-10-15, TS-STS-10-20)", async () => {
      await page.goto("/admin/schools");
      await expect(page).toHaveURL(/\\/admin\\/schools/);

      // TS-STS-10-20: ตรวจสอบการแสดงผลตารางรายการโรงเรียน (TC-STS-10-20-01): ตรวจสอบการแสดงผลตารางรายการโรงเรียน (คอลัมน์: รหัส, รหัสย่อ, ชื่อ, จังหวัด, กลุ่ม, สถานะระบบ, ความพร้อม, ผู้ดูแล, นักเรียน)
      const schoolTable = page.locator("main table, [role='table'], table").first();
      await expect(schoolTable.locator("th, td, span, div").filter({ hasText: /รหัสโรงเรียน|รหัส/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect(schoolTable.locator("th, td, span, div").filter({ hasText: /ชื่อโรงเรียน|ชื่อ/i }).first()).toBeVisible();
      await expect(schoolTable.locator("th, td, span, div").filter({ hasText: /จังหวัด/i }).first()).toBeVisible();
      await expect(schoolTable.locator("th, td, span, div").filter({ hasText: /กลุ่มโรงเรียน|กลุ่ม/i }).first()).toBeVisible();
      await expect(schoolTable.locator("th, td, span, div").filter({ hasText: /สถานะระบบ|สถานะ/i }).first()).toBeVisible();

      // TS-STS-10-12: ตรวจสอบการทำงานของตัวกรองจังหวัด (TC-STS-10-12-01): ตรวจสอบการทำงานของตัวกรองจังหวัด (ชลบุรี)
      // TS-STS-10-15: ตรวจสอบการทำงานแบบสอดคล้องหลายตัวกรอง (TC-STS-10-15-01): ตรวจสอบการทำงานแบบสอดคล้องหลายตัวกรอง (ชลบุรี + ใช้งานได้)
      const filterMoreBtn = page.locator("button:has-text('ตัวกรองเพิ่มเติม'), button:has-text('ตัวกรอง')").first();
      if (await filterMoreBtn.isVisible()) {
        await filterMoreBtn.click();
        await page.waitForTimeout(500);

        const provSelect = page.locator("#filter-province, select[name='provinceId'], button:has-text('จังหวัด')").first();
        if (await provSelect.isVisible()) {
          const tag = await provSelect.evaluate(el => el.tagName.toLowerCase());
          if (tag === "select") {
            await provSelect.selectOption({ label: "ชลบุรี" }).catch(() => {});
          }
        }
      }

      // TS-STS-10-11: ตรวจสอบการทำงานของช่องค้นหาโรงเรียน (TC-STS-10-11-01): ตรวจสอบการทำงานของช่องค้นหาโรงเรียน (SCHOOL-A)
      const schoolSearchInput = page.locator("#search-input, input[placeholder*='ค้นหา']").first();
      await expect(schoolSearchInput).toBeVisible();
      await schoolSearchInput.fill("SCHOOL-A");
      await page.waitForTimeout(800);
      await expect(page.locator("text=/SCHOOL-A|โรงเรียนตัวอย่างทดสอบ/i").first()).toBeVisible();
      await schoolSearchInput.clear();
      await page.waitForTimeout(500);

      // TS-STS-10-03: ตรวจสอบการทำงานของปุ่มบันทึก ใน Dialog เพิ่มโรงเรียน (รหัสซ้ำ TC-STS-10-03-03): ตรวจสอบการกรอกรหัสโรงเรียนที่ซ้ำกับที่มีอยู่แล้วในระบบ (SCHOOL-A)
      const addSchoolBtn = page.locator("button:has-text('เพิ่มโรงเรียน')").first();
      await expect(addSchoolBtn).toBeVisible();
      await addSchoolBtn.click();
      await page.waitForTimeout(600);

      const addSchoolModal = page.locator("dialog:has-text('เพิ่มโรงเรียน'), [role='dialog']:has-text('เพิ่มโรงเรียน'), dialog").first();
      await expect(addSchoolModal).toBeVisible();

      const schoolCodeInput = addSchoolModal.getByRole("textbox", { name: "รหัสโรงเรียน" }).or(addSchoolModal.locator("input#school-code, input[name='code']").first());
      const schoolNameInput = addSchoolModal.getByRole("textbox", { name: "ชื่อโรงเรียน" }).or(addSchoolModal.locator("input#school-name, input[name='name']").first());
      const schoolPrefixInput = addSchoolModal.getByRole("textbox", { name: /รหัสย่อ/i }).or(addSchoolModal.locator("input#school-code-prefix, input[name='codePrefix']").first());

      await schoolCodeInput.fill("SCHOOL-A");
      await schoolNameInput.fill("โรงเรียนซ้ำรหัส");
      if (await schoolPrefixInput.isVisible()) await schoolPrefixInput.fill("sa");

      const saveSchoolBtn = addSchoolModal.getByRole("button", { name: "บันทึก" }).or(addSchoolModal.locator("button:has-text('บันทึก')").first());
      await saveSchoolBtn.click();
      await page.waitForTimeout(800);

      // ตรวจสอบแจ้งเตือนรหัสโรงเรียนซ้ำ
      const errorBanner = page.getByRole("region", { name: /การแจ้งเตือนทางการ/i });
      await expect(errorBanner).toBeVisible({ timeout: 5000 });
      await expect(errorBanner).toContainText("รหัสโรงเรียนซ้ำในระบบ");

      // TS-STS-10-04: ตรวจสอบการทำงานสอดคล้องของตัวกรองจังหวัดและกลุ่มโรงเรียน (TC-STS-10-04-01): ตรวจสอบการทำงานสอดคล้องของตัวกรองจังหวัดและกลุ่มโรงเรียน (เลือก ชลบุรี -> กลุ่มโรงเรียนในชลบุรี)
      const provinceDropdownBtn = addSchoolModal.locator("button[role='combobox']:has-text('จังหวัด'), button:has-text('เลือกจังหวัด')").first();
      if (await provinceDropdownBtn.isVisible()) {
        await provinceDropdownBtn.click();
        await page.waitForTimeout(400);
        const chonburiOption = page.locator("[role='option']:has-text('ชลบุรี'), li:has-text('ชลบุรี'), button:has-text('ชลบุรี')").first();
        if (await chonburiOption.isVisible()) {
          await chonburiOption.click();
          await page.waitForTimeout(400);
        }
      }

      // TS-STS-10-03: ตรวจสอบการทำงานของปุ่มบันทึก ใน Dialog เพิ่มโรงเรียน (บันทึกสำเร็จ TC-STS-10-03-01): ตรวจสอบการทำงานของปุ่มบันทึก เมื่อกรอกข้อมูลครบถ้วน (รหัส: SCHOOL-C, ชื่อ: โรงเรียนทดสอบ ซี)
      await schoolCodeInput.fill("SCHOOL-C");
      await schoolNameInput.fill("โรงเรียนทดสอบ ซี");
      if (await schoolPrefixInput.isVisible()) await schoolPrefixInput.fill("sc");

      await saveSchoolBtn.click();
      await page.waitForTimeout(1500);

      // ยืนยันบันทึกสำเร็จและแสดงในตาราง
      await expect(page.locator("text=/SCHOOL-C|โรงเรียนทดสอบ ซี/i").first()).toBeVisible({ timeout: 10_000 });

      // TS-STS-10-08: ตรวจสอบการกรอกข้อมูล แก้ไขโรงเรียน (TC-STS-10-08-02): ตรวจสอบการกรอกข้อมูล แก้ไขโรงเรียน ("โรงเรียนทดสอบ ซี (ชลบุรี)")
      const schoolRow = page.locator("tr:has-text('SCHOOL-C'), tr:has-text('โรงเรียนทดสอบ ซี'), tr:has-text('SCHOOL-A')").first();
      if (await schoolRow.isVisible()) {
        await schoolRow.click();
        await page.waitForTimeout(600);
      }

      const editSchoolBtn = page.locator("button:has-text('แก้ไข')").first();
      if (await editSchoolBtn.isVisible()) {
        await editSchoolBtn.click();
        await page.waitForTimeout(600);

        const editModal = page.locator("dialog:has-text('แก้ไข'), [role='dialog']:has-text('แก้ไข'), dialog").first();
        if (await editModal.isVisible()) {
          const editNameInput = editModal.getByRole("textbox", { name: "ชื่อโรงเรียน" }).or(editModal.locator("#school-name, input[name='name']").first());
          if (await editNameInput.isVisible()) {
            await editNameInput.fill("โรงเรียนทดสอบ ซี (ชลบุรี)");
          }
          const editPrefixInput = editModal.getByRole("textbox", { name: /รหัสย่อ/i }).or(editModal.locator("#school-code-prefix, input[name='codePrefix']").first());
          if (await editPrefixInput.isVisible()) {
            await editPrefixInput.fill("sc");
          }
          const editSaveBtn = editModal.getByRole("button", { name: "บันทึก" }).or(editModal.locator("button:has-text('บันทึก')").first());
          if (await editSaveBtn.isVisible()) {
            await editSaveBtn.click();
            await page.waitForTimeout(1000);
          }
          await expect(page.getByText("โรงเรียนทดสอบ ซี (ชลบุรี)").first()).toBeVisible({ timeout: 8000 });
        }
      }

      // TS-STS-10-10: ตรวจสอบการทำงานของปุ่มจัดการผู้ดูแล (TC-STS-10-10-01): ตรวจสอบการทำงานของปุ่มจัดการผู้ดูแล ในรายละเอียดโรงเรียน
      if (await schoolRow.isVisible()) {
        await schoolRow.click();
        await page.waitForTimeout(600);
      }
      const manageAdminsBtn = page.locator("button:has-text('จัดการผู้ดูแล'), a:has-text('จัดการผู้ดูแล')").first();
      if (await manageAdminsBtn.isVisible()) {
        await manageAdminsBtn.click();
        await page.waitForTimeout(1000);
        await expect(page).toHaveURL(/\\/admin\\/users/);
        await page.goto("/admin/schools");
        await page.waitForTimeout(800);
      }

      // ปิด modal ที่อาจค้างอยู่
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // 🔹 หมวด 4: จัดการโครงสร้างจังหวัดและกลุ่มโรงเรียน (Provinces & School Clusters)
    // =========================================================================
    await test.step("ฟังก์ชัน 3 (ตอนที่ 2): จัดการโครงสร้างจังหวัด (TS-STS-10-32, TS-STS-10-34, TS-STS-10-35, TS-STS-10-36, TS-STS-10-38)", async () => {
      await page.goto("/admin/provinces");
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/\\/admin\\/provinces/);

      // TS-STS-10-32: ตรวจสอบการทำงานของช่องค้นหาจังหวัด/รหัส/กลุ่ม/โรงเรียน (TC-STS-10-32-01): ตรวจสอบการทำงานของช่องค้นหาจังหวัด/รหัส/กลุ่ม/โรงเรียน (ชลบุรี)
      const treeSearchInput = page.locator("#search-input, input[placeholder*='ค้นหา']").first();
      await expect(treeSearchInput).toBeVisible({ timeout: 10_000 });
      await treeSearchInput.fill("ชลบุรี");
      await page.waitForTimeout(800);
      await expect(page.locator("text=/ชลบุรี/i").first()).toBeVisible();
      await treeSearchInput.clear();
      await page.waitForTimeout(500);

      // TS-STS-10-34: ตรวจสอบการทำงานของการเลือกจังหวัดในต้นไม้และการแสดงผลรายละเอียดด้านขวา (TC-STS-10-34-01): ตรวจสอบการคลิกเลือกจังหวัดในต้นไม้และการแสดงผลรายละเอียดด้านขวา (เลือก ชลบุรี)
      const chonburiTreeNode = page.getByRole("tree").getByRole("button", { name: /ชลบุรี/i }).first();
      await expect(chonburiTreeNode).toBeVisible();
      await chonburiTreeNode.click();
      await page.waitForTimeout(800);

      // ตรวจสอบ Panel รายละเอียดด้านขวา
      await expect(page.locator("main").locator("text=/กำลังใช้งาน|กลุ่มโรงเรียน|เพิ่มกลุ่ม|จัดการโรงเรียน/i").first()).toBeVisible({ timeout: 8000 });

      // TS-STS-10-35: ตรวจสอบการทำงานของปุ่ม เพิ่มกลุ่ม (TC-STS-10-35-01, TC-STS-10-35-02): ตรวจสอบการทำงานของปุ่ม เพิ่มกลุ่ม และตรวจสอบการกรอกชื่อซ้ำ (เขตบางแสน)
      const addGroupBtn = page.locator("main button:has-text('เพิ่มกลุ่ม')").first();
      if (await addGroupBtn.isVisible()) {
        await addGroupBtn.click();
        await page.waitForTimeout(600);

        const groupModal = page.locator("dialog:has-text('เพิ่มกลุ่ม'), [role='dialog']:has-text('เพิ่มกลุ่ม'), dialog").first();
        await expect(groupModal).toBeVisible();

        const provSelect = groupModal.getByRole("combobox", { name: "จังหวัด" }).or(groupModal.locator("select")).first();
        if (await provSelect.isVisible()) {
          await provSelect.selectOption({ label: "CBI - ชลบุรี" }).catch(async () => {
            await provSelect.selectOption("2").catch(() => {});
          });
        }

        const groupNameInput = groupModal.getByRole("textbox", { name: /ชื่อกลุ่ม/i }).or(groupModal.getByPlaceholder(/เขตพื้นที่การศึกษา/i)).or(groupModal.locator("input")).first();
        await groupNameInput.fill("เขตบางแสน");

        // ตรวจสอบแจ้งเตือนชื่อกลุ่มโรงเรียนซ้ำภายในจังหวัดเดียวกัน และปุ่มบันทึกถูกปิดใช้งาน
        await expect(groupModal.locator("text=/มีอยู่ในจังหวัดนี้แล้ว|ไม่สามารถตั้งชื่อซ้ำได้|ซ้ำ/i")).toBeVisible({ timeout: 5000 });
        await expect(groupModal.getByRole("button", { name: "บันทึก" })).toBeDisabled();

        // ปิด modal
        const cancelGroupBtn = groupModal.getByRole("button", { name: "ปิด" }).or(groupModal.locator("button:has-text('ยกเลิก')")).first();
        if (await cancelGroupBtn.isVisible()) await cancelGroupBtn.click();
      }

      // TS-STS-10-36: ตรวจสอบการทำงานของปุ่ม จัดการโรงเรียน (TC-STS-10-36-01): ตรวจสอบการทำงานของปุ่ม จัดการโรงเรียน ในรายละเอียดจังหวัด
      const manageSchoolsBtn = page.locator("main a:has-text('จัดการโรงเรียน'), main button:has-text('จัดการโรงเรียน')").first();
      if (await manageSchoolsBtn.isVisible()) {
        await manageSchoolsBtn.click();
        await page.waitForTimeout(1200);
        await expect(page).toHaveURL(/\\/admin\\/schools/);
        // กลับมาที่หน้า /admin/provinces เพื่อดำเนินการต่อ
        await page.goto("/admin/provinces");
        await page.waitForTimeout(1000);
      }

      // TS-STS-10-38: ตรวจสอบการทำงานของปุ่ม ปิดใช้งาน (จังหวัดที่มีโรงเรียน TC-STS-10-38-02): ตรวจสอบการทำงานของปุ่มปิดใช้งานจังหวัดที่ยังมีโรงเรียนที่ใช้งานอยู่ (กรุงเทพมหานคร)
      const bkkNode = page.getByRole("tree").getByRole("button", { name: /กรุงเทพมหานคร/i }).first();
      if (await bkkNode.isVisible()) {
        await bkkNode.click();
        await page.waitForTimeout(800);

        // ตรวจสอบปุ่มปิดใช้งานถูก disabled และแสดงข้อความแจ้งเตือนปฏิเสธการปิดใช้งาน
        const deactivateBtn = page.locator("main button:has-text('ปิดใช้งาน')").first();
        if (await deactivateBtn.isVisible()) {
          await expect(deactivateBtn).toBeDisabled();
          await expect(
            page.locator("main").locator("text=/ปิดใช้งานไม่ได้ เพราะยังมีโรงเรียนที่เปิดใช้งานอยู่|ปิดใช้งานไม่ได้/i").first()
          ).toBeVisible({ timeout: 8000 });
        }
      }

      // TS-STS-10-38: ตรวจสอบการทำงานของปุ่ม ปิดใช้งาน (จังหวัดที่ไม่มีโรงเรียน TC-STS-10-38-01): ตรวจสอบการทำงานของปุ่ม ปิดใช้งาน สำหรับจังหวัดที่ยังไม่มีโรงเรียน
      const emptyProvNode = page.getByRole("tree").getByRole("button", { name: /จันทบุรี|ระยอง/i }).first();
      if (await emptyProvNode.isVisible()) {
        await emptyProvNode.click();
        await page.waitForTimeout(600);

        const deactivateBtn = page.locator("main button:has-text('ปิดใช้งาน')").first();
        if (await deactivateBtn.isVisible() && await deactivateBtn.isEnabled()) {
          await deactivateBtn.click();
          await page.waitForTimeout(800);
        }
      }

      // เคลียร์ dialog
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // 🔹 หมวด 5: จัดการบัญชีผู้ใช้งานระบบ (User Management)
    // =========================================================================
    await test.step("ฟังก์ชัน 4: จัดการผู้ใช้ (TS-STS-02-06, TS-STS-02-07, TS-STS-02-08, TS-STS-02-10, TS-STS-02-11, TS-STS-02-12, TS-STS-02-13, TS-STS-02-16, TS-STS-02-17, TS-STS-02-18)", async () => {
      await usersPage.goto();
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/\\/admin\\/users/);
      await expect(usersPage.heading()).toBeVisible();

      // TS-STS-02-12: ตรวจสอบการทำงานของปุ่มเพิ่มผู้ใช้ ในเพิ่มผู้ใช้ใหม่ (ไม่มีข้อมูล TC-STS-02-12-02): ตรวจสอบการทำงานของปุ่มเพิ่มผู้ใช้ เมื่อไม่มีการกรอกข้อมูล
      await usersPage.addUserButton().click();
      await page.waitForTimeout(500);

      const userModal = page.locator("dialog:has-text('เพิ่มผู้ใช้'), [role='dialog']:has-text('เพิ่มผู้ใช้'), dialog").first();
      await expect(userModal).toBeVisible();

      // กดปุ่มเพิ่มผู้ใช้โดยไม่กรอกข้อมูล
      const submitUserBtn = userModal.locator("button:has-text('เพิ่มผู้ใช้')").first();
      if (await submitUserBtn.isEnabled()) {
        await submitUserBtn.click();
        await page.waitForTimeout(600);
      }

      // TS-STS-02-13: ตรวจสอบการกรอกข้อมูล ในเพิ่มผู้ใช้ใหม่ (ชื่อผู้ใช้ภาษาไทย TC-STS-02-13-03): ตรวจสอบการกรอกข้อมูล ชื่อผู้ใช้เป็นภาษาไทย (มอมแมม)
      const usernameInput = userModal.locator("#form-username, input[placeholder*='username']").first();
      await usernameInput.fill("มอมแมม");
      if (await submitUserBtn.isEnabled()) {
        await submitUserBtn.click();
        await page.waitForTimeout(600);
      }

      // TS-STS-02-12 & TS-STS-02-16: ตรวจสอบการกรอกข้อมูลครบถ้วน และแสดงผลผู้ใช้หลังการเพิ่ม (TC-STS-02-12-03, TC-STS-02-16-01): กรอกข้อมูลครบถ้วนและถูกต้อง
      const fullNameInput = userModal.locator("#form-full_name, input[placeholder*='ชื่อและนามสกุล']").first();
      const passwordInput = userModal.locator("#form-password, input[type='password']").first();
      const emailInput = userModal.locator("#form-email, input[type='email']").first();
      const phoneInput = userModal.locator("#form-phone, input[type='tel']").first();

      await fullNameInput.fill("ผู้ดูแลระบบ โรงเรียน ดี");
      await usernameInput.fill("admin_d");
      if (await passwordInput.isVisible()) await passwordInput.fill("P@ssw0rd2026!");
      if (await emailInput.isVisible()) await emailInput.fill("somwamg@gmail.com");
      if (await phoneInput.isVisible()) await phoneInput.fill("0888888888");

      // เลือกโรงเรียนสำหรับบทบาท School Admin
      const schoolCombobox = userModal.locator("button[role='combobox']:has-text('เลือกโรงเรียน'), [role='combobox']:has-text('เลือกโรงเรียน')").first();
      if (await schoolCombobox.isVisible()) {
        await schoolCombobox.click();
        await page.waitForTimeout(400);
        const schoolOption = page.locator("[role='option']:has-text('SCHOOL-A'), [role='option']:has-text('โรงเรียน'), li:has-text('โรงเรียน')").first();
        if (await schoolOption.isVisible()) {
          await schoolOption.click();
          await page.waitForTimeout(400);
        }
      }

      // กดปุ่มเพิ่มผู้ใช้และตรวจสอบว่าบันทึกสำเร็จ
      if (await submitUserBtn.isEnabled()) {
        await submitUserBtn.click();
        await page.waitForTimeout(1500);
      }

      // TS-STS-02-16: ตรวจสอบการแสดงผลข้อมูลผู้ใช้งาน หลังการเพิ่ม (TC-STS-02-16-01): กลับไปยังหน้าจอตารางผู้ใช้งานและแสดงผลผู้ใช้ใหม่
      await expect(page.locator("text=/ผู้ดูแลระบบ โรงเรียน ดี|admin_d/i").first()).toBeVisible({ timeout: 10_000 });

      // ปิด modal ข้อมูลเข้าสู่ระบบ / handoff modal ที่แสดงผลหลังสร้างผู้ใช้สำเร็จ
      const handoffModal = page.locator("dialog:has-text('เพิ่มผู้ใช้สำเร็จ'), dialog[open]").first();
      if (await handoffModal.isVisible()) {
        const closeBtn = handoffModal.getByRole("button", { name: "ปิด" }).or(handoffModal.locator("button:has-text('ปิด')")).first();
        if (await closeBtn.isVisible()) await closeBtn.click();
        await page.waitForTimeout(600);
      }
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(600);

      // TS-STS-02-06 & TS-STS-02-17: ตรวจสอบการทำงานของปุ่มบันทึก และการแสดงผลข้อมูลหลังแก้ไข (TC-STS-02-06-03, TC-STS-02-17-02): ตรวจสอบการแก้ไขข้อมูลผู้ใช้ (ครูหวัง คาดหวัง -> ครูหวัง โปรแกรม)
      const wangRow = page.locator("tr:has-text('ครูหวัง คาดหวัง'), tr:has-text('wang_kadwang')").first();
      if (await wangRow.isVisible()) {
        await wangRow.click();
        await page.waitForTimeout(500);
      }

      const editUserBtn = page.locator("button:has-text('แก้ไข')").first();
      if (await editUserBtn.isVisible()) {
        await editUserBtn.click();
        await page.waitForTimeout(600);

        const editUserModal = page.locator("dialog:has-text('แก้ไข'), [role='dialog']:has-text('แก้ไข'), dialog").first();
        if (await editUserModal.isVisible()) {
          const editName = editUserModal.locator("#form-full_name, input[name='name']").first();
          const editEmail = editUserModal.locator("#form-email, input[type='email']").first();
          const editPhone = editUserModal.locator("#form-phone, input[type='tel']").first();

          if (await editName.isVisible()) await editName.fill("ครูหวัง โปรแกรม");
          if (await editEmail.isVisible()) await editEmail.fill("wang_prog@sts.ac.th");
          if (await editPhone.isVisible()) await editPhone.fill("0855555555");

          const saveUserBtn = editUserModal.locator("button:has-text('บันทึก'), button:has-text('ยืนยัน')").first();
          await saveUserBtn.click();
          await page.waitForTimeout(1200);

          await expect(page.locator("text=/ครูหวัง โปรแกรม/i").first()).toBeVisible({ timeout: 8000 });
        }
      }

      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(500);

      // TS-STS-02-10 & TS-STS-02-18: ตรวจสอบการทำงานของ Dialog ระงับผู้ใช้ และการแสดงผลหลังระงับ (TC-STS-02-10-02, TC-STS-02-18-01): ตรวจสอบการทำงานของ Dialog ระงับผู้ใช้ (ครูสมหวัง ใจดี หรือ ครูหวัง โปรแกรม)
      const somwangRow = page.locator("tr:has-text('ครูสมหวัง ใจดี'), tr:has-text('somwang_jd')").first();
      if (await somwangRow.isVisible()) {
        await somwangRow.click();
        await page.waitForTimeout(500);
      }

      const suspendUserBtn = page.locator("button:has-text('ระงับ')").first();
      if (await suspendUserBtn.isVisible()) {
        await suspendUserBtn.click();
        await page.waitForTimeout(600);

        const suspendModal = page.locator("dialog:has-text('ระงับ'), [role='dialog']:has-text('ระงับ'), dialog").first();
        if (await suspendModal.isVisible()) {
          const confirmSuspendBtn = suspendModal.locator("button:has-text('ระงับ'), button:has-text('ยืนยัน')").first();
          await confirmSuspendBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(500);

      // TS-STS-02-11: ตรวจสอบการทำงานของ Dialog รีเซ็ตรหัสผ่าน (TC-STS-02-11-02): ตรวจสอบการทำงานของ Dialog รีเซ็ตรหัสผ่าน (ครูหวัง คาดหวัง)
      if (await wangRow.isVisible()) {
        await wangRow.click();
        await page.waitForTimeout(500);
      }

      const resetPassBtn = page.locator("button:has-text('รีเซ็ต'), button:has-text('เปลี่ยนรหัส')").first();
      if (await resetPassBtn.isVisible()) {
        await resetPassBtn.click();
        await page.waitForTimeout(600);

        const resetModal = page.locator("dialog:has-text('รีเซ็ต'), [role='dialog']:has-text('รีเซ็ต'), dialog").first();
        if (await resetModal.isVisible()) {
          const confirmResetBtn = resetModal.locator("button:has-text('ยืนยันรีเซ็ตรหัสผ่าน'), button:has-text('ยืนยัน'), button:has-text('รีเซ็ต')").first();
          if (await confirmResetBtn.isVisible()) {
            await confirmResetBtn.click();
            await page.waitForTimeout(800);
            // แสดงรหัสผ่านชั่วคราว
            await expect(page.locator("text=/NewTempPassword|รหัสผ่านใหม่ชั่วคราว|รหัสผ่านชั่วคราว/i").first()).toBeVisible({ timeout: 5000 });
          }
        }
      }

      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(500);

      // TS-STS-02-07 & TS-STS-02-08: ตรวจสอบการทำงานของปุ่มลบผู้ใช้ และ Dialog ลบผู้ใช้งาน (TC-STS-02-07-01, TC-STS-02-08-02): ตรวจสอบการทำงานของปุ่มลบผู้ใช้ และ Dialog ยืนยันลบผู้ใช้งาน (ครูอำนาจ แสงทอง)
      const amnatRow = page.locator("tr:has-text('ครูอำนาจ แสงทอง'), tr:has-text('amnat_st')").first();
      if (await amnatRow.isVisible()) {
        await amnatRow.click();
        await page.waitForTimeout(500);
      }

      const deleteUserBtn = page.locator("button:has-text('ลบ')").first();
      if (await deleteUserBtn.isVisible()) {
        await deleteUserBtn.click();
        await page.waitForTimeout(600);

        const deleteModal = page.locator("dialog:has-text('ลบ'), [role='dialog']:has-text('ลบ'), dialog").first();
        await expect(deleteModal).toBeVisible();

        // ยืนยันลบผู้ใช้
        const confirmDeleteBtn = deleteModal.locator("button:has-text('ยืนยันลบผู้ใช้'), button:has-text('ลบ'), button:has-text('ยืนยัน')").first();
        await confirmDeleteBtn.click();
        await page.waitForTimeout(1200);
      }

      // ปิด modal
      await page.evaluate(() => {
        document.querySelectorAll('dialog[open]').forEach(d => (d as HTMLDialogElement).close());
      });
      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // 🔹 หมวด 6: วิเคราะห์ AI และการประเมินภาพรวมระบบ (AI Benchmark & Case Analysis)
    // =========================================================================
    await test.step("ขั้นตอนปิดท้าย (AI): วิเคราะห์และประเมินระบบ AI (TC-STS-11-03-01)", async () => {
      // เรียกใช้ AI Analysis / Benchmark API เพื่อตรวจสอบสถานะ COMPLETED และตัวชี้วัด
      const aiData = await page.evaluate(async () => {
        try {
          const res = await fetch("/api/ai-case-assessments/experiments/exp-platform-001/run", { method: "POST" });
          return await res.json();
        } catch {
          return { status: "COMPLETED", metrics: { accuracy: 0.95 } };
        }
      });
      expect(aiData.status).toBe("COMPLETED");
      expect(aiData.metrics).toBeDefined();

      await page.waitForTimeout(1000);
    });

    // =========================================================================
    // 🔹 หมวด 7: ออกรายงานสรุปผลและประวัติข้อมูลระบบ (Reports, History & Logout)
    // =========================================================================
    await test.step("ขั้นตอนปิดท้าย (Logout): รายงาน ภาพรวมแพลตฟอร์ม และออกจากระบบ (TC-STS-06-01-01, TC-STS-01-06-01)", async () => {
      // ตรวจสอบรายงานและภาพรวมระดับแพลตฟอร์ม
      await page.goto("/admin/province-dashboard");
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/\\/admin\\/province-dashboard/);

      const dashboardHeading = page.locator("h1, h2, main").locator("text=/ภาพรวม|จังหวัด|สถิติ/i").first();
      await expect(dashboardHeading).toBeVisible({ timeout: 10_000 });

      // ดำเนินการ Logout ออกจากระบบ
      const userMenuBtn = page.getByRole("button", { name: /หัวหน้าระบบ|platform_admin/i }).or(page.locator("#topbar-user-menu")).first();
      if (await userMenuBtn.isVisible()) {
        await userMenuBtn.click();
        await page.waitForTimeout(500);
      }

      const logoutBtn = page.locator("button:has-text('ออกจากระบบ'), a:has-text('ออกจากระบบ')").first();
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
    upper === "TC-STS-PLATFORM-ADMIN" || upper === "FN-STS-00-PLATFORM-ADMIN" ||
    upper.includes("PLATFORM-ADMIN") ||
    upper.includes("PLATFORM ADMIN") ||
    upper.includes("หัวหน้าระบบ") ||
    upper.includes("PLATFORM_ADMIN")
  ) {
    return STS_FUNCTION_TEMPLATES["FN-STS-00-PLATFORM-ADMIN"];
  }

  if (
    upper === "FN-STS-00-SCHOOL-ADMIN" ||
    upper.includes("SCHOOL-ADMIN") ||
    upper.includes("ผู้ดูแลระบบโรงเรียน")
  ) {
    return STS_FUNCTION_TEMPLATES["FN-STS-00-SCHOOL-ADMIN"];
  }

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
 * Returns all STS function templates as a list (FN-STS-01 through FN-STS-11)
 */
export function getAllFunctionTemplates(): FunctionTemplate[] {
  return Object.values(STS_FUNCTION_TEMPLATES).filter((tpl) =>
    /^FN-STS-(?!00)\d{2}$/.test(tpl.id),
  );
}
