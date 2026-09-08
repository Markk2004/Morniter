import fs from "node:fs/promises";
import path from "node:path";
import type { LocalProject } from "../shared/settings";

function contained(root: string, child: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(root, child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function validateLocalProject(input: Pick<LocalProject, "workspaceRoot" | "testRoot">): Promise<{ ok: true; testRoot: string; hasPlaywright: boolean } | { ok: false; code: string }> {
  const root = path.resolve(input.workspaceRoot);
  const testRoot = path.resolve(root, input.testRoot);
  if (!contained(root, input.testRoot)) return { ok: false, code: "TEST_ROOT_OUTSIDE_WORKSPACE" };
  try {
    await fs.access(path.join(root, "package.json"));
    await fs.access(testRoot);
    const playwrightPackage = path.join(root, "node_modules", "@playwright", "test");
    let hasPlaywright = true;
    try { await fs.access(playwrightPackage); } catch { hasPlaywright = false; }
    return { ok: true, testRoot: input.testRoot, hasPlaywright };
  } catch { return { ok: false, code: "PROJECT_NOT_READY" }; }
}

export async function detectTestRoots(workspaceRoot: string): Promise<string[]> {
  const candidates = ["e2e", "tests/e2e", "tests", "__tests__"];
  const found: string[] = [];
  for (const candidate of candidates) {
    try { await fs.access(path.join(workspaceRoot, candidate)); found.push(candidate); } catch { /* absent */ }
  }
  return found;
}
