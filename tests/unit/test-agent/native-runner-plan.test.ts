import { describe, expect, it } from "vitest";
import { buildNativeExecutionPlan } from "../../../agent/src/native-runner-plan";
import type { AutomationMap, DiscoveredProjectTest } from "../../../agent/src/types";

describe("Native Runner Command Plan Builder", () => {
  const map: AutomationMap = {
    version: 1,
    projectId: "sts-playwright",
    runnerProfiles: [
      {
        id: "frontend-playwright",
        runner: "playwright",
        workingDirectory: "frontend",
        config: "playwright.config.ts",
      },
      {
        id: "frontend-node",
        runner: "node-test",
        workingDirectory: "frontend",
      },
      {
        id: "backend-jest",
        runner: "jest",
        workingDirectory: "backend",
      },
      {
        id: "backend-jest-e2e",
        runner: "jest-e2e",
        workingDirectory: "backend",
        config: "test/jest-e2e.json",
      },
    ],
    scanRoots: [
      { path: "frontend/e2e", runner: "playwright", executionProfileId: "frontend-playwright", executable: true },
      { path: "frontend/tests", runner: "node-test", executionProfileId: "frontend-node", executable: true },
      { path: "backend/test", runner: "jest-e2e", executionProfileId: "backend-jest-e2e", executable: true },
      { path: "backend/src", runner: "jest", executionProfileId: "backend-jest", executable: true },
    ],
    excludeDirectories: ["node_modules", "dist"],
    generatedRoot: "frontend/e2e/generated",
    functions: [
      { id: "FN-STS-01", name: "Auth", keywords: ["auth"] },
    ],
    explicitMappings: [],
    coverageTargets: [],
    recipes: [],
  };

  const discoveredTests: DiscoveredProjectTest[] = [
    {
      id: "pw-auth-1",
      title: "Login",
      relativePath: "frontend/e2e/auth/login.spec.ts",
      runner: "playwright",
      executionProfileId: "frontend-playwright",
      executable: true,
      origin: "manual",
      sourceIds: [],
      searchText: "login",
    },
    {
      id: "node-contract-1",
      title: "Auth Contract",
      relativePath: "frontend/tests/auth.test.mjs",
      runner: "node-test",
      executionProfileId: "frontend-node",
      executable: true,
      origin: "manual",
      sourceIds: [],
      searchText: "contract",
    },
    {
      id: "jest-unit-1",
      title: "Auth Service",
      relativePath: "backend/src/auth.service.spec.ts",
      runner: "jest",
      executionProfileId: "backend-jest",
      executable: true,
      origin: "manual",
      sourceIds: [],
      searchText: "service",
    },
    {
      id: "jest-e2e-1",
      title: "Auth Backend E2E",
      relativePath: "backend/test/auth.e2e-spec.ts",
      runner: "jest-e2e",
      executionProfileId: "backend-jest-e2e",
      executable: true,
      origin: "manual",
      sourceIds: [],
      searchText: "backend e2e",
    },
  ];

  it("builds ordered execution groups for mixed runner test selections", () => {
    const plan = buildNativeExecutionPlan({
      workspaceRoot: "E:\\ProjectSTS",
      map,
      selectedTestIds: ["jest-unit-1", "pw-auth-1", "node-contract-1", "jest-e2e-1"],
      discoveredTests,
    });

    expect(plan).toHaveLength(4);
    expect(plan.map((g) => g.runner)).toEqual(["playwright", "node-test", "jest", "jest-e2e"]);

    const pwGroup = plan.find((g) => g.runner === "playwright")!;
    expect(pwGroup.command).toMatch(/npx(?:\.cmd)?$/i);
    expect(pwGroup.args).toEqual(expect.arrayContaining(["playwright", "test"]));

    const nodeGroup = plan.find((g) => g.runner === "node-test")!;
    expect(nodeGroup.command).toMatch(/node(?:\.exe)?$/i);
    expect(nodeGroup.args).toEqual(["--test", "tests/auth.test.mjs"]);

    const jestGroup = plan.find((g) => g.runner === "jest")!;
    expect(jestGroup.command).toMatch(/npx(?:\.cmd)?$/i);
    expect(jestGroup.args).toEqual(["jest", "--runInBand", "src/auth.service.spec.ts"]);

    const jestE2eGroup = plan.find((g) => g.runner === "jest-e2e")!;
    expect(jestE2eGroup.command).toMatch(/npx(?:\.cmd)?$/i);
    expect(jestE2eGroup.args).toEqual(["jest", "--config", "test/jest-e2e.json", "--runInBand", "test/auth.e2e-spec.ts"]);
  });

  it("rejects unknown test IDs in selection", () => {
    expect(() =>
      buildNativeExecutionPlan({
        workspaceRoot: "E:\\ProjectSTS",
        map,
        selectedTestIds: ["unknown-test-id"],
        discoveredTests,
      }),
    ).toThrow(/unknown testId|cannot be resolved/i);
  });
});
