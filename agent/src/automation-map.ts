import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveInsideRoot } from "./playwright-catalog.js";
import type {
  AutomationMap,
  AutomationRecipeAssertion,
} from "./types.js";

const RelativePathSchema = z.string().min(1).refine(
  (value) => !path.isAbsolute(value) && !value.split(/[/\\]/).includes(".."),
  { message: "path must be a contained relative path" },
);

const RunnerProfileSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  runner: z.enum(["playwright", "generated-playwright", "node-test", "jest", "jest-e2e"]),
  workingDirectory: RelativePathSchema,
  config: RelativePathSchema.optional(),
  envAllowlist: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).optional(),
}).strict();

const AssertionSchema = z.object({
  kind: z.enum(["role-visible", "heading-visible", "text-visible", "url-matches"]),
  role: z.enum(["button", "link", "textbox"]).optional(),
  name: z.string().optional(),
  value: z.string().optional(),
}).strict();

const RecipeSchema = z.object({
  id: z.string().min(1),
  output: RelativePathSchema,
  title: z.string().optional(),
  route: z.string().optional(),
  risk: z.enum(["read-only", "mutating"]).optional(),
  functionId: z.string().optional(),
  assertions: z.array(AssertionSchema).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
  cleanupActions: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

const AutomationScanRootSchema = z.object({
  path: RelativePathSchema,
  runner: z.enum(["playwright", "node-test", "jest", "jest-e2e"]),
  executionProfileId: z.string().min(1).max(64).optional(),
  executable: z.boolean(),
}).strict();

const TestTargetConfigSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  label: z.string().min(1).max(128),
  baseUrl: z.string().url().refine((val) => {
    try {
      const u = new URL(val);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      if (u.username || u.password) return false;
      if (u.search || u.hash) return false;
      return true;
    } catch {
      return false;
    }
  }, { message: "baseUrl must be a valid http(s) URL without credentials, search params, or hash" }),
  allowMutating: z.boolean(),
}).strict();

const AutomationMapSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  projectId: z.string().min(1),
  testTarget: TestTargetConfigSchema.optional(),
  runnerProfiles: z.array(RunnerProfileSchema).optional(),
  scanRoots: z.array(AutomationScanRootSchema).min(1),
  excludeDirectories: z.array(z.string().min(1)),
  generatedRoot: RelativePathSchema,
  functions: z.array(z.object({
    id: z.string().min(1).max(128),
    name: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(1),
  }).strict()).min(1),
  explicitMappings: z.array(z.object({
    path: RelativePathSchema,
    functionId: z.string().min(1).max(128),
  }).strict()),
  coverageTargets: z.array(z.object({
    id: z.string().min(1),
    functionId: z.string().min(1).max(128),
    title: z.string().min(1),
    automation: z.enum(["playwright", "unsupported"]),
    recipeId: z.string().min(1).optional(),
  }).strict()),
  recipes: z.array(RecipeSchema),
  reusableFlows: z.array(z.unknown()).optional(),
  productionHostDenylist: z.array(z.string().min(1)).optional(),
}).strict();

export function parseAutomationMap(raw: unknown): AutomationMap {
  return AutomationMapSchema.parse(raw) as AutomationMap;
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique`);
  }
}

function validateRecipeAssertion(assertion: AutomationRecipeAssertion): void {
  if (assertion.kind === "role-visible" && (!assertion.role || !assertion.name)) {
    throw new Error("role-visible assertion requires role and name");
  }
  if (assertion.kind === "heading-visible" && !assertion.name) {
    throw new Error("heading-visible assertion requires name");
  }
  if (assertion.kind === "text-visible" && !assertion.name) {
    throw new Error("text-visible assertion requires name");
  }
  if (assertion.kind === "url-matches" && !assertion.value) {
    throw new Error("url-matches assertion requires value");
  }
}

export function validateAutomationMap(workspaceRoot: string, map: AutomationMap): void {
  const functionIds = map.functions.map((item) => item.id);
  assertUnique(functionIds, "function IDs");
  assertUnique(map.recipes.map((item) => item.id), "recipe IDs");
  assertUnique(map.coverageTargets.map((item) => item.id), "coverage target IDs");
  assertUnique(map.explicitMappings.map((item) => item.path), "explicit mapping paths");

  if (map.testTarget && map.testTarget.allowMutating && map.productionHostDenylist) {
    const targetHost = new URL(map.testTarget.baseUrl).hostname.toLowerCase();
    const isDenied = map.productionHostDenylist.some((denied) => {
      const d = denied.toLowerCase();
      return targetHost === d || targetHost.endsWith(`.${d}`);
    });
    if (isDenied) {
      throw new Error(
        `testTarget '${map.testTarget.id}' cannot have allowMutating: true because its host '${targetHost}' is in productionHostDenylist`,
      );
    }
  }

  if (map.runnerProfiles) {
    assertUnique(map.runnerProfiles.map((p) => p.id), "runner profile IDs");
    const profileMap = new Map(map.runnerProfiles.map((p) => [p.id, p]));

    for (const profile of map.runnerProfiles) {
      resolveInsideRoot(workspaceRoot, profile.workingDirectory);
      if (profile.config) {
        resolveInsideRoot(workspaceRoot, profile.config);
      }
    }

    for (const root of map.scanRoots) {
      if (root.executionProfileId) {
        const profile = profileMap.get(root.executionProfileId);
        if (!profile) {
          throw new Error(`Unknown runner profile '${root.executionProfileId}' in scan root '${root.path}'`);
        }
        if (profile.runner !== root.runner) {
          throw new Error(`Runner mismatch: scan root '${root.path}' specifies runner '${root.runner}' but profile '${profile.id}' has runner '${profile.runner}'`);
        }
      }
    }
  }

  for (const root of map.scanRoots) {
    resolveInsideRoot(workspaceRoot, root.path);
    if (root.runner === "playwright" && !root.executable) {
      throw new Error(`Playwright scan root '${root.path}' must be executable`);
    }
  }

  const generatedRoot = resolveInsideRoot(workspaceRoot, map.generatedRoot);
  for (const mapping of map.explicitMappings) {
    resolveInsideRoot(workspaceRoot, mapping.path);
    if (!functionIds.includes(mapping.functionId)) {
      throw new Error(`Unknown function ID '${mapping.functionId}' in explicit mapping`);
    }
  }

  const recipeIds = new Set(map.recipes.map((item) => item.id));
  for (const recipe of map.recipes) {
    const output = resolveInsideRoot(generatedRoot, recipe.output);
    const relation = path.relative(generatedRoot, output);
    if (relation.startsWith("..") || path.isAbsolute(relation)) {
      throw new Error(`Recipe output '${recipe.output}' must stay inside generatedRoot`);
    }
    if (recipe.assertions) {
      recipe.assertions.forEach(validateRecipeAssertion);
    }
  }

  for (const target of map.coverageTargets) {
    if (!functionIds.includes(target.functionId)) {
      throw new Error(`Unknown function ID '${target.functionId}' in coverage target`);
    }
    if (target.automation === "playwright" && (!target.recipeId || !recipeIds.has(target.recipeId))) {
      throw new Error(`Playwright target '${target.id}' requires an existing recipe`);
    }
    if (target.automation === "unsupported" && target.recipeId) {
      throw new Error(`Unsupported target '${target.id}' cannot have a recipe`);
    }
  }
}

export async function loadAutomationMap(
  workspaceRoot: string,
  relativeMapPath: string,
): Promise<AutomationMap> {
  if (path.isAbsolute(relativeMapPath)) {
    throw new Error("automationMap must be relative to workspaceRoot");
  }
  const mapPath = resolveInsideRoot(workspaceRoot, relativeMapPath);
  const raw = JSON.parse(await fs.readFile(mapPath, "utf8")) as unknown;
  const map = AutomationMapSchema.parse(raw) as AutomationMap;
  validateAutomationMap(workspaceRoot, map);
  return map;
}
