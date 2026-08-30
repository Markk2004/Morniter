import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveInsideRoot } from "./playwright-catalog.js";
import { renderRecipeToPlaywrightCode, type ReusableFlow, type RecipeAction } from "./recipe-renderer.js";
import { spawnProcessCommand } from "./process-adapter.js";
import { resolveExecutable } from "./config.js";
import { resolveAndAssertSafeTestTarget } from "./test-target-policy.js";
import {
  writeJournal,
  deleteJournal,
  recoverRecipeTransactions,
  computeSha256,
  writeFileSyncWithFsync,
  type MutationTransactionJournal,
} from "./mutation-transaction.js";
import type { AgentConfig, RecipeSaveMutation, AutomationMap } from "./types.js";

export interface MutationExecutionOptions {
  skipPlaywrightList?: boolean;
}

export interface MutationExecutionResult {
  status: "succeeded" | "conflict" | "rejected" | "failed";
  newRevision?: string;
  writtenFiles?: string[];
  error?: string;
}

function extractAllActionUrls(
  actions: RecipeAction[],
  flowsMap: Map<string, ReusableFlow>,
  visitedFlows = new Set<string>(),
): string[] {
  const urls: string[] = [];
  for (const action of actions) {
    if (action.kind === "goto" && action.url) {
      urls.push(action.url);
    } else if (action.kind === "use-flow" && action.flowId) {
      if (!visitedFlows.has(action.flowId)) {
        const nextVisited = new Set(visitedFlows).add(action.flowId);
        const flow = flowsMap.get(action.flowId);
        if (flow && Array.isArray(flow.actions)) {
          urls.push(...extractAllActionUrls(flow.actions, flowsMap, nextVisited));
        }
      }
    }
  }
  return urls;
}

export async function executeRecipeMutation(
  config: AgentConfig,
  mutation: RecipeSaveMutation,
  options?: MutationExecutionOptions,
): Promise<MutationExecutionResult> {
  const project = config.projects.find((p) => p.id === mutation.projectId);
  if (!project || !project.playwright || !project.playwright.automationMap) {
    return {
      status: "rejected",
      error: `Project '${mutation.projectId}' does not have an automation map configured`,
    };
  }

  const pw = project.playwright;
  const automationMap = pw.automationMap;
  if (!automationMap) {
    return {
      status: "rejected",
      error: `Project '${mutation.projectId}' does not have an automation map configured`,
    };
  }
  const workspaceRoot = path.resolve(pw.workspaceRoot);
  const mapPath = resolveInsideRoot(workspaceRoot, automationMap);

  let currentMapContent: string;
  try {
    currentMapContent = await fs.readFile(mapPath, "utf8");
  } catch (err) {
    return {
      status: "failed",
      error: `Failed to read automation map: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const currentRevision = crypto.createHash("sha256").update(currentMapContent).digest("hex");
  if (mutation.baseRevision && mutation.baseRevision !== currentRevision) {
    return {
      status: "conflict",
      error: `Automation map was modified concurrently (expected revision ${mutation.baseRevision.slice(0, 8)}, found ${currentRevision.slice(0, 8)})`,
    };
  }

  let map: AutomationMap;
  try {
    map = JSON.parse(currentMapContent) as AutomationMap;
  } catch (err) {
    return {
      status: "failed",
      error: `Failed to parse automation map JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const flows = (map.reusableFlows as ReusableFlow[]) || [];
  const flowsMap = new Map<string, ReusableFlow>(flows.map((f) => [f.id, f]));

  // Validate mutating safety and production host denylist (including nested reusable flows)
  if (mutation.recipe.risk === "mutating") {
    if (!mutation.recipe.cleanupActions || mutation.recipe.cleanupActions.length === 0) {
      return {
        status: "rejected",
        error: "Mutating recipes must define at least one cleanup action",
      };
    }

    const denylist = map.productionHostDenylist || [];
    const allActions = [
      ...mutation.recipe.actions,
      ...(mutation.recipe.cleanupActions || []),
    ];
    const allUrls = extractAllActionUrls(allActions, flowsMap);
    for (const url of allUrls) {
      try {
        resolveAndAssertSafeTestTarget(url, map.testTarget, "mutating", denylist);
      } catch (err) {
        return {
          status: "rejected",
          error: err instanceof Error ? err.message : "Mutating target host forbidden by denylist",
        };
      }
    }
  }

  // Validate output path containment
  const generatedRoot = resolveInsideRoot(workspaceRoot, map.generatedRoot || "frontend/e2e/generated");
  let fullOutputPath: string;
  try {
    fullOutputPath = resolveInsideRoot(workspaceRoot, mutation.recipe.output);
    const relToGenerated = path.relative(generatedRoot, fullOutputPath);
    if (relToGenerated.startsWith("..") || path.isAbsolute(relToGenerated)) {
      return {
        status: "rejected",
        error: `Recipe output '${mutation.recipe.output}' must stay inside generatedRoot '${map.generatedRoot}'`,
      };
    }
  } catch (err) {
    return {
      status: "rejected",
      error: `Invalid output path: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Refuse to overwrite manual files
  let hasExistingFile = false;
  let existingContent = "";
  try {
    existingContent = await fs.readFile(fullOutputPath, "utf8");
    hasExistingFile = true;
    if (!existingContent.includes("@generated by Morniter Recipe Builder")) {
      return {
        status: "rejected",
        error: `Refusing to overwrite manual non-generated test file at '${mutation.recipe.output}'`,
      };
    }
  } catch {
    // File doesn't exist yet, which is expected for new recipes
  }

  // Render Playwright spec
  let specCode: string;
  try {
    specCode = renderRecipeToPlaywrightCode(mutation.recipe, flows);
  } catch (err) {
    return {
      status: "rejected",
      error: `Recipe code rendering error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Validate code hash if provided
  if (mutation.renderedCodeHash) {
    const actualHash = crypto.createHash("sha256").update(specCode).digest("hex");
    if (actualHash !== mutation.renderedCodeHash) {
      return {
        status: "rejected",
        error: `Rendered spec hash does not match verified code hash`,
      };
    }
  }

  // Write temporary spec file ending with .spec.ts so Playwright testMatch discovers it
  await fs.mkdir(path.dirname(fullOutputPath), { recursive: true });
  const tempSpecPath = path.join(
    path.dirname(fullOutputPath),
    `.tmp-${Date.now()}-${path.basename(fullOutputPath)}`,
  );
  await writeFileSyncWithFsync(tempSpecPath, specCode);

  // Verify spec with playwright --list on the temporary file
  if (!options?.skipPlaywrightList) {
    try {
      const npx = resolveExecutable("npx");
      const configArg = pw.config ? ["--config", pw.config] : [];
      const child = spawnProcessCommand(
        npx,
        ["-y", "playwright", "test", tempSpecPath, ...configArg, "--list"],
        workspaceRoot,
        process.env as Record<string, string>,
      );

      const exitCode = await new Promise<number>((resolve) => {
        child.on("close", (code) => resolve(code ?? 1));
        child.on("error", () => resolve(1));
      });

      if (exitCode !== 0) {
        await fs.unlink(tempSpecPath).catch(() => {});
        return {
          status: "failed",
          error: "Generated Playwright spec failed test compilation / syntax validation",
        };
      }
    } catch (err) {
      await fs.unlink(tempSpecPath).catch(() => {});
      return {
        status: "failed",
        error: `Playwright validation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Prepare updated map content and write to temporary map file
  const recipes = Array.isArray(map.recipes) ? [...map.recipes] : [];
  const existingIdx = recipes.findIndex((r) => r.id === mutation.recipe.id);
  if (existingIdx >= 0) {
    recipes[existingIdx] = mutation.recipe as unknown as (typeof recipes)[number];
  } else {
    recipes.push(mutation.recipe as unknown as (typeof recipes)[number]);
  }
  map.recipes = recipes;

  const newMapContent = JSON.stringify(map, null, 2);
  const tempMapPath = path.join(
    path.dirname(mapPath),
    `.tmp-${Date.now()}-${path.basename(mapPath)}`,
  );
  await writeFileSyncWithFsync(tempMapPath, newMapContent);

  // Prepare backups for atomic rollback
  const backupSpecPath = `${fullOutputPath}.bak.${Date.now()}`;
  const backupMapPath = `${mapPath}.bak.${Date.now()}`;

  const specRelativePath = path.relative(workspaceRoot, fullOutputPath).replace(/\\/g, "/");
  const tempSpecRelativePath = path.relative(workspaceRoot, tempSpecPath).replace(/\\/g, "/");
  const specBackupRelativePath = hasExistingFile
    ? path.relative(workspaceRoot, backupSpecPath).replace(/\\/g, "/")
    : undefined;

  const mapRelativePath = path.relative(workspaceRoot, mapPath).replace(/\\/g, "/");
  const tempMapRelativePath = path.relative(workspaceRoot, tempMapPath).replace(/\\/g, "/");
  const mapBackupRelativePath = path.relative(workspaceRoot, backupMapPath).replace(/\\/g, "/");

  const journal: MutationTransactionJournal = {
    mutationId: mutation.id,
    phase: "prepared",
    specRelativePath,
    tempSpecRelativePath,
    specBackupRelativePath,
    mapRelativePath,
    tempMapRelativePath,
    mapBackupRelativePath,
    newSpecHash: computeSha256(specCode),
    newMapHash: computeSha256(newMapContent),
    oldSpecHash: hasExistingFile ? computeSha256(existingContent) : undefined,
    oldMapHash: currentRevision,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (hasExistingFile) {
      await fs.copyFile(fullOutputPath, backupSpecPath);
    }
    await fs.copyFile(mapPath, backupMapPath);

    // Phase 1: Write journal as prepared
    await writeJournal(workspaceRoot, journal);

    // Phase 2: Atomic replacement of spec file
    await fs.rename(tempSpecPath, fullOutputPath);
    journal.phase = "spec-replaced";
    journal.updatedAt = new Date().toISOString();
    await writeJournal(workspaceRoot, journal);

    // Phase 3: Atomic replacement of map file
    await fs.rename(tempMapPath, mapPath);
    journal.phase = "map-replaced";
    journal.updatedAt = new Date().toISOString();
    await writeJournal(workspaceRoot, journal);

    // Phase 4: Committed
    journal.phase = "committed";
    journal.updatedAt = new Date().toISOString();
    await writeJournal(workspaceRoot, journal);

    // Clean up backups on success
    if (hasExistingFile) {
      await fs.unlink(backupSpecPath).catch(() => {});
    }
    await fs.unlink(backupMapPath).catch(() => {});
    await deleteJournal(workspaceRoot);

    const newRevision = crypto.createHash("sha256").update(newMapContent).digest("hex");
    return {
      status: "succeeded",
      newRevision,
      writtenFiles: [mutation.recipe.output],
    };
  } catch (err) {
    // Perform recovery via transaction recovery function
    await recoverRecipeTransactions(workspaceRoot).catch(() => {});

    return {
      status: "failed",
      error: `Atomic write transaction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
