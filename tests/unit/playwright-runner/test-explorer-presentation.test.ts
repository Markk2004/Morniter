import { describe, expect, it } from "vitest";
import {
  TEST_SECTION_PAGE_SIZE,
  partitionTestsByConfidence,
  getMatchReasonLabels,
  getRunnerLabel,
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
});
