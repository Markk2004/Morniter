import { describe, it, expect } from "vitest";
import {
  getAllFunctionTemplates,
  getFunctionTemplate,
  STS_FUNCTION_TEMPLATES,
} from "@/lib/playwright-runner/function-templates";

describe("STS Function Playwright Templates", () => {
  it("provides templates for all STS functions (4 All-in-One + FN-STS-01 to FN-STS-11 = 15 total)", () => {
    const templates = getAllFunctionTemplates();
    expect(templates.length).toBe(15);

    const expectedIds = [
      // Sts all หมวดหมู่ (All-in-One UAT scripts)
      "FN-STS-00",
      "FN-STS-00-SCHOOL",
      "FN-STS-00-SCHOOL-ADMIN",
      "FN-STS-00-PLATFORM-ADMIN",
      // Individual function templates
      "FN-STS-01",
      "FN-STS-02",
      "FN-STS-03",
      "FN-STS-04",
      "FN-STS-05",
      "FN-STS-06",
      "FN-STS-07",
      "FN-STS-08",
      "FN-STS-09",
      "FN-STS-10",
      "FN-STS-11",
    ];

    for (const id of expectedIds) {
      expect(STS_FUNCTION_TEMPLATES[id], `Missing template: ${id}`).toBeDefined();
      expect(STS_FUNCTION_TEMPLATES[id].id).toBe(id);
      expect(STS_FUNCTION_TEMPLATES[id].relativePath).toBeTruthy();
      expect(STS_FUNCTION_TEMPLATES[id].description).toBeTruthy();
    }
  });

  it("resolves function templates by exact ID, prefix, and keywords", () => {
    // Exact ID
    const tpl02 = getFunctionTemplate("FN-STS-02");
    expect(tpl02?.id).toBe("FN-STS-02");
    expect(tpl02?.shortName).toBe("จัดการผู้ใช้");

    // Case-insensitive & prefix
    const tpl03 = getFunctionTemplate("fn-sts-03");
    expect(tpl03?.id).toBe("FN-STS-03");

    // Keyword matching
    const tplAttendance = getFunctionTemplate("attendance-check");
    expect(tplAttendance?.id).toBe("FN-STS-04");

    const tplReport = getFunctionTemplate("TC-STS-REP-001");
    expect(tplReport?.id).toBe("FN-STS-06");

    const tplAI = getFunctionTemplate("TC-STS-AI-001");
    expect(tplAI?.id).toBe("FN-STS-09");
  });

  it("resolves specific sub-part templates for authentication parts", () => {
    // Exact Sub-template IDs
    expect(getFunctionTemplate("FN-STS-01-ROLES")?.id).toBe("FN-STS-01-ROLES");
    expect(getFunctionTemplate("FN-STS-01-INVALID")?.id).toBe("FN-STS-01-INVALID");
    expect(getFunctionTemplate("FN-STS-01-EMPTY")?.id).toBe("FN-STS-01-EMPTY");

    const tplInvalid = getFunctionTemplate("TC-STS-AUTH-INVALID: Invalid credentials displays an error alert");
    expect(tplInvalid?.id).toBe("FN-STS-01-INVALID");
    expect(tplInvalid?.shortName).toBe("รหัสผ่านผิด");
    expect(tplInvalid?.code).toContain("TC-STS-AUTH-INVALID");

    const tplEmpty = getFunctionTemplate("TC-STS-AUTH-EMPTY: Empty username/password submission is rejected");
    expect(tplEmpty?.id).toBe("FN-STS-01-EMPTY");
    expect(tplEmpty?.shortName).toBe("เว้นว่างรหัสผ่าน");
    expect(tplEmpty?.code).toContain("TC-STS-AUTH-EMPTY");

    const tplRoles = getFunctionTemplate("TC-STS-AUTH-TEACHER: Login as teacher succeeds and redirects");
    expect(tplRoles?.id).toBe("FN-STS-01-ROLES");
    expect(tplRoles?.shortName).toBe("เข้าสู่ระบบสำเร็จ");
    expect(tplRoles?.code).toContain("TC-STS-AUTH-TEACHER");
    expect(tplRoles?.code).toContain("TC-STS-AUTH-DIRECTOR");
    expect(tplRoles?.code).toContain("TC-STS-AUTH-ADMIN");

    // All templates must have robust route mocks (auth/me, refresh, etc.)
    expect(tplRoles?.code).toContain("/api/auth/me");
    expect(tplRoles?.code).toContain("director/action-center");
    expect(tplRoles?.code).toContain("admin/operations");
  });

  it("ensures all 11 function templates contain essential Next.js route mocks", () => {
    for (const [id, tpl] of Object.entries(STS_FUNCTION_TEMPLATES)) {
      expect(tpl.code).toContain('import { test, expect } from "@playwright/test";');
      expect(tpl.code).toContain("page.route");
      // All function templates must mock auth session endpoints to prevent redirect bouncing
      expect(tpl.code).toContain("/api/auth/refresh");
      expect(tpl.code).toContain("/api/auth/me");
      expect(tpl.code).toContain("/api/academic-years");
      expect(tpl.code).toContain("/api/classrooms");
      expect(tpl.code).toContain("/api/provinces");
      expect(tpl.code).toContain("expect(page)");
    }
  });

  it("ensures all sub-templates have isolated and executable test structure", () => {
    const subIds = ["FN-STS-01-ROLES", "FN-STS-01-INVALID", "FN-STS-01-EMPTY"];
    for (const id of subIds) {
      const tpl = getFunctionTemplate(id);
      expect(tpl).toBeDefined();
      expect(tpl?.code).toContain('import { test, expect } from "@playwright/test";');
      expect(tpl?.code).toContain("test.describe");
      expect(tpl?.code).toContain("test(");
      expect(tpl?.code).toContain("expect(page)");
    }
  });

  it("returns undefined for unknown or empty input", () => {
    expect(getFunctionTemplate("")).toBeUndefined();
    expect(getFunctionTemplate("unknown-function-xyz")).toBeUndefined();
  });
});
