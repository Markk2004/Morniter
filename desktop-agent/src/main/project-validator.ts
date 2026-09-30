import fs from "node:fs/promises";
import path from "node:path";
import type { LocalProject } from "../shared/settings";

function contained(root: string, child: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(root, child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function validateLocalProject(input: Pick<LocalProject, "workspaceRoot" | "testRoot">): Promise<{ ok: true; testRoot: string; hasPlaywright: boolean } | { ok: false; code: string }> {
  const root = path.resolve(input.workspaceRoot);
  try {
    await fs.access(root);
  } catch {
    return { ok: false, code: "WORKSPACE_NOT_FOUND" };
  }

  let resolvedTestRoot = input.testRoot || "e2e";
  let testRoot = path.resolve(root, resolvedTestRoot);

  if (!contained(root, resolvedTestRoot)) {
    return { ok: false, code: "TEST_ROOT_OUTSIDE_WORKSPACE" };
  }

  try {
    // Check if testRoot exists directly
    try {
      await fs.access(testRoot);
    } catch {
      // If not, check if frontend/testRoot exists (common Next.js/monorepo structure)
      const frontendCandidate = path.join("frontend", resolvedTestRoot);
      const frontendTestRoot = path.resolve(root, frontendCandidate);
      try {
        await fs.access(frontendTestRoot);
        resolvedTestRoot = frontendCandidate;
        testRoot = frontendTestRoot;
      } catch {
        // Try other candidates
        const detected = await detectTestRoots(root);
        if (detected.length > 0) {
          resolvedTestRoot = detected[0];
          testRoot = path.resolve(root, resolvedTestRoot);
        } else {
          // If no test directory exists yet, create it safely
          await fs.mkdir(testRoot, { recursive: true });
        }
      }
    }

    // Check Playwright installation in root or frontend
    let hasPlaywright = true;
    const playwrightRoots = [
      path.join(root, "node_modules", "@playwright", "test"),
      path.join(root, "frontend", "node_modules", "@playwright", "test"),
    ];
    let foundPlaywright = false;
    for (const p of playwrightRoots) {
      try {
        await fs.access(p);
        foundPlaywright = true;
        break;
      } catch {
        // continue checking
      }
    }
    hasPlaywright = foundPlaywright;

    return { ok: true, testRoot: resolvedTestRoot, hasPlaywright };
  } catch {
    return { ok: false, code: "PROJECT_NOT_READY" };
  }
}

export async function detectTestRoots(workspaceRoot: string): Promise<string[]> {
  const candidates = [
    "e2e",
    "frontend/e2e",
    "tests/e2e",
    "frontend/tests",
    "tests",
    "__tests__",
  ];
  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(workspaceRoot, candidate));
      found.push(candidate);
    } catch {
      /* absent */
    }
  }
  return found;
}
