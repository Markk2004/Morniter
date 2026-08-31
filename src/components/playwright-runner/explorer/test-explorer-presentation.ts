import type {
  CatalogMatchMethod,
  NativeRunner,
  ProjectCoverageTest,
} from "@/lib/playwright-runner/types";

export const TEST_SECTION_PAGE_SIZE = 10;

export const MATCH_REASON_LABELS: Record<CatalogMatchMethod, string> = {
  explicit: "กำหนดไว้ใน automation map",
  "source-id": "พบ Function/Test ID ใน source",
  path: "ตรงจากชื่อโฟลเดอร์หรือไฟล์",
  title: "ตรงจากชื่อ test",
  keyword: "ตรงจากคำสำคัญ",
  unmatched: "ไม่มีรายละเอียดการจับคู่",
};

export const RUNNER_LABELS: Record<NativeRunner, string> = {
  playwright: "Playwright",
  "generated-playwright": "Playwright (Gen)",
  "node-test": "Frontend Node",
  jest: "Backend Jest",
  "jest-e2e": "Backend Jest E2E",
};

export function getRunnerLabel(runner: NativeRunner): string {
  return RUNNER_LABELS[runner] || runner;
}

export function partitionTestsByConfidence(tests: readonly ProjectCoverageTest[]) {
  return {
    ready: tests.filter((test) => test.confidence !== "low"),
    review: tests.filter((test) => test.confidence === "low"),
  };
}

export function getMatchReasonLabels(methods: readonly CatalogMatchMethod[]): string[] {
  if (methods.length === 0) return ["ไม่มีรายละเอียดการจับคู่"];
  return methods.map((method) => MATCH_REASON_LABELS[method] || method);
}
