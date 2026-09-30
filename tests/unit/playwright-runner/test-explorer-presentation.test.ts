import { describe, expect, it } from "vitest";
import {
  TEST_SECTION_PAGE_SIZE,
  partitionTestsByConfidence,
  getMatchReasonLabels,
  getRunnerLabel,
  getFunctionDetailedDoc,
} from "@/components/playwright-runner/explorer/test-explorer-presentation";
import type { ProjectCoverageTest } from "@/lib/playwright-runner/types";

describe("Test Explorer Review Presentation Helpers", () => {
  const makeTest = (
    id: string,
    confidence: "high" | "medium" | "low",
    matchedBy: ProjectCoverageTest["matchedBy"] = ["path"],
  ): ProjectCoverageTest => ({
    id,
    title: `Test ${id}`,
    relativePath: `e2e/${id}.spec.ts`,
    runner: "playwright",
    executable: true,
    origin: "manual",
    confidence,
    matchedBy,
  });

  it("partitions tests by confidence level correctly (High/Medium into ready, Low into review)", () => {
    const high = makeTest("t-high", "high", ["explicit"]);
    const medium = makeTest("t-med", "medium", ["keyword"]);
    const low = makeTest("t-low", "low", ["title"]);

    const result = partitionTestsByConfidence([high, medium, low]);
    expect(result).toEqual({
      ready: [high, medium],
      review: [low],
    });
  });

  it("translates matching methods to human-readable Thai copy", () => {
    expect(
      getMatchReasonLabels(["explicit", "source-id", "path", "title", "keyword"]),
    ).toEqual([
      "กำหนดไว้ใน automation map",
      "พบ Function/Test ID ใน source",
      "ตรงจากชื่อโฟลเดอร์หรือไฟล์",
      "ตรงจากชื่อ test",
      "ตรงจากคำสำคัญ",
    ]);

    expect(getMatchReasonLabels([])).toEqual(["ไม่มีรายละเอียดการจับคู่"]);
  });

  it("defines standard page size constant as 10", () => {
    expect(TEST_SECTION_PAGE_SIZE).toBe(10);
  });

  it("maps native runner names to UI display labels", () => {
    expect(getRunnerLabel("playwright")).toBe("Playwright");
    expect(getRunnerLabel("generated-playwright")).toBe("Playwright (Gen)");
    expect(getRunnerLabel("node-test")).toBe("Frontend Node");
    expect(getRunnerLabel("jest")).toBe("Backend Jest");
    expect(getRunnerLabel("jest-e2e")).toBe("Backend Jest E2E");
  });

  it("resolves specific sub-part documentation for authentication cases", () => {
    const invalidDoc = getFunctionDetailedDoc("TC-STS-AUTH-INVALID: Invalid credentials displays an error alert");
    expect(invalidDoc?.id).toBe("FN-STS-01-INVALID");
    expect(invalidDoc?.name).toContain("รหัสผ่านผิด");
    expect(invalidDoc?.role).toBe("ตรวจสอบความปลอดภัย (Security Check)");

    const emptyDoc = getFunctionDetailedDoc("TC-STS-AUTH-EMPTY: Empty username/password submission is rejected");
    expect(emptyDoc?.id).toBe("FN-STS-01-EMPTY");
    expect(emptyDoc?.name).toContain("เว้นว่าง");
    expect(emptyDoc?.role).toBe("ตรวจสอบความปลอดภัย (Validation Check)");

    const roleDoc = getFunctionDetailedDoc("TC-STS-AUTH-TEACHER: Login as teacher succeeds and redirects");
    expect(roleDoc?.id).toBe("FN-STS-01-ROLES");
    expect(roleDoc?.name).toContain("เข้าสู่ระบบตามบทบาทผู้ใช้");

    const genericDoc = getFunctionDetailedDoc("FN-STS-01");
    expect(genericDoc?.id).toBe("FN-STS-01");
  });
});
