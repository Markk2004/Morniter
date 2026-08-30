import fs from "node:fs/promises";
import path from "node:path";
import { generateTestId, resolveInsideRoot } from "./playwright-catalog.js";
import { redactText } from "./redact.js";
import type {
  AutomationMap,
  DiscoveredProjectTest,
  DiscoveredTestRunner,
  AutomationScanRoot,
} from "./types.js";

const TEST_FILE_PATTERN = /(?:\.e2e-spec|\.spec|\.test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_DECLARATION_REGEX = /(?:test|it|describe)\s*(?:\.\w+)?\s*\(\s*["'`]([^"'`]+)["'`]/g;
const MAX_SOURCE_BYTES = 200_000;

export interface ProjectDiscoveryResult {
  tests: DiscoveredProjectTest[];
  sourceByPath: Record<string, string>;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function normalizeSearchText(...values: string[]): string {
  return values.join(" ").toLowerCase().replace(/[\\/_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function runnerForRoot(root: AutomationScanRoot, relativePath: string, generatedRoot: string): DiscoveredTestRunner {
  const normalizedGeneratedRoot = generatedRoot.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = relativePath.replace(/\\/g, "/");
  if (normalizedPath === normalizedGeneratedRoot || normalizedPath.startsWith(`${normalizedGeneratedRoot}/`)) {
    return "generated-playwright";
  }
  return root.runner;
}

function extractTitles(content: string): Array<{ title: string; line: number }> {
  const titles: Array<{ title: string; line: number }> = [];
  TEST_DECLARATION_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TEST_DECLARATION_REGEX.exec(content)) !== null) {
    const title = match[1]?.trim();
    if (title) titles.push({ title, line: getLineNumber(content, match.index) });
  }
  return titles;
}

function extractSourceIds(content: string): string[] {
  return [...new Set(content.match(/(?:FN|TC|TS)-STS-[A-Z0-9-]+/gi) ?? [])];
}

async function scanRoot(
  workspaceRoot: string,
  root: AutomationScanRoot,
  generatedRoot: string,
  excluded: Set<string>,
  usedIds: Set<string>,
  sourceByPath: Record<string, string>,
): Promise<DiscoveredProjectTest[]> {
  const rootPath = resolveInsideRoot(workspaceRoot, root.path);
  const results: DiscoveredProjectTest[] = [];

  async function walk(current: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (excluded.has(entry.name.toLowerCase())) continue;
      const fullPath = path.join(current, entry.name);
      let stat;
      try {
        stat = await fs.lstat(fullPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!stat.isFile() || !TEST_FILE_PATTERN.test(entry.name)) continue;

      let content: string;
      try {
        const handle = await fs.open(fullPath, "r");
        try {
          const buffer = Buffer.alloc(Math.min(Number(stat.size), MAX_SOURCE_BYTES));
          const read = await handle.read(buffer, 0, buffer.length, 0);
          content = read.bytesRead > 0 ? buffer.subarray(0, read.bytesRead).toString("utf8") : "";
        } finally {
          await handle.close();
        }
      } catch {
        continue;
      }

      const relativePath = path.relative(workspaceRoot, fullPath).replace(/\\/g, "/");
      const runner = runnerForRoot(root, relativePath, generatedRoot);
      const origin = runner === "generated-playwright" ? "generated" : "manual";
      const sourceIds = extractSourceIds(content);
      const titles = extractTitles(content);
      const fileTitle = path.basename(entry.name, path.extname(entry.name));
      let id = generateTestId(relativePath, fileTitle, 0, titles[0]?.line ?? 1);
      while (usedIds.has(id)) id = `${id}-1`;
      usedIds.add(id);

      const redacted = redactText(content);
      sourceByPath[relativePath] = redacted;

      results.push({
        id,
        relativePath,
        title: fileTitle,
        runner,
        executionProfileId: root.executionProfileId,
        executable: runner === "playwright" || runner === "generated-playwright",
        origin,
        sourceIds,
        searchText: normalizeSearchText(relativePath, fileTitle, ...titles.map((item) => item.title), sourceIds.join(" ")),
      });
    }
  }

  await walk(rootPath);
  return results;
}

export async function discoverProjectTests(
  workspaceRoot: string,
  map: AutomationMap,
): Promise<ProjectDiscoveryResult> {
  const excluded = new Set(map.excludeDirectories.map((name) => name.toLowerCase()));
  const usedIds = new Set<string>();
  const tests: DiscoveredProjectTest[] = [];
  const sourceByPath: Record<string, string> = {};

  for (const root of map.scanRoots) {
    const rootTests = await scanRoot(workspaceRoot, root, map.generatedRoot, excluded, usedIds, sourceByPath);
    tests.push(...rootTests);
  }

  tests.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.title.localeCompare(b.title));
  return {
    tests,
    sourceByPath,
  };
}
