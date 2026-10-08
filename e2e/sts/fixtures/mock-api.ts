import type { Page } from "@playwright/test";
import { DEMO_CREDENTIALS } from "./auth-data";

export async function setupStsApiMocks(
  page: Page,
  options?: { enableAdminTwoFactor?: boolean },
) {
  let activeUser = {
    id: 99,
    username: "teacher_a",
    name: "UAT User (teacher_a)",
    role: "TEACHER",
    schoolId: 1,
    provinceId: 1,
  };

  // 1. Auth login mock
  await page.route("**/api/auth/login", async (route) => {
    let postData: { username?: string; password?: string } | null = null;
    try {
      postData = route.request().postDataJSON();
    } catch {
      postData = null;
    }
    const { username, password } = postData || {};

    if (password === "changeme") {
      const roleEntry = Object.values(DEMO_CREDENTIALS).find(
        (c) => c.username === username,
      );
      const roleEnum = roleEntry ? roleEntry.roleEnum : "TEACHER";

      activeUser = {
        id: 99,
        username: username || "teacher_a",
        name: `UAT User (${username || "teacher_a"})`,
        role: roleEnum,
        schoolId: 1,
        provinceId: 1,
      };

      // หากเปิดใช้งาน enableAdminTwoFactor สำหรับผู้ดูแลระบบ ให้ส่ง requiresTwoFactor challenge
      if (options?.enableAdminTwoFactor && (username === "admin_a" || username === "admin_school1")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            requiresTwoFactor: true,
            challengeId: "mock-2fa-admin-a",
            maskedEmail: "admin_a@example.com",
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "mock-jwt-token-from-monitor",
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

  // 1.05 Auth 2FA login mock
  await page.route("**/api/auth/login/2fa", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "mock-jwt-token-from-monitor",
        user: activeUser,
      }),
    });
  });

  await page.route("**/api/auth/login/2fa/resend", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requiresTwoFactor: true,
        challengeId: "mock-2fa-admin-a-resend",
        maskedEmail: "admin_a@example.com",
      }),
    });
  });

  await page.route("**/api/auth/step-up/user-access", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stepUpToken: "mock-step-up-token-12345",
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      }),
    });
  });

  // 1.1 Auth refresh mock (essential for page reloads / deep linking with AuthGate)
  await page.route("**/api/auth/refresh*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "mock-jwt-token-from-monitor",
        user: activeUser,
      }),
    });
  });

  // 1.2 Auth change password mock
  await page.route(/\/api\/auth\/change-password/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // 2. Academic years & term
  await page.route("**/api/academic-years/current*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        year: "2569",
        startDate: "2026-05-16",
        endDate: "2027-03-31",
        isCurrent: true,
        terms: [
          { termNo: 1, startDate: "2026-05-16", endDate: "2026-10-15", isCurrent: true },
        ],
      }),
    });
  });

  await page.route("**/api/academic-years", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          year: "2569",
          startDate: "2026-05-16",
          endDate: "2027-03-31",
          isCurrent: true,
          terms: [
            { termNo: 1, startDate: "2026-05-16", endDate: "2026-10-15", isCurrent: true },
          ],
        },
      ]),
    });
  });

  // 3. Teacher classrooms (numeric string ID required by useAttendanceSession/Rounds)
  await page.route("**/api/my-classrooms*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "1", name: "ม.3/1", gradeLevel: 9, studentCount: 35 },
        { id: "2", name: "ม.3/2", gradeLevel: 9, studentCount: 32 },
      ]),
    });
  });

  // 4. Classrooms list & CRUD for filters & lookups
  const mockClassroomsList: Array<any> = [
    {
      id: 1,
      roomName: "1",
      room_number: "1",
      roomNumber: "1",
      grade: "ม.3",
      name: "ม.3/1",
      grade_level_id: 9,
      gradeLevelId: 9,
      gradeLevel: { id: 9, name: "มัธยมศึกษาปีที่ 3", code: "M3" },
      academicYearId: 1,
      academic_year_id: 1,
      academicYear: "2569",
      academic_year: "2569",
      studentCount: 35,
      student_count: 35,
      capacity: 40,
      isActive: true,
      advisors: [
        { teacherId: 2, role: "HOMEROOM", teacher: { id: 2, name: "สมหญิง ครูประจำชั้น (Teacher)", username: "teacher_a" } },
      ],
    },
    {
      id: 2,
      roomName: "2",
      room_number: "2",
      roomNumber: "2",
      grade: "ม.3",
      name: "ม.3/2",
      grade_level_id: 9,
      gradeLevelId: 9,
      gradeLevel: { id: 9, name: "มัธยมศึกษาปีที่ 3", code: "M3" },
      academicYearId: 1,
      academic_year_id: 1,
      academicYear: "2569",
      academic_year: "2569",
      studentCount: 32,
      student_count: 32,
      capacity: 40,
      isActive: true,
      advisors: [],
    },
    {
      id: 3,
      roomName: "1",
      room_number: "1",
      roomNumber: "1",
      grade: "ม.1",
      name: "ม.1/1",
      grade_level_id: 7,
      gradeLevelId: 7,
      gradeLevel: { id: 7, name: "มัธยมศึกษาปีที่ 1", code: "M1" },
      academicYearId: 1,
      academic_year_id: 1,
      academicYear: "2569",
      academic_year: "2569",
      studentCount: 30,
      student_count: 30,
      capacity: 40,
      isActive: true,
      advisors: [],
    },
    {
      id: 4,
      roomName: "2",
      room_number: "2",
      roomNumber: "2",
      grade: "ม.1",
      name: "ม.1/2",
      grade_level_id: 7,
      gradeLevelId: 7,
      gradeLevel: { id: 7, name: "มัธยมศึกษาปีที่ 1", code: "M1" },
      academicYearId: 1,
      academic_year_id: 1,
      academicYear: "2569",
      academic_year: "2569",
      studentCount: 40, // ห้องเต็ม
      student_count: 40,
      capacity: 40,
      isActive: true,
      advisors: [],
    },
    {
      id: 5,
      roomName: "3",
      room_number: "3",
      roomNumber: "3",
      grade: "ม.1",
      name: "ม.1/3",
      grade_level_id: 7,
      gradeLevelId: 7,
      gradeLevel: { id: 7, name: "มัธยมศึกษาปีที่ 1", code: "M1" },
      academicYearId: 1,
      academic_year_id: 1,
      academicYear: "2569",
      academic_year: "2569",
      studentCount: 20,
      student_count: 20,
      capacity: 40,
      isActive: true,
      advisors: [],
    },
  ];

  await page.route(/\/api\/lookups\/grade-level/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 7, name: "มัธยมศึกษาปีที่ 1", code: "M1" },
        { id: 8, name: "มัธยมศึกษาปีที่ 2", code: "M2" },
        { id: 9, name: "มัธยมศึกษาปีที่ 3", code: "M3" },
        { id: 10, name: "มัธยมศึกษาปีที่ 4", code: "M4" },
        { id: 11, name: "มัธยมศึกษาปีที่ 5", code: "M5" },
        { id: 12, name: "มัธยมศึกษาปีที่ 6", code: "M6" },
      ]),
    });
  });

  await page.route(/\/api\/classrooms(?:\/.*)?/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Advisors endpoints
    if (url.includes("/advisors")) {
      const matchAdv = url.match(/\/api\/classrooms\/(\d+)\/advisors(?:\/(\d+))?/);
      if (matchAdv) {
        const clsId = Number(matchAdv[1]);
        const teacherId = matchAdv[2] ? Number(matchAdv[2]) : null;
        const targetCls = mockClassroomsList.find((c) => c.id === clsId);

        if (method === "DELETE" && teacherId && targetCls) {
          targetCls.advisors = targetCls.advisors.filter((a: any) => a.teacherId !== teacherId);
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
        }
        if (method === "POST" && targetCls) {
          let postData: any = {};
          try { postData = route.request().postDataJSON(); } catch { postData = {}; }
          const tId = Number(postData.teacherId);
          // ลบครูคนนี้ออกจากห้องอื่นก่อน (ถ้า confirmMove)
          mockClassroomsList.forEach((c) => {
            c.advisors = c.advisors.filter((a: any) => a.teacherId !== tId);
          });
          targetCls.advisors.push({
            teacherId: tId,
            role: postData.role || "HOMEROOM",
            teacher: { id: tId, name: tId === 2 ? "สมหญิง ครูประจำชั้น (Teacher)" : "ครูอำนาจ คาดหวัง", username: `teacher_${tId}` },
          });
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, advisor: { teacherId: tId } }) });
        }
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }

    // POST create classroom
    if (method === "POST" && !url.includes("/bulk")) {
      let data: any = {};
      try { data = route.request().postDataJSON(); } catch { data = {}; }
      const rName = String(data.roomName || data.room_number || "1");
      const gId = Number(data.gradeLevelId || data.grade_level_id || 7);
      if (rName === "1" && (gId === 7 || data.grade === "ม.1" || String(data.gradeLevel || "").includes("1"))) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "มีห้องเรียนนี้อยู่แล้ว", error: "Conflict" }),
        });
      }
      const newCls = {
        id: mockClassroomsList.length + 1,
        roomName: String(data.roomName || data.room_number || "1"),
        room_number: String(data.roomName || data.room_number || "14"),
        roomNumber: String(data.roomName || data.room_number || "14"),
        grade: "ม.2",
        name: `ม.2/${data.roomName || data.room_number || "14"}`,
        grade_level_id: 8,
        gradeLevelId: 8,
        gradeLevel: { id: 8, name: "มัธยมศึกษาปีที่ 2", code: "M2" },
        academicYearId: 1,
        academic_year_id: 1,
        academicYear: "2569",
        academic_year: "2569",
        studentCount: 0,
        student_count: 0,
        capacity: Number(data.capacity || 40),
        isActive: true,
        advisors: [],
      };
      mockClassroomsList.push(newCls);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newCls) });
    }

    // PATCH update classroom
    if (method === "PATCH") {
      const matchId = url.match(/\/api\/classrooms\/(\d+)/);
      if (matchId) {
        const cId = Number(matchId[1]);
        const targetCls = mockClassroomsList.find((c) => c.id === cId);
        if (targetCls) {
          let patchData: any = {};
          try { patchData = route.request().postDataJSON(); } catch { patchData = {}; }
          if (patchData.capacity !== undefined) targetCls.capacity = Number(patchData.capacity);
          if (patchData.roomName !== undefined) targetCls.roomName = String(patchData.roomName);
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(targetCls) });
        }
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }

    // GET single classroom: /api/classrooms/:id
    const matchSingle = url.match(/\/api\/classrooms\/(\d+)(?:\?|$)/);
    if (matchSingle && method === "GET") {
      const cId = Number(matchSingle[1]);
      const found = mockClassroomsList.find((c) => c.id === cId) || mockClassroomsList[0];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(found) });
    }

    // GET list
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockClassroomsList),
    });
  });

  // Placement unassigned & batch mocks
  await page.route(/\/api\/placement\/unassigned/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            studentId: 106,
            studentCode: "aa691101",
            name: "กมล บุญมาก",
            gradeNumber: 1,
            gpax: 3.45,
          },
          {
            studentId: 107,
            studentCode: "aa691102",
            name: "กมล ปิ่นทอง",
            gradeNumber: 1,
            gpax: 3.12,
          },
        ],
        meta: { total: 2, page: 1, limit: 50, lastPage: 1 },
      }),
    });
  });

  await page.route(/\/api\/placement\/batch|\/api\/enrollments\/batch/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        succeeded: [106],
        failed: [],
        warnings: [],
      }),
    });
  });

  // 5. Teacher dashboard stats
  let attendanceSubmittedToday = false;
  await page.route("**/api/dashboard/teacher*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalStudentsInClassroom: 35,
        totalStudents: 35,
        attendanceSummary: attendanceSubmittedToday
          ? {
              totalStudents: 35,
              presentCount: 32,
              absentCount: 1,
              lateCount: 2,
              leaveCount: 0,
              attendanceRate: 91.4,
            }
          : {
              totalStudents: 35,
              presentCount: 0,
              absentCount: 0,
              lateCount: 0,
              leaveCount: 0,
              attendanceRate: 0,
            },
        attendanceToday: attendanceSubmittedToday
          ? {
              present: 32,
              absent: 1,
              late: 2,
              leave: 0,
              attendanceRate: 91.4,
            }
          : {
              present: 0,
              absent: 0,
              late: 0,
              leave: 0,
              attendanceRate: 0,
            },
        myAssignedCasesCount: 2,
        absentStudentsList: [
          {
            studentId: "102",
            studentCode: "50002",
            fullName: "ชาญชัย มีสุข",
            classroomName: "ม.3/1",
            absentDaysCount: 4,
            hasActiveCase: true,
            activeCaseId: "201",
            caseSeverity: "high",
          },
        ],
        pendingCasesToFollowUp: [
          {
            case_id: "201",
            activeCaseId: "201",
            studentId: "102",
            studentName: "ชาญชัย มีสุข",
            classroomName: "ม.3/1",
            severity: "high",
            caseSeverity: "high",
            updatedAt: new Date().toISOString(),
          },
          {
            case_id: "203",
            activeCaseId: "203",
            studentId: "104",
            studentName: "กนกวรรณ ทองดี",
            classroomName: "ม.3/1",
            severity: "high",
            caseSeverity: "high",
            updatedAt: new Date().toISOString(),
          },
        ],
        attentionQueue: [
          {
            studentId: "102",
            studentName: "ชาญชัย มีสุข",
            reason: "ขาดเรียน 4 วันติดต่อกัน",
            severity: "high",
          },
        ],
        classrooms: [
          { id: "1", name: "ม.3/1", studentCount: 35, attendanceRate: 91.4 },
        ],
        myClassrooms: [
          { id: 1, gradeLevelName: "ม.3", roomName: "1", studentCount: 35 },
          { id: 2, gradeLevelName: "ม.3", roomName: "2", studentCount: 32 },
        ],
      }),
    });
  });

  // 6. Director Action Center mock
  await page.route("**/api/dashboard/director/action-center*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scope: {
          schoolId: 1,
          schoolName: "โรงเรียนตัวอย่างทดสอบ",
          academicYearId: 1,
          academicYearLabel: "2569 / เทอม 1",
        },
        generatedAt: new Date().toISOString(),
        abnormalAbsenceThresholdDays: 3,
        summary: {
          waitingDecisionCount: 2,
          criticalHighCount: 1,
          abnormalAbsenceCount: 1,
          attendanceRateToday: 95.5,
          hasAttendanceData: true,
        },
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

  // 7. Director Analytics mock (รองรับการจำลองผลลัพธ์ตัวกรองห้องเรียน/ช่วงเวลา)
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
          ? {
              totalStudents: 35,
              totalClassrooms: 1,
              totalCases: 2,
              closedCases: 1,
            }
          : {
              totalStudents: 850,
              totalClassrooms: 24,
              totalCases: 12,
              closedCases: 4,
            },
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
          ? {
              LOW: 1,
              MEDIUM: 1,
              HIGH: 0,
              UNASSESSED: 0,
            }
          : {
              LOW: 5,
              MEDIUM: 4,
              HIGH: 3,
              UNASSESSED: 0,
            },
      }),
    });
  });

  // 8. Admin Operations Dashboard mock
  await page.route("**/api/dashboard/admin/operations*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        school: { id: 1, name: "โรงเรียนตัวอย่างทดสอบ" },
        currentAcademicYear: "2569",
        currentTerm: 1,
        window: {
          days: 7,
          currentStart: "2026-09-21",
          currentEnd: "2026-09-28",
          previousStart: "2026-09-14",
          previousEnd: "2026-09-20",
        },
        metrics: {
          attendanceRate: { value: 96.2, previousValue: 95.1, delta: 1.1, unit: "PERCENT", available: true },
          consecutiveAbsenceStudents: { value: 3, previousValue: 5, delta: -2, unit: "COUNT", available: true },
          pendingCases: { value: 8, previousValue: 10, delta: -2, unit: "COUNT", available: true },
          dataReadiness: { value: 98.0, previousValue: 95.0, delta: 3.0, unit: "PERCENT", available: true },
        },
        attendanceTrend: [
          { date: "2026-09-24", rate: 96.0, presentCount: 816, absentCount: 34 },
          { date: "2026-09-25", rate: 96.5, presentCount: 820, absentCount: 30 },
        ],
        actionQueue: [
          {
            id: "act-1",
            actionCode: "MISSING_ADVISOR",
            category: "CLASSROOM",
            severity: "HIGH",
            title: "ห้องเรียนยังไม่มีครูที่ปรึกษา",
            description: "มีห้องเรียนที่ยังไม่มีครูที่ปรึกษาประจำชั้น",
            count: 2,
            occurredAt: "2026-09-28T08:00:00Z",
            href: "/admin/classrooms?filter=missing-advisor",
            actionUrl: "/admin/classrooms?filter=missing-advisor",
          },
          {
            id: "act-2",
            actionCode: "OVERDUE_CASES",
            category: "CASE",
            severity: "HIGH",
            title: "เคสติดตามค้างดำเนินการเกิน 7 วัน",
            description: "มีเคสติดตามนักเรียนที่ค้างดำเนินการเกิน 7 วัน",
            count: 4,
            occurredAt: "2026-09-28T08:00:00Z",
            href: "/admin/cases?filter=overdue-7-days",
            actionUrl: "/admin/cases?filter=overdue-7-days",
          },
          {
            id: "act-3",
            actionCode: "OVER_CAPACITY",
            category: "CLASSROOM",
            severity: "MEDIUM",
            title: "ห้องเรียนเกินความจุที่กำหนด",
            description: "มีห้องเรียนที่มีจำนวนนักเรียนเกินความจุ",
            count: 1,
            occurredAt: "2026-09-28T08:00:00Z",
            href: "/admin/classrooms?filter=over-capacity",
            actionUrl: "/admin/classrooms?filter=over-capacity",
          },
          {
            id: "act-4",
            actionCode: "UNASSIGNED_STUDENTS",
            category: "STUDENT",
            severity: "MEDIUM",
            title: "นักเรียนยังไม่มีห้องเรียน",
            description: "มีนักเรียนที่ยังไม่ได้จัดสรรเข้าห้องเรียน",
            count: 5,
            occurredAt: "2026-09-28T08:00:00Z",
            href: "/admin/students?filter=unassigned",
            actionUrl: "/admin/students?filter=unassigned",
          },
        ],
        totalActionCount: 4,
        dataReadiness: {
          scorePercentage: 85,
          checks: [
            {
              key: "STUDENT_ENROLLMENT",
              label: "ข้อมูลนักเรียนในชั้นเรียน",
              status: "READY",
              message: "นักเรียนทุกคนมีชั้นเรียนสังกัด",
              affectedCount: 0,
              actionCode: null,
            },
            {
              key: "CLASSROOM_ADVISOR",
              label: "การจัดการครูประจำชั้นครบทุกห้อง",
              title: "การจัดการครูประจำชั้นครบทุกห้อง",
              status: "NOT_READY",
              message: "ยังมีห้องเรียนที่ยังไม่มีครูประจำชั้น",
              affectedCount: 2,
              actionCode: "ASSIGN_ADVISOR",
              actionUrl: "/admin/classrooms",
              link: "/admin/classrooms",
              buttonLabel: "จัดการห้องเรียน",
            },
          ],
        },
        dataAvailability: "AVAILABLE",
        generatedAt: "2026-09-28T08:00:00Z",
      }),
    });
  });

  // 9. Attendance sessions & daily records
  await page.route("**/api/attendance/sessions/*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          roundNumber: 1,
          createdAt: new Date().toISOString(),
          recordCount: 3,
        },
      ]),
    });
  });

  await page.route("**/api/attendance/daily/*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          date: new Date().toISOString().split("T")[0],
          status: "PRESENT",
          note: "",
          studentId: 101,
          enrollmentId: 1,
          updatedAt: new Date().toISOString(),
          enrollment: { id: 1, student: { id: 101 } },
        },
        {
          id: 2,
          date: new Date().toISOString().split("T")[0],
          status: "ABSENT",
          note: "มีอาการป่วย",
          studentId: 102,
          enrollmentId: 2,
          updatedAt: new Date().toISOString(),
          enrollment: { id: 2, student: { id: 102 } },
        },
        {
          id: 3,
          date: new Date().toISOString().split("T")[0],
          status: "PRESENT",
          note: "",
          studentId: 103,
          enrollmentId: 3,
          updatedAt: new Date().toISOString(),
          enrollment: { id: 3, student: { id: 103 } },
        },
      ]),
    });
  });

  await page.route("**/api/attendance/summary/*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        absentCount: 0,
        sickLeaveCount: 0,
        personalLeaveCount: 0,
      }),
    });
  });

  // 9.1 Attendance query mock (handles /api/attendance?enrollmentId=... or /api/attendance/...)
  await page.route(/\/api\/attendance/, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (method === "PATCH" || url.includes("/bulk")) {
      attendanceSubmittedToday = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          succeeded: 5,
          failed: [],
        }),
      });
    }

    if (method === "POST") {
      attendanceSubmittedToday = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: 5,
        }),
      });
    }

    if (url.includes("/sessions/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, roundNumber: 1, createdAt: new Date().toISOString(), recordCount: 3 },
        ]),
      });
    }
    if (url.includes("/daily/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            date: new Date().toISOString().split("T")[0],
            status: "PRESENT",
            note: "",
            studentId: 101,
            enrollmentId: 1,
            updatedAt: new Date().toISOString(),
            enrollment: { id: 1, student: { id: 101 } },
          },
          {
            id: 2,
            date: new Date().toISOString().split("T")[0],
            status: "ABSENT",
            note: "มีอาการป่วย",
            studentId: 102,
            enrollmentId: 2,
            updatedAt: new Date().toISOString(),
            enrollment: { id: 2, student: { id: 102 } },
          },
        ]),
      });
    }
    if (url.includes("/summary/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ absentCount: 0, sickLeaveCount: 0, personalLeaveCount: 0 }),
      });
    }
    if (url.includes("/alerts")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, date: "2026-09-25", status: "PRESENT", note: "", reasonName: "" },
        { id: 2, date: "2026-09-24", status: "PRESENT", note: "", reasonName: "" },
      ]),
    });
  });

  // 9.2 Cases query mock
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
        student: {
          id: 102,
          firstName: "ชาญชัย",
          lastName: "มีสุข",
          studentCode: "50002",
        },
        classroom: {
          roomName: "1",
          gradeLevel: { name: "ม.3" },
        },
      },
    },
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
        student: {
          id: 102,
          firstName: "ชาญชัย",
          lastName: "มีสุข",
          studentCode: "50002",
        },
        classroom: {
          roomName: "1",
          gradeLevel: { name: "ม.3" },
        },
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
        student: {
          id: 104,
          firstName: "กนกวรรณ",
          lastName: "ทองดี",
          studentCode: "aa692004",
        },
        classroom: {
          roomName: "1",
          gradeLevel: { name: "ม.3" },
        },
      },
    },
  ];

  await page.route(/\/api\/cases/, async (route) => {
    const url = route.request().url();
    const caseDetailMatch = url.match(/\/api\/cases\/(\d+)(?:\?|$)/);
    if (caseDetailMatch && route.request().method() === "GET") {
      const requestedId = parseInt(caseDetailMatch[1], 10);
      const matchedCase = casesData.find((c) => c.id === requestedId) || casesData[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...matchedCase,
          interventions: interventionsList,
          assistances: interventionsList,
        }),
      });
    }

    if (caseDetailMatch && (route.request().method() === "PATCH" || route.request().method() === "PUT")) {
      let patchData: any = {};
      try { patchData = route.request().postDataJSON(); } catch { patchData = {}; }
      const requestedId = parseInt(caseDetailMatch[1], 10);
      const matchedCase = casesData.find((c) => c.id === requestedId) || casesData[0];
      Object.assign(matchedCase, patchData, { updatedAt: new Date().toISOString() });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(matchedCase),
      });
    }

    if (route.request().method() === "POST") {
      let postData: { title?: string; description?: string; severity?: string; problemTypes?: string[]; studentId?: number } = {};
      try {
        postData = route.request().postDataJSON();
      } catch {
        postData = {};
      }
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
          student: {
            id: postData.studentId || 101,
            firstName: "กิตติพงษ์",
            lastName: "สุขเกษม",
            studentCode: "50001",
          },
          classroom: {
            roomName: "1",
            gradeLevel: { name: "ม.3" },
          },
        },
      };
      casesData.unshift(newCase);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newCase),
      });
    }

    const parsedUrl = new URL(url, "http://localhost:3000");
    const severityParam = (parsedUrl.searchParams.get("severity") || "").toLowerCase();
    const statusParam = (parsedUrl.searchParams.get("status") || "").toLowerCase();
    const searchParam = (parsedUrl.searchParams.get("search") || "").trim().toLowerCase();

    let filteredCases = casesData;
    if (severityParam) {
      filteredCases = filteredCases.filter((c) => (c.severity || "").toLowerCase() === severityParam);
    }
    if (statusParam) {
      filteredCases = filteredCases.filter((c) => (c.status || "").toLowerCase() === statusParam);
    }
    if (searchParam) {
      filteredCases = filteredCases.filter((c) =>
        (c.title || "").toLowerCase().includes(searchParam) ||
        (c.enrollment?.student?.firstName || "").toLowerCase().includes(searchParam) ||
        (c.enrollment?.student?.lastName || "").toLowerCase().includes(searchParam) ||
        (c.enrollment?.student?.studentCode || "").toLowerCase().includes(searchParam)
      );
    }

    if (url.includes("page=")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: filteredCases,
          meta: {
            total: filteredCases.length,
            page: 1,
            limit: 25,
            totalPages: 1,
            lastPage: 1,
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(filteredCases),
    });
  });

  // 9.25 Referrals query mock
  await page.route(/\/api\/referrals/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // 9.3 Notifications & auxiliary mocks
  await page.route(/\/api\/notifications/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // 9.35 Schools mock (both list, monitoring, and single detail)
  const mockSchoolsList = [
    {
      id: 1,
      name: "โรงเรียนตัวอย่างทดสอบ",
      code: "SCHOOL-A",
      shortCode: "SCH001",
      provinceId: 1,
      schoolGroupId: 1,
      isActive: true,
      status: "ACTIVE",
      readiness: "READY",
      studentCount: 820,
      adminCount: 2,
    },
    {
      id: 2,
      name: "โรงเรียนชลบุรีวิทยา",
      code: "SCHOOL-B",
      shortCode: "CBI001",
      provinceId: 2,
      schoolGroupId: 3,
      isActive: true,
      status: "ACTIVE",
      readiness: "READY",
      studentCount: 450,
      adminCount: 1,
    },
  ];

  await page.route(/\/api\/schools/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (url.includes("/monitoring")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSchoolsList),
      });
    }

    const matchDetail = url.match(/\/api\/schools\/(\d+)/);
    if (matchDetail) {
      const sId = Number(matchDetail[1]);
      const found = mockSchoolsList.find((s) => s.id === sId) || mockSchoolsList[0];
      if (method === "PUT" || method === "PATCH") {
        let patchData: Record<string, unknown> = {};
        try { patchData = route.request().postDataJSON() || {}; } catch {}
        if (patchData.name) found.name = patchData.name as string;
        if (patchData.code) found.code = patchData.code as string;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, school: found }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(found),
      });
    }

    if (method === "POST") {
      let postData: Record<string, unknown> = {};
      try { postData = route.request().postDataJSON() || {}; } catch {}
      const code = (postData.code as string) || "";
      if (code === "SCHOOL-A" || mockSchoolsList.some((s) => s.code === code)) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "รหัสโรงเรียนซ้ำในระบบ" }),
        });
      }
      const newSchool = {
        id: mockSchoolsList.length + 1,
        name: (postData.name as string) || "โรงเรียนทดสอบ ซี",
        code: code || "SCHOOL-C",
        shortCode: (postData.shortCode as string) || (postData.codePrefix as string) || "SCH003",
        provinceId: postData.provinceId ? Number(postData.provinceId) : 2,
        schoolGroupId: postData.schoolGroupId ? Number(postData.schoolGroupId) : 3,
        isActive: true,
        status: "ACTIVE",
        readiness: "READY",
        studentCount: 120,
        adminCount: 1,
      };
      mockSchoolsList.push(newSchool);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newSchool),
      });
    }

    // GET list with search & filters
    const urlObj = new URL(url, "http://localhost:3001");
    const search = (urlObj.searchParams.get("search") || "").trim().toLowerCase();
    const provinceId = urlObj.searchParams.get("provinceId");
    const status = urlObj.searchParams.get("status");

    let filtered = [...mockSchoolsList];
    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.code.toLowerCase().includes(search) ||
          (s.shortCode && s.shortCode.toLowerCase().includes(search)),
      );
    }
    if (provinceId) {
      filtered = filtered.filter((s) => s.provinceId === Number(provinceId));
    }
    if (status) {
      filtered = filtered.filter((s) => s.status === status || (status === "ACTIVE" && s.isActive));
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(filtered),
    });
  });

  // 9.36 Provinces & School Groups
  const mockProvincesList = [
    { id: 1, name: "กรุงเทพมหานคร", code: "BKK", isActive: true, schools: [{ id: 1 }] },
    { id: 2, name: "ชลบุรี", code: "CBI", isActive: true, schools: [{ id: 2 }] },
    { id: 3, name: "ระยอง", code: "RYG", isActive: true, schools: [] },
    { id: 4, name: "จันทบุรี", code: "CTI", isActive: true, schools: [] },
  ];

  await page.route(/\/api\/provinces/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const matchDetail = url.match(/\/api\/provinces\/(\d+)/);

    if (matchDetail && (method === "PUT" || method === "PATCH")) {
      const pId = Number(matchDetail[1]);
      const targetProv = mockProvincesList.find((p) => p.id === pId);
      let patchData: Record<string, unknown> = {};
      try { patchData = route.request().postDataJSON() || {}; } catch {}

      if (targetProv) {
        // If deactivating and province still has active schools
        if (patchData.isActive === false && targetProv.schools && targetProv.schools.length > 0) {
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: "ปิดใช้งานไม่ได้ เพราะยังมีโรงเรียนที่เปิดใช้งานอยู่ 1 แห่ง — ปิดใช้งานโรงเรียนเหล่านั้นก่อน" }),
          });
        }
        if (patchData.isActive !== undefined) targetProv.isActive = Boolean(patchData.isActive);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, province: targetProv }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockProvincesList),
    });
  });

  const mockSchoolGroupsList = [
    { id: 1, name: "สพป. กรุงเทพมหานคร เขต 1", provinceId: 1, isActive: true },
    { id: 2, name: "สพม. กรุงเทพมหานคร เขต 2", provinceId: 1, isActive: true },
    { id: 3, name: "เขตบางแสน", provinceId: 2, isActive: true },
    { id: 4, name: "สพป. ชลบุรี เขต 1", provinceId: 2, isActive: true },
  ];

  await page.route(/\/api\/school-groups/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === "POST") {
      let postData: Record<string, unknown> = {};
      try { postData = route.request().postDataJSON() || {}; } catch {}
      const name = (postData.name as string) || "";
      const provinceId = postData.provinceId ? Number(postData.provinceId) : 2;

      // Duplicate check: เขตบางแสน in province 2
      if (mockSchoolGroupsList.some((g) => g.name === name && g.provinceId === provinceId)) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "ชื่อกลุ่มโรงเรียนซ้ำภายในจังหวัดเดียวกัน" }),
        });
      }
      const newGroup = {
        id: mockSchoolGroupsList.length + 1,
        name,
        provinceId,
        isActive: true,
      };
      mockSchoolGroupsList.push(newGroup);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newGroup),
      });
    }

    const urlObj = new URL(url, "http://localhost:3001");
    const provinceIdParam = urlObj.searchParams.get("provinceId");
    let groups = [...mockSchoolGroupsList];
    if (provinceIdParam) {
      groups = groups.filter((g) => g.provinceId === Number(provinceIdParam));
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(groups),
    });
  });

  // 9.37 Province Dashboard Stats
  await page.route(/\/api\/dashboard\/province/, async (route) => {
    const url = new URL(route.request().url(), "http://localhost:3001");
    const search = (url.searchParams.get("search") || "").trim();
    const status = url.searchParams.get("status");

    // Dynamic mock responding to search & filters differently!
    const isRayong = search.includes("ระยอง");
    const isSuspended = status === "suspended" || status === "inactive";

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provinceName: isRayong ? "ระยอง" : "ชลบุรี",
        zoneName: isRayong ? "สพป. ระยอง เขต 1" : "สพป. ชลบุรี เขต 1",
        totalSchools: isRayong ? 8 : (isSuspended ? 2 : 16),
        totalStudents: isRayong ? 940 : (isSuspended ? 120 : 2150),
        totalCases: isRayong ? 14 : (isSuspended ? 3 : 38),
        zoneMapMinStudents: 5,
        casesBySeverity: {
          low: isRayong ? 6 : (isSuspended ? 1 : 18),
          medium: isRayong ? 5 : (isSuspended ? 1 : 12),
          high: isRayong ? 3 : (isSuspended ? 1 : 8),
          unassessed: 0,
        },
        schoolOptions: isRayong
          ? [{ schoolId: 5, schoolName: "โรงเรียนระยองวิทยาคม" }]
          : [
              { schoolId: 1, schoolName: "โรงเรียนตัวอย่างทดสอบ" },
              { schoolId: 2, schoolName: "โรงเรียนชลบุรีวิทยา" },
            ],
        schoolComparison: isRayong
          ? [
              {
                schoolId: 5,
                schoolName: "โรงเรียนระยองวิทยาคม",
                district: "เมืองระยอง",
                totalStudents: 940,
                caseCount: 14,
                averageAbsentRate: 3.8,
              },
            ]
          : [
              {
                schoolId: 2,
                schoolName: "โรงเรียนชลบุรีวิทยา",
                district: "เมืองชลบุรี",
                totalStudents: 1200,
                caseCount: 22,
                averageAbsentRate: 4.5,
              },
              {
                schoolId: 1,
                schoolName: "โรงเรียนตัวอย่างทดสอบ",
                district: "บางแสน",
                totalStudents: 950,
                caseCount: 16,
                averageAbsentRate: 3.9,
              },
            ],
        zoneMap: [
          {
            townId: 1,
            district: isRayong ? "เมืองระยอง" : "เมืองชลบุรี",
            subdistrict: isRayong ? "ท่าประดู่" : "แสนสุข",
            studentCount: isRayong ? 940 : 2150,
            caseCount: isRayong ? 14 : 38,
          },
        ],
      }),
    });
  });

  // 9.38 User Management & Access Change Requests
  const mockUsersList = [
    {
      id: 1,
      name: "สมชาย ผู้ดูแลระบบ (Admin)",
      username: "admin_school1",
      role: { name: "SCHOOL_ADMIN" },
      email: "admin1@example.com",
      phone: "0812345678",
      isActive: true,
      mustSetPassword: false,
      isPasswordExpired: false,
      provinceId: 1,
      schoolId: 1,
    },
    {
      id: 2,
      name: "สมหญิง ครูประจำชั้น (Teacher)",
      username: "teacher_a",
      role: { name: "TEACHER" },
      email: "teacher_a@example.com",
      phone: "0823456789",
      isActive: true,
      mustSetPassword: true,
      isPasswordExpired: false,
      provinceId: 1,
      schoolId: 1,
    },
    {
      id: 3,
      name: "อำนวย ผู้บริหาร (Director)",
      username: "director_demo",
      role: { name: "SCHOOL_DIRECTOR" },
      email: "director@example.com",
      phone: "0834567890",
      isActive: true,
      mustSetPassword: false,
      isPasswordExpired: false,
      provinceId: 1,
      schoolId: 1,
    },
    {
      id: 4,
      name: "ระงับ บัญชีชั่วคราว (Suspended)",
      username: "user_suspended",
      role: { name: "TEACHER" },
      email: "suspended@example.com",
      phone: "0845678901",
      isActive: false,
      mustSetPassword: false,
      isPasswordExpired: false,
      provinceId: 1,
      schoolId: 1,
    },
    {
      id: 5,
      name: "ครูหวัง คาดหวัง",
      username: "wang_kadwang",
      role: { name: "TEACHER" },
      email: "wang@sts.ac.th",
      phone: "0855555555",
      isActive: true,
      mustSetPassword: false,
      isPasswordExpired: false,
      provinceId: 2,
      schoolId: 2,
    },
    {
      id: 6,
      name: "ครูสมหวัง ใจดี",
      username: "somwang_jd",
      role: { name: "TEACHER" },
      email: "somwang_jd@sts.ac.th",
      phone: "0866666666",
      isActive: true,
      mustSetPassword: false,
      isPasswordExpired: false,
      provinceId: 2,
      schoolId: 2,
    },
    {
      id: 7,
      name: "ครูอำนาจ แสงทอง",
      username: "amnat_st",
      role: { name: "TEACHER" },
      email: "amnat@sts.ac.th",
      phone: "0877777777",
      isActive: true,
      mustSetPassword: false,
      isPasswordExpired: false,
      provinceId: 2,
      schoolId: 2,
    },
  ];

  await page.route(/\/api\/users\/access-change-requests/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route(/\/api\/users/, async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    // Check access-change-requests
    if (url.includes("access-change-requests")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    // Check reset password
    if (url.includes("/reset-password")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          temporaryPassword: "NewTempPassword123!",
          expiresAt: "2026-10-05T00:00:00Z",
        }),
      });
    }

    // Check suspend or toggle-active
    if (url.includes("/suspend") || url.includes("/toggle-active")) {
      const match = url.match(/\/api\/users\/(\d+)\/(?:suspend|toggle-active)/);
      let targetUser: any = null;
      if (match) {
        const uId = Number(match[1]);
        const target = mockUsersList.find((u) => u.id === uId);
        if (target) {
          target.isActive = false;
          targetUser = target;
        }
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(targetUser ? { ...targetUser, isActive: false, message: "ระงับการใช้งานสำเร็จแล้ว" } : { success: true, isActive: false, message: "ระงับการใช้งานสำเร็จแล้ว" }),
      });
    }

    // POST create user
    if (method === "POST") {
      let postData: Record<string, unknown> = {};
      try {
        postData = (route.request().postDataJSON() as Record<string, unknown>) || {};
      } catch {
        postData = {};
      }

      // Thai username check
      if (postData.username && /[\u0E00-\u0E7F]/.test(String(postData.username))) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "ไม่อนุญาตให้กรอกชื่อผู้ใช้เป็นภาษาไทย" }),
        });
      }

      // Empty submission check
      if (!postData.username && !postData.full_name && !postData.name) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" }),
        });
      }

      const roleStr = String(postData.role || "").toLowerCase();
      const roleName = roleStr.includes("admin") ? "SCHOOL_ADMIN" : "TEACHER";

      const newUser = {
        id: mockUsersList.length + 1,
        name: (postData.full_name as string) || (postData.name as string) || "ผู้ใช้งานใหม่",
        username: (postData.username as string) || `user_${Date.now()}`,
        role: { name: roleName },
        email: (postData.email as string) || "newuser@example.com",
        phone: (postData.phone as string) || "0899999999",
        isActive: true,
        mustSetPassword: true,
        isPasswordExpired: false,
        provinceId: postData.provinceId ? Number(postData.provinceId) : 1,
        schoolId: postData.schoolId ? Number(postData.schoolId) : 1,
      };
      mockUsersList.unshift(newUser);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newUser),
      });
    }

    // PATCH update user
    if (method === "PATCH" || method === "PUT") {
      let patchData: Record<string, unknown> = {};
      try {
        patchData = (route.request().postDataJSON() as Record<string, unknown>) || {};
      } catch {
        patchData = {};
      }
      const match = url.match(/\/api\/users\/(\d+)/);
      if (match) {
        const uId = Number(match[1]);
        const target = mockUsersList.find((u) => u.id === uId);
        if (target) {
          if (patchData.full_name) target.name = patchData.full_name as string;
          if (patchData.name) target.name = patchData.name as string;
          if (patchData.email) target.email = patchData.email as string;
          if (patchData.phone) target.phone = patchData.phone as string;
          if (patchData.isActive !== undefined) target.isActive = Boolean(patchData.isActive);
        }
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "บันทึกข้อมูลสำเร็จแล้ว" }),
      });
    }

    // DELETE delete user
    if (method === "DELETE") {
      const match = url.match(/\/api\/users\/(\d+)/);
      if (match) {
        const uId = Number(match[1]);
        const idx = mockUsersList.findIndex((u) => u.id === uId);
        if (idx !== -1) {
          mockUsersList.splice(idx, 1);
        }
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "ลบผู้ใช้งานสำเร็จแล้ว" }),
      });
    }

    // GET list of users with filtering
    const urlObj = new URL(url, "http://localhost:3001");
    const search = (urlObj.searchParams.get("search") || "").trim().toLowerCase();
    const isActiveParam = urlObj.searchParams.get("isActive");
    const roleName = urlObj.searchParams.get("roleName");

    let filtered = [...mockUsersList];

    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.username.toLowerCase().includes(search),
      );
    }

    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== "") {
      const boolVal = isActiveParam === "true";
      filtered = filtered.filter((u) => u.isActive === boolVal);
    }

    if (roleName) {
      filtered = filtered.filter(
        (u) =>
          (typeof u.role === "object" ? u.role.name : u.role) === roleName,
      );
    }

    const activeCount = mockUsersList.filter((u) => u.isActive).length;
    const suspendedCount = mockUsersList.filter((u) => !u.isActive).length;

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: filtered,
        meta: {
          total: filtered.length,
          page: 1,
          limit: 10,
          lastPage: 1,
          statusCounts: {
            active: activeCount,
            suspended: suspendedCount,
          },
        },
      }),
    });
  });

  // 9.39 Reports APIs (Academic years, Export, and Preview)
  await page.route(/\/api\/reports/, async (route) => {
    const url = route.request().url();

    // 1. Academic years catalog
    if (url.includes("/academic-years")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            year: "2569",
            isCurrent: true,
            termDates: [
              { termNo: 1, startDate: "2026-05-16", endDate: "2026-10-15" },
              { termNo: 2, startDate: "2026-11-01", endDate: "2027-03-31" },
            ],
          },
        ]),
      });
    }

    // 2. Export reports (PDF / Excel)
    if (url.includes("/export")) {
      if (url.includes("format=pdf")) {
        return route.fulfill({
          status: 200,
          contentType: "application/pdf",
          headers: {
            "Content-Disposition": 'attachment; filename="report.pdf"',
          },
          body: Buffer.from("%PDF-1.4 Mock PDF Content"),
        });
      }

      return route.fulfill({
        status: 200,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: {
          "Content-Disposition": 'attachment; filename="report.xlsx"',
        },
        body: Buffer.from("PK\x03\x04Mock XLSX Content"),
      });
    }

    // 3. Preview report
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: 1,
            caseNumber: "CASE-2026-001",
            studentName: "กิตติพงษ์ สุขเกษม",
            classroom: "ม.3/1",
            severity: "HIGH",
            status: "OPEN",
            recordedDate: "2026-09-20",
          },
          {
            id: 2,
            caseNumber: "CASE-2026-002",
            studentName: "ชาญชัย มีสุข",
            classroom: "ม.3/1",
            severity: "MEDIUM",
            status: "INVESTIGATING",
            recordedDate: "2026-09-22",
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          total: 2,
          totalPages: 1,
        },
        summary: {
          totalCases: 2,
          highRiskCases: 1,
          mediumRiskCases: 1,
        },
        generatedAt: "2026-09-28T10:00:00.000Z",
      }),
    });
  });

  await page.route(/\/api\/auth\/me/, async (route) => {
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
        id: 99,
        username: "platform_admin",
        name: "ผู้ดูแลระบบกลาง",
        role: "PLATFORM_ADMIN",
        avatarUrl: null,
      }),
    });
  });

  // 9.40 AI Benchmark & Experiments mock
  await page.route(/\/api\/ai-case-assessments\/experiments\/([^/]+)\/run/, async (route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/ai-case-assessments\/experiments\/([^/]+)\/run/);
    const runId = match ? match[1] : "run-zero-shot-001";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        runId,
        mode: "ZERO_SHOT",
        status: "COMPLETED",
        totalTargets: 50,
        processedCount: 50,
        skippedCount: 0,
        failedCount: 0,
        metrics: {
          macroF1: 0.88,
          accuracy: 0.92,
          severityMatchRate: 0.89,
        },
      }),
    });
  });

  // 10. Student list & detail mock with stateful CRUD and search filtering
  const mockStudentsList: Array<any> = [
    {
      id: 101,
      studentCode: "50001",
      firstName: "กิตติพงษ์",
      lastName: "สุขเกษม",
      first_name: "กิตติพงษ์",
      last_name: "สุขเกษม",
      student_id: "50001",
      personId: "3101101123451",
      person_id: "3101101123451",
      parent_name: "สมศรี สุขเกษม",
      parent_phone: "0812345678",
      currentAddress: "123 กรุงเทพมหานคร",
      address: "123 กรุงเทพมหานคร",
      gender: { name: "ชาย" },
      birthDate: "2011-06-15",
      absentCountThisSemester: 0,
      absent_count_this_semester: 0,
      risk_level: "low",
      enrollments: [
        {
          id: 1,
          isCurrent: true,
          classroom: {
            id: 1,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 3", code: "M3" },
          },
        },
      ],
    },
    {
      id: 102,
      studentCode: "50002",
      firstName: "ชาญชัย",
      lastName: "มีสุข",
      first_name: "ชาญชัย",
      last_name: "มีสุข",
      student_id: "50002",
      gender: { name: "ชาย" },
      birthDate: "2011-07-20",
      absentCountThisSemester: 4,
      absent_count_this_semester: 4,
      risk_level: "high",
      enrollments: [
        {
          id: 2,
          isCurrent: true,
          classroom: {
            id: 1,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 3", code: "M3" },
          },
        },
      ],
    },
    {
      id: 103,
      studentCode: "50003",
      firstName: "วิภาดา",
      lastName: "แสงจันทร์",
      first_name: "วิภาดา",
      last_name: "แสงจันทร์",
      student_id: "50003",
      gender: { name: "หญิง" },
      absentCountThisSemester: 2,
      absent_count_this_semester: 2,
      risk_level: "medium",
      enrollments: [
        {
          id: 3,
          isCurrent: true,
          classroom: {
            id: 1,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 3", code: "M3" },
          },
        },
      ],
    },
    {
      id: 104,
      studentCode: "aa692004",
      firstName: "กนกวรรณ",
      lastName: "ทองดี",
      first_name: "กนกวรรณ",
      last_name: "ทองดี",
      student_id: "aa692004",
      parent_name: "บุหลัน ทองดี",
      parent_phone: "0988888888",
      personId: "3101101123450",
      person_id: "3101101123450",
      passportId: "AC5432109",
      passport_id: "AC5432109",
      currentAddress: "ตำบลแสนสุข",
      address: "ตำบลแสนสุข",
      gender: { name: "หญิง" },
      absentCountThisSemester: 3,
      absent_count_this_semester: 3,
      risk_level: "high",
      enrollments: [
        {
          id: 4,
          isCurrent: true,
          classroom: {
            id: 1,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 3", code: "M3" },
          },
        },
      ],
    },
    {
      id: 105,
      studentCode: "aa692003",
      firstName: "กมล",
      lastName: "ทองประเสริฐ",
      first_name: "กมล",
      last_name: "ทองประเสริฐ",
      student_id: "aa692003",
      gender: { name: "ชาย" },
      absentCountThisSemester: 1,
      absent_count_this_semester: 1,
      risk_level: "medium",
      enrollments: [
        {
          id: 5,
          isCurrent: true,
          classroom: {
            id: 1,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 3", code: "M3" },
          },
        },
      ],
    },
    {
      id: 108,
      studentCode: "aa691502",
      firstName: "ศศิธร",
      lastName: "บุญศรี",
      first_name: "ศศิธร",
      last_name: "บุญศรี",
      student_id: "aa691502",
      gender: { name: "หญิง" },
      absentCountThisSemester: 0,
      absent_count_this_semester: 0,
      risk_level: "low",
      enrollments: [
        {
          id: 6,
          isCurrent: true,
          classroom: {
            id: 3,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 1", code: "M1" },
          },
        },
      ],
    },
    {
      id: 109,
      studentCode: "aa691503",
      firstName: "กมล",
      lastName: "ชัยชนะ",
      first_name: "กมล",
      last_name: "ชัยชนะ",
      student_id: "aa691503",
      gender: { name: "ชาย" },
      absentCountThisSemester: 0,
      absent_count_this_semester: 0,
      risk_level: "low",
      enrollments: [
        {
          id: 7,
          isCurrent: true,
          classroom: {
            id: 3,
            roomName: "1",
            gradeLevel: { name: "มัธยมศึกษาปีที่ 1", code: "M1" },
          },
        },
      ],
    },
  ];

  await page.route(/\/api\/enrollments(?:\/.*)?/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route(/\/api\/students(?:\/.*)?/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Check detail / delete / update by ID
    const matchId = url.match(/\/api\/students\/([0-9a-zA-Z_-]+)(?:\?|$)/);
    if (matchId && matchId[1] !== "import" && matchId[1] !== "template") {
      const sId = matchId[1];
      const targetIdx = mockStudentsList.findIndex((s) => String(s.id) === String(sId) || s.studentCode === sId);

      if (method === "DELETE") {
        if (targetIdx !== -1) {
          mockStudentsList.splice(targetIdx, 1);
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }

      if (method === "PATCH") {
        let patchData: any = {};
        try { patchData = route.request().postDataJSON(); } catch { patchData = {}; }
        if (targetIdx !== -1) {
          const s = mockStudentsList[targetIdx];
          if (patchData.firstName) { s.firstName = patchData.firstName; s.first_name = patchData.firstName; }
          if (patchData.lastName) { s.lastName = patchData.lastName; s.last_name = patchData.lastName; }
          if (patchData.parent_name) s.parent_name = patchData.parent_name;
          if (patchData.parent_phone) s.parent_phone = patchData.parent_phone;
          if (patchData.personId) { s.personId = patchData.personId; s.person_id = patchData.personId; }
          if (patchData.passportId) { s.passportId = patchData.passportId; s.passport_id = patchData.passportId; }
          if (patchData.currentAddress) { s.currentAddress = patchData.currentAddress; s.address = patchData.currentAddress; }
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(s) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }

      if (method === "GET") {
        const found = targetIdx !== -1 ? mockStudentsList[targetIdx] : mockStudentsList[0];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...found,
            attendance_stats: { present: 45, absent: 0, late: 1, leave: 0 },
            cases: [],
          }),
        });
      }
    }

    // POST create student
    if (method === "POST" && !url.includes("import")) {
      let postData: any = {};
      try { postData = route.request().postDataJSON(); } catch { postData = {}; }

      // Check duplicate studentCode
      if (postData.studentCode && mockStudentsList.some((s) => s.studentCode === postData.studentCode)) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "รหัสนักเรียนมีในระบบอยู่แล้ว" }),
        });
      }

      const newStudent = {
        id: mockStudentsList.length + 100,
        studentCode: postData.studentCode || `aa${Date.now()}`,
        firstName: postData.firstName || "นักเรียนใหม่",
        lastName: postData.lastName || "ทดสอบ",
        first_name: postData.firstName || "นักเรียนใหม่",
        last_name: postData.lastName || "ทดสอบ",
        student_id: postData.studentCode || `aa${Date.now()}`,
        gender: { name: postData.genderId === 2 ? "หญิง" : "ชาย" },
        birthDate: postData.birthDate || "2005-01-27",
        currentAddress: postData.currentAddress || "ตำบลแสนสุข",
        address: postData.currentAddress || "ตำบลแสนสุข",
        absentCountThisSemester: 0,
        absent_count_this_semester: 0,
        risk_level: "low",
        enrollments: [
          {
            id: 99,
            isCurrent: true,
            classroom: { id: 3, roomName: "1", gradeLevel: { name: "มัธยมศึกษาปีที่ 1", code: "M1" } },
          },
        ],
      };
      mockStudentsList.push(newStudent);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newStudent) });
    }

    // GET list with search & filter
    const urlObj = new URL(url, "http://localhost:3001");
    const search = (urlObj.searchParams.get("search") || "").trim().toLowerCase();

    let filtered = [...mockStudentsList];
    if (search) {
      filtered = filtered.filter((s) =>
        (s.studentCode && s.studentCode.toLowerCase().includes(search)) ||
        (s.firstName && s.firstName.toLowerCase().includes(search)) ||
        (s.lastName && s.lastName.toLowerCase().includes(search)) ||
        (`${s.firstName} ${s.lastName}`.toLowerCase().includes(search))
      );
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: filtered,
        items: filtered,
        meta: { total: filtered.length, page: 1, limit: 25, lastPage: 1 },
      }),
    });
  });

  // 11. Student Observations & Tracking mock
  const observationsList: Array<{ id: number; studentId: number; note: string; createdAt: string; recordedByUser?: { name: string } }> = [
    {
      id: 1,
      studentId: 104,
      note: "วันนี้นักเรียนดูเหนื่อยล้าและไม่ค่อยพูดคุยกับเพื่อน",
      createdAt: new Date().toISOString(),
      recordedByUser: { name: "ครูวิภาดา สอนดี" },
    },
  ];

  await page.route(/\/api\/observations/, async (route) => {
    const url = route.request().url();
    if (route.request().method() === "POST") {
      let data: any = {};
      try { data = route.request().postDataJSON(); } catch { data = {}; }
      const newObs = {
        id: observationsList.length + 1,
        studentId: data.studentId || 104,
        note: data.note || data.text || "ข้อสังเกตพฤติกรรม",
        createdAt: new Date().toISOString(),
        recordedByUser: { name: "ครูวิภาดา สอนดี" },
      };
      observationsList.unshift(newObs);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newObs),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(observationsList),
    });
  });

  // 12. Case AI Insights & AI-DSS & case-analysis mocks
  await page.route(/\/api\/case-analysis\/cases\/(\d+)\/analyze/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "req-123",
        snapshotId: "snap-123",
        stage: "CASE_OVERVIEW",
        primary: {
          role: "PRIMARY",
          source: "AI_DSS",
          availability: "AVAILABLE",
          overview: {
            detectedLabels: ["behavioral_problem"],
            labelProbabilities: { behavioral_problem: 0.88 },
            modelVersion: "v1.2.0",
          },
          recommendedSeverity: "HIGH",
          assessmentId: 1,
          aiReasons: ["พบความผิดปกติด้านพฤติกรรมและความเหนื่อยล้าต่อเนื่อง"],
        },
        reference: {
          role: "REFERENCE",
          source: "AI_LAB",
          availability: "AVAILABLE",
          problemLabels: ["behavioral_problem"],
          recommendedSeverity: "HIGH",
          severityConfidence: 0.91,
          modelVersion: "v1.2.0",
        },
        comparison: {
          basis: "SEVERITY",
          status: "AGREE",
        },
      }),
    });
  });

  await page.route(/\/api\/case-analysis\/cases\/(\d+)\/reference/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        role: "REFERENCE",
        source: "AI_LAB",
        availability: "AVAILABLE",
        problemLabels: ["behavioral_problem"],
        recommendedSeverity: "HIGH",
        severityConfidence: 0.91,
        modelVersion: "v1.2.0",
      }),
    });
  });
  // Mock ai-case-assessments for Director AI Analysis
  await page.route(/\/api\/ai-case-assessments(?:\/cases\/(\d+)\/analyze|\/([a-zA-Z0-9_-]+))?/, async (route) => {
    const url = route.request().url();
    if (url.includes("/experiments/")) {
      return route.fallback();
    }
    const sampleAssessment = {
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
    };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sampleAssessment),
    });
  });
  await page.route(/\/api\/ai-dss\/cases\/(\d+)\/overview/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        overviewId: 1,
        caseId: 201,
        observationId: 1,
        detectedLabels: ["behavioral_problem"],
        labelProbabilities: { behavioral_problem: 0.88 },
        modelVersion: "v1.2.0",
        analyzedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route(/\/api\/ai-dss\/cases\/(\d+)\/severity\/latest/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
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

  // 13. Assistance / Interventions mock for Director UAT
  const interventionsList: Array<{ id: number; caseId: number; type: string; details: string; result: string; date: string; createdAt: string }> = [
    {
      id: 1,
      caseId: 201,
      type: "ให้คำปรึกษา",
      details: "พูดคุยให้กำลังใจนักเรียน",
      result: "นักเรียนรับทราบและให้ความร่วมมือ",
      date: "2026-09-26",
      createdAt: new Date().toISOString(),
    },
  ];

  await page.route(/\/api\/interventions|\/api\/cases\/(\d+)\/interventions|\/api\/cases\/(\d+)\/assistance|\/api\/cases\/(\d+)\/assistances|\/api\/assistances/, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let data: any = {};
      try { data = route.request().postDataJSON(); } catch { data = {}; }
      const newIntervention = {
        id: interventionsList.length + 1,
        caseId: data.caseId || 201,
        type: data.type || "ให้คำปรึกษา",
        details: data.details || data.description || "พูดคุยให้กำลังใจนักเรียน",
        result: data.result || "นักเรียนรับทราบและให้ความร่วมมือ",
        date: data.date || new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      };
      interventionsList.unshift(newIntervention);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newIntervention),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(interventionsList),
    });
  });

  // 14. Referrals, External Referrals & Transfer Letters mock for Director UAT
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

  await page.route(/\/api\/cases\/(\d+)\/external-referrals|\/api\/external-referrals/, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let data: any = {};
      try { data = route.request().postDataJSON(); } catch { data = {}; }
      const newRef = {
        id: "ref-" + Date.now(),
        documentNo: "REF-2569-" + Math.floor(1000 + Math.random() * 9000),
        caseId: parseInt(route.request().url().match(/\/api\/cases\/(\d+)/)?.[1] || "101", 10),
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

  const referralLettersList: Array<{ id: number; caseId: number; agencyType: string; agencyName: string; reason: string; assistanceNeeded: string; createdAt: string }> = [];

  await page.route(/\/api\/referral-letters|\/api\/cases\/(\d+)\/referral-letters|\/api\/transfer-letters/, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      let data: any = {};
      try { data = route.request().postDataJSON(); } catch { data = {}; }
      const newLetter = {
        id: referralLettersList.length + 1,
        caseId: data.caseId || 201,
        agencyType: data.agencyType || "HEALTH",
        agencyName: data.agencyName || "โรงพยาบาลชลบุรี",
        reason: data.reason || "นักเรียนมีภาวะซึมเศร้าจำเป็นต้องได้รับการประเมินจากแพทย์",
        assistanceNeeded: data.assistanceNeeded || "ขอรับการประเมินและวางแผนการรักษา",
        createdAt: new Date().toISOString(),
      };
      referralLettersList.unshift(newLetter);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newLetter),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(referralLettersList),
    });
  });

  // 15. Active import jobs check (ป้องกันการค้างที่สถานะกำลังประมวลผล)
  await page.route("**/api/students/import/jobs/active*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ activeJobs: [], hasActiveJob: false }),
    });
  });

  // 16. Student Bulk Import POST upload/submission & template
  await page.route(/\/api\/students\/import\/upload/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "imp-job-mock-001",
        status: "COMPLETED",
        totalRows: 40,
        processedRows: 40,
        successCount: 40,
        failedCount: 0,
        problemRowCount: 0,
        fileName: "student_mock.xlsx",
      }),
    });
  });

  await page.route(/\/api\/students\/import\/jobs\/([0-9a-zA-Z_-]+)/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "imp-job-mock-001",
        status: "COMPLETED",
        totalRows: 40,
        processedRows: 40,
        successCount: 40,
        failedCount: 0,
        problemRowCount: 0,
        fileName: "student_mock.xlsx",
        createdAt: new Date().toISOString(),
      }),
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

  // 17. Student Bulk Import History for School Admin UAT (จำลองประวัติการนำเข้าไฟล์ข้อมูลนักเรียน)
  await page.route(/\/api\/students\/import\/history|\/api\/students\/import-history/, async (route) => {
    const historyData = [
      {
        id: "imp-2569-001",
        jobId: "imp-2569-001",
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
        jobId: "imp-2569-002",
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

  await page.route(/\/api\/students\/import\/template|\/api\/students\/template/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "text/csv",
      headers: { "Content-Disposition": 'attachment; filename="student_template.csv"' },
      body: "studentCode,firstName,lastName,gender,birthDate,classroom\naa111111,มนต์แคน,แก่นคูน,ชาย,2005-01-27,ม.1/1\n",
    });
  });

  // 16. Director Approval & Decision mock
  await page.route(/\/api\/cases\/(\d+)\/decision|\/api\/cases\/(\d+)\/director-approval/, async (route) => {
    let data: any = {};
    try { data = route.request().postDataJSON(); } catch { data = {}; }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        caseId: 201,
        finalSeverity: data.finalSeverity || "MEDIUM",
        reason: data.reason || "จากการตรวจสอบพบว่าผู้ปกครองให้ความร่วมมือดี ปรับเป็นระดับปานกลางเพื่อเฝ้าระวังต่อเนื่อง",
        status: "APPROVED",
        updatedAt: new Date().toISOString(),
      }),
    });
  });
}
