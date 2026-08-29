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

export function generateTestId(relativePath: string, title: string): string {
  const cleanRel = relativePath.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const cleanTitle = title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const hash = crypto.createHash("sha256").update(`${relativePath}:${title}`).digest("hex").slice(0, 8);
  const combined = `${cleanRel}-${cleanTitle}`.replace(/-+/g, "-").slice(0, 48);
  return `${combined}-${hash}`;
}

const TEST_DECLARATION_REGEX = /test(?:\.(?:only|skip|fixme|fail))?\s*\(\s*["'`](.*?)["'`]/g;

export async function scanPlaywrightTests(
  workspaceRoot: string,
  testDir = "e2e",
): Promise<PlaywrightTestDescriptor[]> {
  const fullTestDir = resolveInsideRoot(workspaceRoot, testDir);
  const descriptors: PlaywrightTestDescriptor[] = [];

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
          entry.endsWith(".test.ts") ||
          entry.endsWith(".test.tsx"))
      ) {
        const relativeToRoot = path.relative(workspaceRoot, fullPath).replace(/\\/g, "/");
        const groupName = path.dirname(path.relative(fullTestDir, fullPath)).replace(/\\/g, "/") || "General";
        const cleanGroup = groupName === "." ? "General" : groupName;

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          let match: RegExpExecArray | null;
          let foundCount = 0;

          while ((match = TEST_DECLARATION_REGEX.exec(content)) !== null) {
            const title = match[1];
            descriptors.push({
              id: generateTestId(relativeToRoot, title),
              title,
              group: cleanGroup,
              relativePath: relativeToRoot,
            });
            foundCount += 1;
          }

          if (foundCount === 0) {
            descriptors.push({
              id: generateTestId(relativeToRoot, path.basename(entry, path.extname(entry))),
              title: path.basename(entry, path.extname(entry)),
              group: cleanGroup,
              relativePath: relativeToRoot,
            });
          }
        } catch {
          // ignore unreadable file
        }
      }
    }
  }

  await walkDir(fullTestDir);
  return descriptors;
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
    let tests: PlaywrightTestDescriptor[] = [];
    try {
      tests = await scanPlaywrightTests(pw.workspaceRoot, pw.testRoot || "e2e");
    } catch {
      tests = [];
    }

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
    });
  }

  return {
    version: "2.0.0",
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
