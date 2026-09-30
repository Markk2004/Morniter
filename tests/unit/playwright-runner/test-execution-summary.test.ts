import { describe, expect, it, vi } from "vitest";
import {
  parsePlaywrightTestCases,
  extractTestExecutionSummary,
  formatTerminalSummary,
} from "@/lib/playwright-runner/progress-parser";

describe("Test Execution Summary & Terminal Formatting", () => {
  it("parses test cases, status, durations, and errors from Playwright log output", () => {
    const sampleOutput = [
      "Running 3 tests using 1 worker",
      "  ok 1 [chromium] › e2e\\__workspace__\\plw-test.spec.ts:69:7 › FN-STS-01 (Part 1): Login as Role Suite › TC-STS-AUTH-TEACHER: Login as teacher succeeds and redirects (6.8s)",
      "  x  2 [chromium] › e2e\\__workspace__\\plw-test.spec.ts:89:7 › FN-STS-01 (Part 1): Login as Role Suite › TC-STS-AUTH-DIRECTOR: Login as director succeeds and redirects (18.6s)",
      "  x  3 [chromium] › e2e\\__workspace__\\plw-test.spec.ts:101:7 › FN-STS-01 (Part 1): Login as Role Suite › TC-STS-AUTH-ADMIN: Login as admin succeeds and redirects (18.8s)",
      "  1) [chromium] › e2e\\__workspace__\\plw-test.spec.ts:89:7 › FN-STS-01 (Part 1): Login as Role Suite › TC-STS-AUTH-DIRECTOR: Login as director succeeds and redirects",
      "    Error: expect(page).toHaveURL(expected) failed",
      "    Received string:  \"http://localhost:3001/login\"",
      "  2 failed",
      "  1 passed (47.7s)",
    ];

    const summary = parsePlaywrightTestCases(sampleOutput);

    expect(summary.uatId).toBe("FN-STS-01");
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(2);
    expect(summary.duration).toBe("47.7s");

    expect(summary.cases).toHaveLength(3);

    // Case 1: Teacher passed
    expect(summary.cases[0].id).toBe("TC-STS-AUTH-TEACHER");
    expect(summary.cases[0].status).toBe("passed");
    expect(summary.cases[0].duration).toBe("6.8s");

    // Case 2: Director failed with error
    expect(summary.cases[1].id).toBe("TC-STS-AUTH-DIRECTOR");
    expect(summary.cases[1].status).toBe("failed");
    expect(summary.cases[1].duration).toBe("18.6s");
    expect(summary.cases[1].error).toContain("Error: expect(page).toHaveURL(expected) failed");

    // Case 3: Admin failed
    expect(summary.cases[2].id).toBe("TC-STS-AUTH-ADMIN");
    expect(summary.cases[2].status).toBe("failed");
    expect(summary.cases[2].duration).toBe("18.8s");
  });

  it("formats terminal summary box with [PASS] and [FAIL] badges", () => {
    const summary = {
      uatId: "FN-STS-01",
      uatTitle: "FN-STS-01 (Part 1): Login as Role Suite",
      total: 3,
      passed: 1,
      failed: 2,
      duration: "47.7s",
      cases: [
        {
          id: "TC-STS-AUTH-TEACHER",
          title: "Login as teacher succeeds and redirects",
          status: "passed" as const,
          duration: "6.8s",
        },
        {
          id: "TC-STS-AUTH-DIRECTOR",
          title: "Login as director succeeds and redirects",
          status: "failed" as const,
          duration: "18.6s",
          error: "Error: expect(page).toHaveURL(expected) failed",
        },
        {
          id: "TC-STS-AUTH-ADMIN",
          title: "Login as admin succeeds and redirects",
          status: "failed" as const,
          duration: "18.8s",
        },
      ],
    };

    const lines = formatTerminalSummary(summary, { browsers: ["chromium"] });

    const fullText = lines.join("\n");
    expect(fullText).toContain("🎯 TEST EXECUTION & UAT SUMMARY / สรุปผลการทดสอบระบบ");
    expect(fullText).toContain("📋 UAT Module : FN-STS-01 (Part 1): Login as Role Suite");
    expect(fullText).toContain("🌐 Browser(s)  : chromium");
    expect(fullText).toContain("⏱️ Total Time  : 47.7s");
    expect(fullText).toContain("📊 Overview    : 3 Total | ผ่าน (Passed): 1 | ไม่ผ่าน (Failed): 2");
    expect(fullText).toContain("[PASS] ✅ TC-STS-AUTH-TEACHER: Login as teacher succeeds and redirects (6.8s)");
    expect(fullText).toContain("[FAIL] ❌ TC-STS-AUTH-DIRECTOR: Login as director succeeds and redirects (18.6s)");
    expect(fullText).toContain("🚦 FINAL RESULT: FAILED ❌ (พบข้อผิดพลาด 2 จาก 3 เคส)");
  });

  it("extracts test cases from job code when stdout did not print individual breadcrumbs", () => {
    const job = {
      id: "job-workspace-1",
      projectId: "projectSts",
      code: `// 🧪 ชุดทดสอบระบบ ProjectSTS: FN-STS-02 จัดการวิชาเรียน
import { test, expect } from "@playwright/test";
test("TC-STS-COURSE-001: Create course", async ({ page }) => {});
test("TC-STS-COURSE-002: Edit course", async ({ page }) => {});
`,
      status: "passed",
      browsers: ["chromium"],
      browserResults: [{ browser: "chromium", passed: 2, failed: 0, skipped: 0, durationMs: 4500 }],
    };

    const summary = extractTestExecutionSummary(job, []);
    expect(summary.uatId).toBe("FN-STS-02");
    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.cases[0].id).toBe("TC-STS-COURSE-001");
    expect(summary.cases[1].id).toBe("TC-STS-COURSE-002");
  });
});
