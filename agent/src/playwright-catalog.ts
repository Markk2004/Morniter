import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
  AgentConfig,
  PlaywrightCatalog,
  PlaywrightProjectCatalog,
  PlaywrightTestDescriptor,
} from "./types.js";

export function resolveInsideRoot(root: string, relativePath: string): string {
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path '${relativePath}' escapes configured project root '${root}'`);
  }

  return resolved;
}

export function generateTestId(
  relativePath: string,
  title: string,
  index = 0,
  line?: number,
): string {
  const cleanRel = relativePath.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const fallbackTitle = title.trim() || `test-${index + 1}`;
  const cleanTitle = fallbackTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const hash = crypto
    .createHash("sha256")
    .update(`${relativePath}:${fallbackTitle}:${line ?? index}:${index}`)
    .digest("hex")
    .slice(0, 8);
  const combined = `${cleanRel}-${cleanTitle}`.replace(/-+/g, "-").slice(0, 48);
  return `${combined}-${hash}`;
}

const TEST_DECLARATION_REGEX = /(?:^|[^\w])test(?:\.(?:only|skip|fixme|fail))?\s*\(\s*["'`](.*?)["'`]/g;

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function hasPlaywrightImport(content: string): boolean {
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
  return /(?:from\s*["']@playwright\/test["']|import\s*["']@playwright\/test["']|require\(\s*["']@playwright\/test["']\s*\))/.test(
    withoutComments,
  );
}

function displayGroupName(group: string): string {
  const knownNames: Record<string, string> = {
    auth: "Authentication",
    authentication: "Authentication",
    students: "Students",
    monitor: "Monitor",
  };
  return knownNames[group.toLowerCase()] || group
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface PlaywrightScanResult {
  tests: PlaywrightTestDescriptor[];
  sourceByPath: Record<string, string>;
  scanPathLabel: string;
}

export async function scanPlaywrightTests(
  workspaceRoot: string,
  testDir = "e2e",
): Promise<PlaywrightTestDescriptor[]> {
  const result = await scanPlaywrightProject(workspaceRoot, testDir);
  return result.tests;
}

export async function scanPlaywrightProject(
  workspaceRoot: string,
  testDir = "e2e",
): Promise<PlaywrightScanResult> {
  const fullTestDir = resolveInsideRoot(workspaceRoot, testDir);
  const descriptors: PlaywrightTestDescriptor[] = [];
  const sourceByPath: Record<string, string> = {};
  const usedIds = new Set<string>();

  async function walkDir(currentDir: string): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === "__workspace__") {
        continue;
      }

      const fullPath = path.join(currentDir, entry);
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        await walkDir(fullPath);
      } else if (
        stat.isFile() &&
        (entry.endsWith(".spec.ts") ||
          entry.endsWith(".spec.tsx") ||
          entry.endsWith(".spec.js") ||
          entry.endsWith(".spec.jsx") ||
          entry.endsWith(".test.ts") ||
          entry.endsWith(".test.tsx") ||
          entry.endsWith(".test.js") ||
          entry.endsWith(".test.jsx"))
      ) {
        const relativeToRoot = path.relative(workspaceRoot, fullPath).replace(/\\/g, "/");
        const relativeToTestRoot = path.relative(fullTestDir, fullPath).replace(/\\/g, "/");
        const groupPath = path.dirname(relativeToTestRoot).split("/").filter(Boolean);
        const cleanGroup = displayGroupName(groupPath[0] || "General");

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          if (!hasPlaywrightImport(content)) continue;
          let match: RegExpExecArray | null;
          let foundCount = 0;
          TEST_DECLARATION_REGEX.lastIndex = 0;

          while ((match = TEST_DECLARATION_REGEX.exec(content)) !== null) {
            const rawTitle = match[1] || "";
            const line = getLineNumber(content, match.index);
            const title = rawTitle.trim() || `Test at line ${line}`;
            let id = generateTestId(relativeToRoot, title, foundCount, line);
            if (usedIds.has(id)) {
              id = `${id}-${foundCount + 1}`;
            }
            usedIds.add(id);

            descriptors.push({
              id,
              title,
              group: cleanGroup,
              relativePath: relativeToRoot,
              line,
            });
            sourceByPath[relativeToRoot] = content;
            foundCount += 1;
          }

          if (foundCount === 0) {
            const fallbackTitle = path.basename(entry, path.extname(entry));
            let id = generateTestId(relativeToRoot, fallbackTitle, 0, 1);
            if (usedIds.has(id)) {
              id = `${id}-1`;
            }
            usedIds.add(id);

            descriptors.push({
              id,
              title: fallbackTitle,
              group: cleanGroup,
              relativePath: relativeToRoot,
              line: 1,
            });
            sourceByPath[relativeToRoot] = content;
          }
        } catch {
          // ignore unreadable file
        }
      }
    }
  }

  await walkDir(fullTestDir);
  return {
    tests: descriptors,
    sourceByPath,
    scanPathLabel: `${path.basename(workspaceRoot)}/${testDir.replace(/\\/g, "/")}`,
  };
}

export async function buildPlaywrightCatalogFromConfig(
  config: AgentConfig,
): Promise<PlaywrightCatalog> {
  const projects: PlaywrightProjectCatalog[] = [];

  for (const proj of config.projects) {
    if (!proj.playwright || proj.playwright.enabled === false) {
      continue;
    }

    const pw = proj.playwright;
    let scan: PlaywrightScanResult = {
      tests: [],
      sourceByPath: {},
      scanPathLabel: `${path.basename(pw.workspaceRoot)}/${pw.testRoot || "e2e"}`,
    };
    try {
      scan = await scanPlaywrightProject(pw.workspaceRoot, pw.testRoot || "e2e");
    } catch {
      // Keep the project visible so the UI can explain where the Agent scanned.
    }

    const tests = scan.tests;

    const groupMap = new Map<string, PlaywrightTestDescriptor[]>();
    for (const t of tests) {
      const g = groupMap.get(t.group) || [];
      g.push(t);
      groupMap.set(t.group, g);
    }

    const testGroups = Array.from(groupMap.entries()).map(([name, groupTests]) => ({
      name,
      tests: groupTests,
    }));

    const allowed = pw.allowedBrowsers || ["chromium"];
    const capabilities = {
      browsers: {
        chromium: allowed.includes("chromium"),
        firefox: allowed.includes("firefox"),
        webkit: allowed.includes("webkit"),
      },
      headed: pw.allowHeaded ?? true,
      workspaceExecution: pw.allowWorkspaceExecution ?? true,
    };

    projects.push({
      id: proj.id,
      name: proj.name,
      rootLabel: path.basename(pw.workspaceRoot),
      capabilities,
      testGroups,
      tests,
      sourceByPath: scan.sourceByPath,
      scanPathLabel: scan.scanPathLabel,
    });
  }

  return {
    version: crypto
      .createHash("sha256")
      .update(JSON.stringify(projects))
      .digest("hex")
      .slice(0, 16),
    updatedAt: new Date().toISOString(),
    projects,
  };
}

export function detectBrowserCapabilities(
  config?: AgentConfig,
): {
  browsers: { chromium: boolean; firefox: boolean; webkit: boolean };
  headed: boolean;
  workspaceExecution: boolean;
} {
  const allBrowsers = new Set<string>();
  let headedAllowed = true;
  let workspaceAllowed = true;

  if (config) {
    for (const p of config.projects) {
      if (p.playwright) {
        (p.playwright.allowedBrowsers || ["chromium"]).forEach((b) => allBrowsers.add(b));
        if (p.playwright.allowHeaded === false) headedAllowed = false;
        if (p.playwright.allowWorkspaceExecution === false) workspaceAllowed = false;
      }
    }
  } else {
    allBrowsers.add("chromium");
  }

  return {
    browsers: {
      chromium: allBrowsers.has("chromium") || allBrowsers.size === 0,
      firefox: allBrowsers.has("firefox"),
      webkit: allBrowsers.has("webkit"),
    },
    headed: headedAllowed,
    workspaceExecution: workspaceAllowed,
  };
}
