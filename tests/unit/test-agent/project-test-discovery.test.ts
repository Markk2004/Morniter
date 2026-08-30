import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverProjectTests } from "../../../agent/src/project-test-discovery";
import type { AutomationMap } from "../../../agent/src/types";

const tempRoots: string[] = [];

const map: AutomationMap = {
  version: 1,
  projectId: "sts-playwright",
  scanRoots: [
    { path: "frontend/e2e", runner: "playwright", executable: true },
    { path: "frontend/tests", runner: "node-test", executable: false },
    { path: "backend/test", runner: "jest-e2e", executable: false },
    { path: "backend/src", runner: "jest", executable: false },
  ],
  excludeDirectories: ["node_modules", "dist"],
  generatedRoot: "frontend/e2e/generated",
  functions: Array.from({ length: 11 }, (_, index) => ({
    id: `FN-STS-${String(index + 1).padStart(2, "0")}`,
    name: `Function ${index + 1}`,
    keywords: [`fn-${index + 1}`],
  })) as AutomationMap["functions"],
  explicitMappings: [],
  coverageTargets: [],
  recipes: [],
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("ProjectSTS test discovery", () => {
  it("discovers supported runners and excludes generated build output", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "morniter-discovery-"));
    tempRoots.push(root);
    const files: Record<string, string> = {
      "frontend/e2e/auth/login.spec.ts": 'import { test } from "@playwright/test"; test("FN-STS-01 login", async () => {});',
      "frontend/e2e/generated/fn-sts-01/generated.spec.ts": 'import { test } from "@playwright/test"; test("generated", async () => {});',
      "frontend/tests/auth.test.mjs": 'test("FN-STS-01 contract", () => {});',
      "backend/test/auth.e2e-spec.ts": 'describe("FN-STS-01 backend", () => {});',
      "backend/src/auth.service.spec.ts": 'it("FN-STS-01 service", () => {});',
      "backend/dist/ignored.spec.js": 'test("ignored", () => {});',
    };
    for (const [relative, content] of Object.entries(files)) {
      const target = path.join(root, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
    }

    const result = await discoverProjectTests(root, map);
    expect(result.tests).toHaveLength(5);
    expect(result.tests.map((test) => test.runner)).toEqual([
      "jest", "jest-e2e", "playwright", "generated-playwright", "node-test",
    ]);
    expect(result.tests.every((test) => !path.isAbsolute(test.relativePath))).toBe(true);
    expect(Object.keys(result.sourceByPath)).toHaveLength(5);
    expect(result.sourceByPath["frontend/e2e/auth/login.spec.ts"]).toContain("FN-STS-01 login");
    expect(result.sourceByPath["backend/src/auth.service.spec.ts"]).toContain("FN-STS-01 service");
  });
});

