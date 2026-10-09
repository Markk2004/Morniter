import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
  AgentConfig,
  PlaywrightCatalog,
  PlaywrightProjectCatalog,
  PlaywrightTestDescriptor,
} from "./types.js";
import { loadAutomationMap } from "./automation-map.js";
import { discoverProjectTests } from "./project-test-discovery.js";
import { matchTestsToUat } from "./uat-test-matcher.js";
import { generateMissingPlaywrightTests } from "./playwright-recipe-generator.js";

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

export function resolveTestGroupName(groupPath: string[], fileName: string): string {
  const baseName = fileName.replace(/\.(spec|test)\.[a-z]+$/i, "").toLowerCase();

  // STS module files follow explicit numeric prefixing or login in sts context
  // ⚠️ Order matters: most-specific checks FIRST before generic "all-in-one"
  if (baseName.includes("00-platform-admin")) {
    return "UAT Script (Platform Admin) · TC-STS-PLATFORM-ADMIN All-in-One";
  }
  if (baseName.includes("00-school-admin")) {
    return "TC-STS-SCHOOL-ADMIN-COMPLETE-E2E: School Admin Full 29-TC Workflow";
  }
  if (baseName.includes("00-school")) {
    return "TC-STS-SCHOOL-DIRECTOR-COMPLETE-E2E: School Complete UAT Workflow (Director & Admin All-in-One)";
  }
  if (baseName.includes("00-teacher")) {
    return "TC-STS-TEACHER-COMPLETE-E2E: Teacher Complete UAT Workflow (Single Function All-in-One)";
  }
  if (baseName.includes("02-dashboard")) {
    return "[UAT ครู] หมวด 2: แดชบอร์ดครูที่ปรึกษา (Dashboard Navigation)";
  }
  if (baseName.includes("03-student")) {
    return "FN-STS-03 · Students & Classrooms (รายชื่อนักเรียนและห้องเรียน)";
  }
  if (baseName.includes("04-attendance")) {
    return "[UAT ครู] หมวด 3: ระบบเช็กชื่อเข้าเรียน (Attendance)";
  }
  if (baseName.includes("05-case")) {
    return "[UAT ครู] หมวด 4: ระบบจัดการเคสผู้เรียน (Student Cases)";
  }
  if (baseName.includes("06-report")) {
    return "FN-STS-06 · Reports & Export (ระบบรายงานสรุปและการส่งออก)";
  }
  if (baseName.includes("07-observation") || baseName.includes("tracking")) {
    return "[UAT ครู] หมวด 5: บันทึกข้อสังเกตและติดตามพฤติกรรม (Observations)";
  }
  if (baseName.includes("08-user")) {
    return "FN-STS-02 · User Management (ระบบจัดการผู้ใช้)";
  }
  if (baseName.includes("09-province") || baseName.includes("platform")) {
    return "FN-STS-10 · Platform & Province (แดชบอร์ดระดับเขตและจังหวัด)";
  }
  if (baseName.includes("10-profile") || baseName.includes("password")) {
    return "FN-STS-11 · Profile & Password (โปรไฟล์ส่วนตัวและการเปลี่ยนรหัสผ่าน)";
  }
  if (baseName.includes("11-ai")) {
    return "[UAT ครู] หมวด 6: ระบบวิเคราะห์และประเมินด้วย AI (AI Insights)";
  }

  const cleanPath = groupPath.filter((p) => p && p !== ".");

  // STS login test (either in e2e/sts or root of test root)
  const isSts =
    cleanPath.some((p) => p.toLowerCase() === "sts") ||
    cleanPath.length === 0 ||
    cleanPath.every((p) => p.toLowerCase() === "specs");
  if (isSts && (baseName.includes("login") || baseName.includes("auth"))) {
    return "[UAT ครู] หมวด 1: ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)";
  }

  // Generic folder-based grouping for standard playwright setups
  const specificFolder = cleanPath.find(
    (p) => p.toLowerCase() !== "specs" && p.toLowerCase() !== "sts",
  );
  if (specificFolder) {
    return displayGroupName(specificFolder);
  }

  return displayGroupName(cleanPath[0] || baseName || "General");
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
        const cleanGroup = resolveTestGroupName(groupPath, entry);

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

    // Coverage discovery is file-based, while Playwright execution resolves
    // declaration-based IDs. Publish the canonical declaration IDs for
    // runnable coverage rows so a selection from Explorer can be executed.
    const playwrightTestsByPath = new Map<string, PlaywrightTestDescriptor[]>();
    for (const test of tests) {
      const current = playwrightTestsByPath.get(test.relativePath) || [];
      current.push(test);
      playwrightTestsByPath.set(test.relativePath, current);
    }

    let coverageGroups: PlaywrightProjectCatalog["coverageGroups"];
    let runnerProfiles: PlaywrightProjectCatalog["runnerProfiles"];
    let testTarget: PlaywrightProjectCatalog["testTarget"];
    let mapRevision: string | undefined;
    const mergedSourceByPath: Record<string, string> = { ...scan.sourceByPath };

    if (pw.automationMap) {
      try {
        const fullMapPath = resolveInsideRoot(pw.workspaceRoot, pw.automationMap);
        const rawMap = await fs.readFile(fullMapPath, "utf8");
        mapRevision = crypto.createHash("sha256").update(rawMap).digest("hex");
        const automationMap = await loadAutomationMap(pw.workspaceRoot, pw.automationMap);
        if (automationMap.testTarget) {
          testTarget = {
            id: automationMap.testTarget.id,
            label: automationMap.testTarget.label,
            allowMutating: automationMap.testTarget.allowMutating,
          };
        }
        runnerProfiles = automationMap.runnerProfiles;
        let discoveryResult = await discoverProjectTests(pw.workspaceRoot, automationMap);
        Object.assign(mergedSourceByPath, discoveryResult.sourceByPath);
        let discovered = discoveryResult.tests;
        let coverage = matchTestsToUat(discovered, automationMap);

        if (pw.generateMissingTests) {
          const gaps = coverage.flatMap((group) => group.gaps);
          const generated = await generateMissingPlaywrightTests({
            workspaceRoot: pw.workspaceRoot,
            map: automationMap,
            gaps,
          });
          if (generated.some((result) => result.status === "generated")) {
            discoveryResult = await discoverProjectTests(pw.workspaceRoot, automationMap);
            Object.assign(mergedSourceByPath, discoveryResult.sourceByPath);
            discovered = discoveryResult.tests;
            coverage = matchTestsToUat(discovered, automationMap);
          }
        }

        coverageGroups = coverage.map((group) => {
          const matchingRule = automationMap.functions.find((f) => f.id === group.id);
          return {
            id: group.id,
            name: group.name,
            functionId: matchingRule?.id ?? group.id,
            functionName: matchingRule?.name ?? group.name,
            tests: group.tests.flatMap((test) => {
            const canonicalTests = test.executable && test.runner === "playwright"
              ? playwrightTestsByPath.get(test.relativePath) || []
              : [];
            if (canonicalTests.length > 0) {
              return canonicalTests.map((canonical) => ({
                id: canonical.id,
                title: canonical.title,
                relativePath: canonical.relativePath,
                runner: test.runner,
                executionProfileId: test.executionProfileId,
                executable: true,
                risk: "read-only" as const,
                origin: test.origin,
                confidence: test.confidence,
                matchedBy: test.matchedBy,
              }));
            }
            return [{
              id: test.id,
              title: test.title,
              relativePath: test.relativePath,
              runner: test.runner,
              executionProfileId: test.executionProfileId,
              executable: test.executable,
              risk: "read-only" as const,
              origin: test.origin,
              confidence: test.confidence,
              matchedBy: test.matchedBy,
            }];
          }),
          gaps: group.gaps.map((gap) => ({
            targetId: gap.targetId,
            title: gap.title,
            status: gap.status,
          })),
        };
      });
      } catch {
        coverageGroups = undefined;
      }
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

    const allowed =
      pw.allowedBrowsers && pw.allowedBrowsers.length > 0
        ? pw.allowedBrowsers
        : ["chromium", "firefox", "webkit", "msedge"];
    const capabilities = {
      browsers: {
        chromium: allowed.includes("chromium"),
        firefox: allowed.includes("firefox"),
        webkit: allowed.includes("webkit"),
        msedge: allowed.includes("msedge"),
      },
      headed: pw.allowHeaded ?? true,
      workspaceExecution: pw.allowWorkspaceExecution ?? true,
    };

    projects.push({
      id: proj.id,
      name: proj.name,
      mapRevision,
      testTarget,
      rootLabel: path.basename(pw.workspaceRoot),
      capabilities,
      runnerProfiles,
      testGroups,
      tests,
      sourceByPath: mergedSourceByPath,
      scanPathLabel: scan.scanPathLabel,
      coverageGroups,
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
  browsers: { chromium: boolean; firefox: boolean; webkit: boolean; msedge: boolean };
  headed: boolean;
  workspaceExecution: boolean;
} {
  const allBrowsers = new Set<string>();
  let headedAllowed = true;
  let workspaceAllowed = true;

  if (config) {
    for (const p of config.projects) {
      if (p.playwright) {
        const pwBrowsers = p.playwright.allowedBrowsers;
        (pwBrowsers && pwBrowsers.length > 0 ? pwBrowsers : ["chromium", "firefox", "webkit", "msedge"]).forEach(
          (b) => allBrowsers.add(b),
        );
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
      msedge: allBrowsers.has("msedge"),
    },
    headed: headedAllowed,
    workspaceExecution: workspaceAllowed,
  };
}
