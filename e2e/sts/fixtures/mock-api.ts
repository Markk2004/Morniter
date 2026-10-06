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
        year: 2569,
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
          year: 2569,
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

  // 4. Classrooms list for filters & lookups
  await page.route("**/api/classrooms*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          roomName: "1",
          grade: "ม.3",
          name: "ม.3/1",
          grade_level_id: 9,
          studentCount: 35,
          academic_year_id: 1,
        },
        {
          id: 2,
          roomName: "2",
          grade: "ม.3",
          name: "ม.3/2",
          grade_level_id: 9,
          studentCount: 32,
          academic_year_id: 1,
        },
      ]),
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
            actionCode: "CONSECUTIVE_ABSENCE",
            category: "STUDENT",
            severity: "CRITICAL",
            title: "นักเรียนขาดเรียนต่อเนื่อง",
            description: "มีนักเรียนขาดเรียนเกินเกณฑ์ 3 วัน",
            count: 2,
            occurredAt: "2026-09-28T08:00:00Z",
          },
        ],
        totalActionCount: 1,
        dataReadiness: {
          scorePercentage: 98,
          checks: [
            {
              key: "STUDENT_ENROLLMENT",
              label: "ข้อมูลนักเรียนในชั้นเรียน",
              status: "READY",
              message: "นักเรียนทุกคนมีชั้นเรียนสังกัด",
              affectedCount: 0,
              actionCode: null,
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

  // 9.35 Schools mock (both list and single detail)
  await page.route(/\/api\/schools/, async (route) => {
    const url = route.request().url();
    const matchDetail = url.match(/\/api\/schools\/(\d+)/);
    if (matchDetail) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, name: "โรงเรียนตัวอย่างทดสอบ", code: "SCH001", provinceId: 1, schoolGroupId: 1, isActive: true }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, name: "โรงเรียนตัวอย่างทดสอบ", code: "SCH001", provinceId: 1, schoolGroupId: 1, isActive: true },
      ]),
    });
  });

  // 9.36 Provinces & School Groups
  await page.route(/\/api\/provinces/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, name: "กรุงเทพมหานคร", code: "BKK", isActive: true, schools: [{ id: 1 }] },
        { id: 2, name: "ชลบุรี", code: "CBI", isActive: true, schools: [] },
      ]),
    });
  });

  await page.route(/\/api\/school-groups/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, name: "สพป. กรุงเทพมหานคร เขต 1", provinceId: 1, isActive: true },
        { id: 2, name: "สพม. กรุงเทพมหานคร เขต 2", provinceId: 1, isActive: true },
      ]),
    });
  });

  // 9.37 Province Dashboard Stats
  await page.route(/\/api\/dashboard\/province/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provinceName: "กรุงเทพมหานคร",
        zoneName: null,
        totalSchools: 12,
        totalStudents: 1540,
        totalCases: 28,
        zoneMapMinStudents: 5,
        casesBySeverity: {
          low: 10,
          medium: 12,
          high: 6,
          unassessed: 0,
        },
        schoolOptions: [
          { schoolId: 1, schoolName: "โรงเรียนตัวอย่างทดสอบ" },
          { schoolId: 2, schoolName: "โรงเรียนวิทยาการสาธิต" },
        ],
        schoolComparison: [
          {
            schoolId: 1,
            schoolName: "โรงเรียนตัวอย่างทดสอบ",
            district: "ปทุมวัน",
            totalStudents: 820,
            caseCount: 15,
            averageAbsentRate: 4.2,
          },
        ],
        zoneMap: [
          {
            townId: 1,
            district: "ปทุมวัน",
            subdistrict: "วังใหม่",
            studentCount: 820,
            caseCount: 15,
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
      mustSetPassword: false,
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

    // Check suspend
    if (url.includes("/suspend")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
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
      const newUser = {
        id: mockUsersList.length + 1,
        name: (postData.full_name as string) || (postData.name as string) || "ผู้ใช้งานใหม่",
        username: (postData.username as string) || `user_${Date.now()}`,
        role: { name: postData.role === "admin" ? "SCHOOL_ADMIN" : "TEACHER" },
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
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
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

  // 10. Student list & detail mock with regex to match paths across slashes
  await page.route(/\/api\/students/, async (route) => {
    const url = route.request().url();
    // Student detail check: /api/students/<id>
    const matchDetail = url.match(/\/api\/students\/([0-9a-zA-Z_-]+)(?:\?|$)/);
    if (matchDetail) {
      const studentId = matchDetail[1];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: studentId === "102" ? 102 : 101,
          studentCode: "50001",
          firstName: "กิตติพงษ์",
          lastName: "สุขเกษม",
          gender: { name: "ชาย" },
          birthDate: "2011-06-15",
          currentAddress: "123 กรุงเทพมหานคร",
          enrollments: [
            {
              id: 1,
              isCurrent: true,
              classroom: {
                id: 1,
                roomName: "1",
                gradeLevel: { name: "มัธยมศึกษาปีที่ 3" },
              },
            },
          ],
          absentCountThisSemester: 0,
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
          firstName: "กิตติพงษ์",
          lastName: "สุขเกษม",
          first_name: "กิตติพงษ์",
          last_name: "สุขเกษม",
          student_id: "50001",
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
                gradeLevel: { name: "มัธยมศึกษาปีที่ 3" },
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
                gradeLevel: { name: "มัธยมศึกษาปีที่ 3" },
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
                gradeLevel: { name: "มัธยมศึกษาปีที่ 3" },
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
                gradeLevel: { name: "มัธยมศึกษาปีที่ 3" },
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
                gradeLevel: { name: "มัธยมศึกษาปีที่ 3" },
              },
            },
          ],
        },
      ]),
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

  // 16. Student Bulk Import POST upload/submission
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

  await page.route(/\/api\/students\/template/, async (route) => {
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
