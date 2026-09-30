import { describe, it, expect } from "vitest";
import {
  getAllFunctionTemplates,
  getFunctionTemplate,
  STS_FUNCTION_TEMPLATES,
} from "@/lib/playwright-runner/function-templates";

describe("STS Function Playwright Templates", () => {
  it("provides templates for all 11 STS functions (FN-STS-01 to FN-STS-11)", () => {
    const templates = getAllFunctionTemplates();
    expect(templates.length).toBe(11);

    const expectedIds = [
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
      expect(STS_FUNCTION_TEMPLATES[id]).toBeDefined();
      expect(STS_FUNCTION_TEMPLATES[id].id).toBe(id);
      expect(STS_FUNCTION_TEMPLATES[id].code).toContain('import { test, expect } from "@playwright/test";');
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

  it("returns undefined for unknown or empty input", () => {
    expect(getFunctionTemplate("")).toBeUndefined();
    expect(getFunctionTemplate("unknown-function-xyz")).toBeUndefined();
  });
});
