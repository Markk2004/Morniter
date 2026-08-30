import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAutomationMap } from "../../../agent/src/automation-map";
import type { AutomationMap } from "../../../agent/src/types";

const tempRoots: string[] = [];

function validMap(): AutomationMap {
  return {
    version: 1,
    projectId: "sts-playwright",
    scanRoots: [{ path: "frontend/e2e", runner: "playwright", executable: true }],
    excludeDirectories: ["node_modules", "dist"],
    generatedRoot: "frontend/e2e/generated",
    functions: Array.from({ length: 11 }, (_, index) => ({
      id: `FN-STS-${String(index + 1).padStart(2, "0")}`,
      name: `Function ${index + 1}`,
      keywords: [`fn-${index + 1}`],
    })),
    explicitMappings: [],
    coverageTargets: [],
    recipes: [],
  };
}

async function writeMap(map: unknown): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "morniter-map-"));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, "map.json"), JSON.stringify(map), "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("automation map", () => {
  it("loads a valid ProjectSTS map", async () => {
    const root = await writeMap(validMap());
    const map = await loadAutomationMap(root, "map.json");
    expect(map.projectId).toBe("sts-playwright");
    expect(map.functions).toHaveLength(11);
  });

  it("rejects absolute map paths", async () => {
    const root = await writeMap(validMap());
    await expect(loadAutomationMap(root, path.join(root, "map.json"))).rejects.toThrow(/relative|escapes/i);
  });

  it("rejects a recipe outside generatedRoot", async () => {
    const map = validMap();
    map.recipes = [{
      id: "unsafe",
      output: "../../manual.spec.ts",
      route: "/",
      assertions: [{ kind: "url-matches", value: "/" }],
    }];
    const root = await writeMap(map);
    await expect(loadAutomationMap(root, "map.json")).rejects.toThrow(/generatedRoot|escapes configured project root|contained relative path/i);
  });

  it("accepts valid runner profiles", async () => {
    const map = validMap();
    map.runnerProfiles = [
      {
        id: "backend-jest-e2e",
        runner: "jest-e2e",
        workingDirectory: "backend",
        config: "test/jest-e2e.json",
        envAllowlist: ["NODE_ENV", "JWT_SECRET"],
      },
    ];
    map.scanRoots = [
      {
        path: "backend/test",
        runner: "jest-e2e",
        executionProfileId: "backend-jest-e2e",
        executable: true,
      },
    ];
    const root = await writeMap(map);
    const loaded = await loadAutomationMap(root, "map.json");
    expect(loaded.runnerProfiles).toBeDefined();
    expect(loaded.runnerProfiles?.[0].id).toBe("backend-jest-e2e");
  });

  it("rejects unknown runner profile reference in scanRoots", async () => {
    const map = validMap();
    map.runnerProfiles = [
      {
        id: "backend-jest-e2e",
        runner: "jest-e2e",
        workingDirectory: "backend",
      },
    ];
    map.scanRoots = [
      {
        path: "backend/test",
        runner: "jest-e2e",
        executionProfileId: "non-existent-profile",
        executable: true,
      },
    ];
    const root = await writeMap(map);
    await expect(loadAutomationMap(root, "map.json")).rejects.toThrow(/unknown runner profile|executionProfileId/i);
  });

  it("rejects mismatched runner between scanRoot and profile", async () => {
    const map = validMap();
    map.runnerProfiles = [
      {
        id: "backend-jest-e2e",
        runner: "jest-e2e",
        workingDirectory: "backend",
      },
    ];
    map.scanRoots = [
      {
        path: "backend/test",
        runner: "jest",
        executionProfileId: "backend-jest-e2e",
        executable: true,
      },
    ];
    const root = await writeMap(map);
    await expect(loadAutomationMap(root, "map.json")).rejects.toThrow(/mismatch|agrees/i);
  });

  it("rejects invalid environment variable names in profile envAllowlist", async () => {
    const map = validMap();
    map.runnerProfiles = [
      {
        id: "backend-jest",
        runner: "jest",
        workingDirectory: "backend",
        envAllowlist: ["lowercase_env", "123_invalid"],
      },
    ];
    const root = await writeMap(map);
    await expect(loadAutomationMap(root, "map.json")).rejects.toThrow();
  });

  it("rejects absolute paths and escapes in runner profiles", async () => {
    const map = validMap();
    map.runnerProfiles = [
      {
        id: "backend-jest",
        runner: "jest",
        workingDirectory: "../../backend",
      },
    ];
    const root = await writeMap(map);
    await expect(loadAutomationMap(root, "map.json")).rejects.toThrow(/relative|escapes/i);
  });

  it("accepts valid testTarget configuration", async () => {
    const map = validMap();
    map.testTarget = {
      id: "projectsts-uat",
      label: "ProjectSTS UAT",
      baseUrl: "https://uat.projectsts.example",
      allowMutating: true,
    };
    map.productionHostDenylist = ["projectsts.com", "app.projectsts.com"];
    const root = await writeMap(map);
    const loaded = await loadAutomationMap(root, "map.json");
    expect(loaded.testTarget).toBeDefined();
    expect(loaded.testTarget?.id).toBe("projectsts-uat");
    expect(loaded.testTarget?.allowMutating).toBe(true);
  });

  it("rejects testTarget with credentials, search query, or fragment", async () => {
    const mapWithCreds = validMap();
    mapWithCreds.testTarget = {
      id: "uat",
      label: "UAT",
      baseUrl: "https://user:pass@uat.projectsts.example",
      allowMutating: false,
    };
    const root1 = await writeMap(mapWithCreds);
    await expect(loadAutomationMap(root1, "map.json")).rejects.toThrow(/credentials|valid http/i);

    const mapWithQuery = validMap();
    mapWithQuery.testTarget = {
      id: "uat",
      label: "UAT",
      baseUrl: "https://uat.projectsts.example?env=uat",
      allowMutating: false,
    };
    const root2 = await writeMap(mapWithQuery);
    await expect(loadAutomationMap(root2, "map.json")).rejects.toThrow(/credentials|search|valid http/i);
  });

  it("rejects testTarget with allowMutating: true when hostname is in productionHostDenylist", async () => {
    const map = validMap();
    map.productionHostDenylist = ["projectsts.com"];
    map.testTarget = {
      id: "prod",
      label: "Production",
      baseUrl: "https://app.projectsts.com",
      allowMutating: true,
    };
    const root = await writeMap(map);
    await expect(loadAutomationMap(root, "map.json")).rejects.toThrow(/cannot have allowMutating: true because its host/i);
  });
});
