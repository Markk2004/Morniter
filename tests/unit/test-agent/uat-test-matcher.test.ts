import { describe, expect, it } from "vitest";
import { matchTestsToUat } from "../../../agent/src/uat-test-matcher";
import type { AutomationMap, DiscoveredProjectTest } from "../../../agent/src/types";

const map: AutomationMap = {
  version: 1,
  projectId: "sts-playwright",
  scanRoots: [{ path: "frontend/e2e", runner: "playwright", executable: true }],
  excludeDirectories: [],
  generatedRoot: "frontend/e2e/generated",
  functions: [
    ...Array.from({ length: 10 }, (_, index) => ({ id: `FN-STS-${String(index + 1).padStart(2, "0")}`, name: `Function ${index + 1}`, keywords: [`fn-${index + 1}`] })),
    { id: "FN-STS-11", name: "Profile", keywords: ["profile"] },
  ],
  explicitMappings: [{ path: "frontend/e2e/auth/login.spec.ts", functionId: "FN-STS-01" }],
  coverageTargets: [],
  recipes: [],
};

const test = (relativePath: string, title: string, sourceIds: string[] = []): DiscoveredProjectTest => ({
  id: relativePath,
  relativePath,
  title,
  runner: "playwright",
  executable: true,
  origin: "manual",
  sourceIds,
  searchText: `${relativePath} ${title} ${sourceIds.join(" ")}`,
});

describe("UAT matcher", () => {
  it("prefers explicit path mapping and returns one primary function", () => {
    const [group] = matchTestsToUat([test("frontend/e2e/auth/login.spec.ts", "login")], map);
    expect(group.id).toBe("FN-STS-01");
    expect(group.tests[0].matchedBy).toContain("explicit");
    expect(group.tests[0].confidence).toBe("high");
  });

  it("uses embedded source ID before keywords", () => {
    const coverage = matchTestsToUat([test("frontend/e2e/profile.spec.ts", "account", ["TC-STS-11-01"])], map);
    const profile = coverage.find((group) => group.id === "FN-STS-11");
    expect(profile?.tests[0].matchedBy).toContain("source-id");
  });
});

