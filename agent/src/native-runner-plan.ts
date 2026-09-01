import path from "node:path";
import { resolveExecutable } from "./config.js";
import { resolveInsideRoot } from "./playwright-catalog.js";
import { buildSafeTestEnv } from "./playwright-executor.js";
import type {
  AutomationMap,
  DiscoveredProjectTest,
  NativeRunner,
  RunnerProfile,
  RunMode,
} from "./types.js";

export interface NativeExecutionGroup {
  runner: NativeRunner;
  executionProfileId: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  testIds: string[];
  relativePaths: string[];
  timeoutSeconds: number;
}

export interface BuildNativeExecutionPlanOptions {
  workspaceRoot: string;
  map: AutomationMap;
  selectedTestIds: string[];
  discoveredTests: DiscoveredProjectTest[];
  browsers?: ("chromium" | "firefox" | "webkit")[];
  mode?: RunMode;
  envAllowlist?: string[];
  timeoutSeconds?: number;
}

const RUNNER_ORDER: NativeRunner[] = [
  "playwright",
  "generated-playwright",
  "node-test",
  "jest",
  "jest-e2e",
];

export function buildNativeExecutionPlan({
  workspaceRoot,
  map,
  selectedTestIds,
  discoveredTests,
  browsers = ["chromium"],
  mode = "headless",
  envAllowlist = [],
  timeoutSeconds = 600,
}: BuildNativeExecutionPlanOptions): NativeExecutionGroup[] {
  const rootPath = path.resolve(workspaceRoot);
  const profileMap = new Map<string, RunnerProfile>(
    (map.runnerProfiles || []).map((p) => [p.id, p]),
  );

  const testMap = new Map<string, DiscoveredProjectTest>(
    discoveredTests.map((t) => [t.id, t]),
  );

  // Group selected tests by executionProfileId
  const groupsByProfile = new Map<string, { profile: RunnerProfile; tests: DiscoveredProjectTest[] }>();

  for (const testId of selectedTestIds) {
    const test = testMap.get(testId);
    if (!test) {
      throw new Error(`TestId '${testId}' cannot be resolved in project.`);
    }

    const profileId = test.executionProfileId || `default-${test.runner}`;
    let group = groupsByProfile.get(profileId);

    if (!group) {
      let profile = profileMap.get(profileId);
      if (!profile) {
        // Fallback default profile if not specified in map
        profile = {
          id: profileId,
          runner: test.runner,
          workingDirectory: ".",
        };
      }
      group = { profile, tests: [] };
      groupsByProfile.set(profileId, group);
    }

    group.tests.push(test);
  }

  const result: NativeExecutionGroup[] = [];

  for (const runnerType of RUNNER_ORDER) {
    const matchingGroups = Array.from(groupsByProfile.values()).filter(
      (g) => g.profile.runner === runnerType,
    );

    for (const { profile, tests } of matchingGroups) {
      if (tests.length === 0) continue;

      const profileCwd = resolveInsideRoot(rootPath, profile.workingDirectory);
      const uniqueRelativePaths = Array.from(new Set(tests.map((t) => t.relativePath)));
      const filesRelativeToCwd = uniqueRelativePaths.map((rel) => {
        const full = resolveInsideRoot(rootPath, rel);
        return path.relative(profileCwd, full).replace(/\\/g, "/");
      });

      const safeEnv = buildSafeTestEnv([
        ...envAllowlist,
        ...(profile.envAllowlist || []),
      ]);

      let command: string;
      let args: string[];

      switch (profile.runner) {
        case "playwright":
        case "generated-playwright": {
          command = resolveExecutable("npx");
          args = ["-y", "playwright", "test", ...filesRelativeToCwd];
          if (profile.config) {
            args.push("--config", profile.config);
          }
          for (const b of browsers) {
            args.push(`--project=${b}`);
          }
          if (mode === "headed") {
            args.push("--headed");
          }
          break;
        }
        case "node-test": {
          command = resolveExecutable("node");
          args = ["--test", ...filesRelativeToCwd];
          break;
        }
        case "jest": {
          command = resolveExecutable("npx");
          args = ["jest", "--runInBand", ...filesRelativeToCwd];
          break;
        }
        case "jest-e2e": {
          command = resolveExecutable("npx");
          args = ["jest"];
          if (profile.config) {
            args.push("--config", profile.config);
          }
          args.push("--runInBand", ...filesRelativeToCwd);
          break;
        }
        default: {
          throw new Error(`Unsupported runner: ${profile.runner}`);
        }
      }

      result.push({
        runner: profile.runner,
        executionProfileId: profile.id,
        command,
        args,
        cwd: profileCwd,
        env: safeEnv,
        testIds: tests.map((t) => t.id),
        relativePaths: uniqueRelativePaths,
        timeoutSeconds,
      });
    }
  }

  return result;
}
