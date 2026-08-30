# ProjectSTS UAT Test Discovery Implementation Plan

> **For agentic workers:** Execute this plan task-by-task and keep each checkbox current. Do not run Git commands; the repository owner handles all Git operations manually.

**Goal:** Scan the real test files inside ProjectSTS, classify them automatically into FN-STS-01 through FN-STS-11, show all matched coverage in Morniter Test Explorer, and generate selectable Playwright tests only for coverage targets that have an approved generation recipe.

**Architecture:** ProjectSTS owns a project-specific `test-automation-map.json` manifest containing UAT taxonomy, scan roots, matching rules, and safe Playwright generation recipes. The Windows Local Agent reads the manifest and ProjectSTS filesystem, keeps absolute paths local, publishes a relative-path catalog to Morniter, and writes generated files only beneath `frontend/e2e/generated`. Morniter displays Playwright tests as selectable and Node/Jest tests as read-only coverage references.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Zod, Next.js, React, Vitest, Testing Library, Playwright, Jest/Nest test metadata

## Global Constraints

- Scan ProjectSTS local files only; do not connect to Google Sheets or Google APIs.
- The UAT taxonomy is FN-STS-01 through FN-STS-11 from the approved STS plan.
- Morniter must not hard-code STS categories; ProjectSTS owns `test-automation-map.json`.
- Never send absolute filesystem paths to the frontend, Redis, logs, or API responses.
- Only `playwright` and `generated-playwright` entries are selectable in the Playwright Test Explorer.
- `node-test`, `jest`, and `jest-e2e` entries are visible coverage references but cannot be run through the Playwright execution endpoint.
- Never overwrite files outside `frontend/e2e/generated`.
- Never delete stale generated files automatically; mark them stale in catalog metadata.
- Generated Playwright requires an allowlisted recipe with route, actions, and assertions. Missing recipes produce a Coverage Gap, not guessed TypeScript.
- All client-supplied IDs and paths remain subject to project allowlists and path containment.
- Do not add raw shell command input to the frontend.
- Do not run `git add`, `git commit`, `git pull`, or `git push`.

---

## File Map

ProjectSTS:

- Create: `E:\ProjectSTS\test-automation-map.json` — STS taxonomy, scan roots, automatic matching rules, and generation recipes.
- Create when recipes require it: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-XX\*.spec.ts` — generated Playwright only.

Morniter Local Agent:

- Modify: `E:\project-monitor\agent\src\types.ts` — discovery, coverage, runner, origin, confidence, and recipe types.
- Modify: `E:\project-monitor\agent\src\config.ts` — optional relative `automationMap` setting.
- Create: `E:\project-monitor\agent\src\automation-map.ts` — manifest schema, loading, containment, and validation.
- Create: `E:\project-monitor\agent\src\project-test-discovery.ts` — bounded multi-runner filesystem discovery.
- Create: `E:\project-monitor\agent\src\uat-test-matcher.ts` — deterministic automatic classification.
- Create: `E:\project-monitor\agent\src\playwright-recipe-generator.ts` — allowlisted recipe-to-spec generation.
- Modify: `E:\project-monitor\agent\src\playwright-catalog.ts` — merge runnable Playwright and read-only coverage entries.
- Modify: `E:\project-monitor\agent\src\playwright-executor.ts` — reject non-Playwright test IDs.

Morniter server and UI:

- Modify: `E:\project-monitor\src\lib\playwright-runner\types.ts` — browser-safe catalog metadata.
- Modify: `E:\project-monitor\src\lib\playwright-runner\schemas.ts` — strict API schemas.
- Modify: `E:\project-monitor\src\lib\playwright-runner\client-validation.ts` — reject non-runnable selections.
- Modify: `E:\project-monitor\src\components\playwright-runner\explorer\TestExplorer.tsx` — taxonomy groups, runner badges, coverage gaps, and disabled coverage rows.
- Modify: `E:\project-monitor\src\components\playwright-runner\PlaywrightWorkspace.tsx` — pass coverage groups to Explorer.
- Modify: `E:\project-monitor\src\components\playwright-runner\usePlaywrightRunner.ts` — select runnable IDs only.

Tests:

- Create: `E:\project-monitor\tests\unit\test-agent\automation-map.test.ts`
- Create: `E:\project-monitor\tests\unit\test-agent\project-test-discovery.test.ts`
- Create: `E:\project-monitor\tests\unit\test-agent\uat-test-matcher.test.ts`
- Create: `E:\project-monitor\tests\unit\test-agent\playwright-recipe-generator.test.ts`
- Modify: `E:\project-monitor\tests\unit\test-agent\config.test.ts`
- Modify: `E:\project-monitor\tests\unit\test-agent\playwright-runner.test.ts`
- Modify: `E:\project-monitor\tests\unit\playwright-runner\schemas.test.ts`
- Modify: `E:\project-monitor\tests\components\playwright-runner\TestExplorer.test.tsx`
- Modify: `E:\project-monitor\tests\components\playwright-runner\PlaywrightWorkspace.test.tsx`
- Modify: `E:\project-monitor\tests\integration\playwright-runner-e2e-flow.test.ts`

---

### Task 1: Add the ProjectSTS Automation Manifest

**Files:**
- Create: `E:\ProjectSTS\test-automation-map.json`
- Modify: `E:\project-monitor\test-runner.config.local.json`
- Modify: `E:\project-monitor\agent\src\config.ts`
- Modify: `E:\project-monitor\agent\src\types.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\config.test.ts`

**Interfaces:**
- Produces: `automationMap?: string` on `AgentPlaywrightProjectConfig` and a ProjectSTS manifest at a relative, contained path.
- Consumed by: `loadAutomationMap`, discovery, matcher, and generator tasks.

- [ ] **Step 1: Write the failing config test**

Add a case to `tests/unit/test-agent/config.test.ts`:

```ts
it("accepts a relative automationMap inside workspaceRoot", () => {
  const config = parseAgentConfig({
    serverUrl: "http://localhost:3000",
    agentToken: "token",
    agentId: "agent-win-1",
    projects: [{
      id: "sts-playwright",
      name: "ProjectSTS",
      presets: [],
      playwright: {
        enabled: true,
        workspaceRoot: "E:\\ProjectSTS",
        testRoot: "frontend/e2e",
        config: "frontend/playwright.config.ts",
        automationMap: "test-automation-map.json",
      },
    }],
  });

  expect(config.projects[0].playwright?.automationMap).toBe("test-automation-map.json");
});

it("rejects an absolute automationMap", () => {
  expect(() => parseAgentConfig({
    serverUrl: "http://localhost:3000",
    agentToken: "token",
    agentId: "agent-win-1",
    projects: [{
      id: "sts-playwright",
      name: "ProjectSTS",
      presets: [],
      playwright: {
        workspaceRoot: "E:\\ProjectSTS",
        automationMap: "C:\\outside.json",
      },
    }],
  })).toThrow(/automationMap must be relative/);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```powershell
npx vitest run tests/unit/test-agent/config.test.ts
```

Expected: failure because `automationMap` is not accepted yet.

- [ ] **Step 3: Add the config field**

Extend `AgentPlaywrightProjectConfig` in `agent/src/types.ts`:

```ts
export interface AgentPlaywrightProjectConfig {
  enabled: boolean;
  workspaceRoot: string;
  testRoot: string;
  config?: string;
  automationMap?: string;
  allowedBrowsers: Array<"chromium" | "firefox" | "webkit">;
  allowHeaded: boolean;
  allowWorkspaceExecution: boolean;
  maxTimeoutSeconds: number;
  envAllowlist: string[];
  allowedBaseUrls: string[];
}
```

Extend `AgentPlaywrightProjectSchema` in `agent/src/config.ts`:

```ts
automationMap: z.string().optional(),
```

Include `automationMap` in the existing relative-path `superRefine` loop:

```ts
for (const [field, value] of [
  ["testRoot", project.testRoot],
  ["config", project.config],
  ["automationMap", project.automationMap],
] as const) {
  if (!value) continue;
  if (path.isAbsolute(value)) {
    ctx.addIssue({
      code: "custom",
      path: [field],
      message: `${field} must be relative to workspaceRoot`,
    });
  }
}
```

- [ ] **Step 4: Create the complete ProjectSTS taxonomy manifest**

Create `E:\ProjectSTS\test-automation-map.json`:

```json
{
  "version": 1,
  "projectId": "sts-playwright",
  "scanRoots": [
    { "path": "frontend/e2e", "runner": "playwright", "executable": true },
    { "path": "frontend/tests", "runner": "node-test", "executable": false },
    { "path": "backend/test", "runner": "jest-e2e", "executable": false },
    { "path": "backend/src", "runner": "jest", "executable": false }
  ],
  "excludeDirectories": [
    "node_modules", ".next", "dist", "coverage", "test-results", "playwright-report", ".git"
  ],
  "generatedRoot": "frontend/e2e/generated",
  "functions": [
    { "id": "FN-STS-01", "name": "Authentication", "keywords": ["auth", "login", "password", "session", "thaid"] },
    { "id": "FN-STS-02", "name": "User Management", "keywords": ["user", "role", "permission", "reset-password", "suspend"] },
    { "id": "FN-STS-03", "name": "Students & Classrooms", "keywords": ["student", "classroom", "placement", "enrollment", "import"] },
    { "id": "FN-STS-04", "name": "Attendance", "keywords": ["attendance", "present", "absent", "leave", "late"] },
    { "id": "FN-STS-05", "name": "Student Cases", "keywords": ["case", "risk", "severity"] },
    { "id": "FN-STS-06", "name": "Case Reports", "keywords": ["case-report", "report", "pdf", "excel", "export"] },
    { "id": "FN-STS-07", "name": "Observations", "keywords": ["observation", "timeline", "recorded-by"] },
    { "id": "FN-STS-08", "name": "Dashboard", "keywords": ["dashboard", "overview", "metric", "chart"] },
    { "id": "FN-STS-09", "name": "AI Insights", "keywords": ["ai-insight", "insight", "trend", "risk-group"] },
    { "id": "FN-STS-10", "name": "Platform & Province", "keywords": ["platform", "province", "school", "readiness"] },
    { "id": "FN-STS-11", "name": "Profile", "keywords": ["profile", "personal", "own-risk", "change-password"] }
  ],
  "explicitMappings": [
    { "path": "frontend/e2e/auth/login.spec.ts", "functionId": "FN-STS-01" },
    { "path": "frontend/e2e/students/access.spec.ts", "functionId": "FN-STS-03" },
    { "path": "frontend/e2e/monitor/navigation.spec.ts", "functionId": "FN-STS-08" }
  ],
  "coverageTargets": [
    { "id": "TC-STS-01-LOGIN", "functionId": "FN-STS-01", "title": "Login flow", "automation": "playwright", "recipeId": "login-page-visible" },
    { "id": "TC-STS-03-STUDENT-ACCESS", "functionId": "FN-STS-03", "title": "Student access", "automation": "playwright", "recipeId": "students-page-visible" },
    { "id": "TC-STS-08-MONITOR-NAV", "functionId": "FN-STS-08", "title": "Monitor navigation", "automation": "playwright", "recipeId": "monitor-page-visible" }
  ],
  "recipes": [
    {
      "id": "login-page-visible",
      "output": "fn-sts-01/login-page-visible.spec.ts",
      "route": "/login",
      "assertions": [{ "kind": "role-visible", "role": "button", "name": "เข้าสู่ระบบ" }]
    },
    {
      "id": "students-page-visible",
      "output": "fn-sts-03/students-page-visible.spec.ts",
      "route": "/students",
      "assertions": [{ "kind": "heading-visible", "name": "นักเรียน" }]
    },
    {
      "id": "monitor-page-visible",
      "output": "fn-sts-08/monitor-page-visible.spec.ts",
      "route": "/monitor",
      "assertions": [{ "kind": "url-matches", "value": "/monitor" }]
    }
  ]
}
```

The three recipes are fallbacks only. Existing explicit Playwright mappings satisfy their targets, so generation must not duplicate those files.

- [ ] **Step 5: Point the local STS project at the manifest**

In `test-runner.config.local.json`, set the STS Playwright block to:

```json
{
  "workspaceRoot": "E:\\ProjectSTS",
  "testRoot": "frontend/e2e",
  "config": "frontend/playwright.config.ts",
  "automationMap": "test-automation-map.json"
}
```

Preserve all existing browser, timeout, environment allowlist, and base URL values.

- [ ] **Step 6: Run config verification**

Run:

```powershell
npx vitest run tests/unit/test-agent/config.test.ts
npm run test-agent:build
```

Expected: both commands pass.

---

### Task 2: Validate and Load the Automation Manifest

**Files:**
- Create: `E:\project-monitor\agent\src\automation-map.ts`
- Modify: `E:\project-monitor\agent\src\types.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\automation-map.test.ts`

**Interfaces:**
- Produces: `loadAutomationMap(workspaceRoot, relativeMapPath): Promise<AutomationMap>`.
- Consumed by: discovery, matcher, generator, and catalog assembly.

- [ ] **Step 1: Define shared Agent types**

Add to `agent/src/types.ts`:

```ts
export type DiscoveredTestRunner = "playwright" | "generated-playwright" | "node-test" | "jest" | "jest-e2e";
export type TestOrigin = "manual" | "generated";
export type MatchMethod = "explicit" | "source-id" | "path" | "title" | "keyword" | "unmatched";

export interface AutomationScanRoot {
  path: string;
  runner: Exclude<DiscoveredTestRunner, "generated-playwright">;
  executable: boolean;
}

export interface AutomationFunctionRule {
  id: string;
  name: string;
  keywords: string[];
}

export interface AutomationRecipeAssertion {
  kind: "role-visible" | "heading-visible" | "text-visible" | "url-matches";
  role?: "button" | "link" | "textbox";
  name?: string;
  value?: string;
}

export interface AutomationRecipe {
  id: string;
  output: string;
  route: string;
  assertions: AutomationRecipeAssertion[];
}

export interface AutomationCoverageTarget {
  id: string;
  functionId: string;
  title: string;
  automation: "playwright" | "unsupported";
  recipeId?: string;
}

export interface AutomationMap {
  version: 1;
  projectId: string;
  scanRoots: AutomationScanRoot[];
  excludeDirectories: string[];
  generatedRoot: string;
  functions: AutomationFunctionRule[];
  explicitMappings: Array<{ path: string; functionId: string }>;
  coverageTargets: AutomationCoverageTarget[];
  recipes: AutomationRecipe[];
}
```

- [ ] **Step 2: Write loader tests**

Create tests that assert valid loading, rejection of unknown function IDs, duplicate IDs, absolute scan roots, `..` traversal, output outside generated root, empty keyword lists, and recipes without assertions.

Use this concrete traversal assertion:

```ts
await expect(loadAutomationMap(tempRoot, "../outside.json"))
  .rejects.toThrow(/escapes workspaceRoot/);
```

Define a minimal valid fixture in the test file:

```ts
function makeValidAutomationMap(): AutomationMap {
  return {
    version: 1,
    projectId: "sts-playwright",
    scanRoots: [{ path: "frontend/e2e", runner: "playwright", executable: true }],
    excludeDirectories: ["node_modules", "dist"],
    generatedRoot: "frontend/e2e/generated",
    functions: [{ id: "FN-STS-01", name: "Authentication", keywords: ["auth", "login"] }],
    explicitMappings: [],
    coverageTargets: [{
      id: "TC-STS-01-LOGIN",
      functionId: "FN-STS-01",
      title: "Login flow",
      automation: "playwright",
      recipeId: "login-page-visible",
    }],
    recipes: [{
      id: "login-page-visible",
      output: "fn-sts-01/login-page-visible.spec.ts",
      route: "/login",
      assertions: [{ kind: "role-visible", role: "button", name: "เข้าสู่ระบบ" }],
    }],
  };
}
```

Use this concrete recipe assertion:

```ts
const invalidMap = makeValidAutomationMap();
invalidMap.recipes = [{
  id: "login-page-visible",
  output: "../../manual.spec.ts",
  route: "/",
  assertions: [],
}];

await expect(writeMapAndLoad(invalidMap))
  .rejects.toThrow(/generatedRoot|assertions/);
```

- [ ] **Step 3: Implement strict Zod validation and containment**

Create `automation-map.ts` with strict schemas and this loader contract:

```ts
export async function loadAutomationMap(
  workspaceRoot: string,
  relativeMapPath: string,
): Promise<AutomationMap> {
  const mapPath = resolveInsideRoot(workspaceRoot, relativeMapPath);
  const raw = JSON.parse(await fs.readFile(mapPath, "utf8"));
  const parsed = AutomationMapSchema.parse(raw);
  validateCrossReferences(parsed);
  validateContainedMapPaths(workspaceRoot, parsed);
  return parsed;
}
```

`validateCrossReferences` must reject mappings and targets whose `functionId` does not exist, duplicate recipe/target/function IDs, missing recipe references, and duplicate explicit paths.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npx vitest run tests/unit/test-agent/automation-map.test.ts
```

Expected: all loader and containment tests pass.

---

### Task 3: Discover ProjectSTS Tests Across Supported Runners

**Files:**
- Create: `E:\project-monitor\agent\src\project-test-discovery.ts`
- Modify: `E:\project-monitor\agent\src\types.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\project-test-discovery.test.ts`

**Interfaces:**
- Consumes: `AutomationMap.scanRoots` and `excludeDirectories`.
- Produces: `discoverProjectTests(workspaceRoot, map): Promise<DiscoveredProjectTest[]>`.

- [ ] **Step 1: Add the discovery result type**

```ts
export interface DiscoveredProjectTest {
  id: string;
  relativePath: string;
  title: string;
  runner: DiscoveredTestRunner;
  executable: boolean;
  origin: TestOrigin;
  sourceIds: string[];
  searchText: string;
}
```

- [ ] **Step 2: Write discovery tests with four runner roots**

Create a temporary workspace containing:

```text
frontend/e2e/auth/login.spec.ts
frontend/e2e/generated/fn-sts-01/generated.spec.ts
frontend/tests/auth-login-contract.test.mjs
backend/test/app.e2e-spec.ts
backend/src/modules/users/users.service.spec.ts
backend/dist/ignored.spec.js
node_modules/ignored.test.js
```

Assert five results, normalized forward-slash relative paths, generated origin detection, and exclusion of `dist` and `node_modules`.

- [ ] **Step 3: Implement bounded recursive discovery**

Use `fs.readdir(..., { withFileTypes: true })`, reject symlinks, skip configured excluded directory names, and accept only:

```ts
const TEST_FILE_PATTERN = /(?:\.e2e-spec|\.spec|\.test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
```

Read at most 256 KiB from each source file for title and ID extraction. Extract:

```ts
const sourceIds = source.match(/(?:FN|TC|TS)-STS-[A-Z0-9-]+/gi) ?? [];
const titleMatches = [...source.matchAll(/(?:test|it|describe)\s*\(\s*["'`]([^"'`]+)["'`]/g)];
```

Set `executable=true` only when the scan root runner is `playwright`. Set `origin="generated"` and runner `generated-playwright` only when the contained relative path starts with the configured generated root.

- [ ] **Step 4: Run discovery tests and Agent build**

Run:

```powershell
npx vitest run tests/unit/test-agent/project-test-discovery.test.ts
npm run test-agent:build
```

Expected: five discovered files, no absolute path in results, and both commands pass.

---

### Task 4: Match Tests Automatically to UAT Functions

**Files:**
- Create: `E:\project-monitor\agent\src\uat-test-matcher.ts`
- Modify: `E:\project-monitor\agent\src\types.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\uat-test-matcher.test.ts`

**Interfaces:**
- Consumes: discovered tests and `AutomationMap`.
- Produces: `matchTestsToUat(tests, map): UatFunctionCoverage[]` with deterministic primary assignment.

- [ ] **Step 1: Add matching output types**

```ts
export interface MatchedProjectTest extends DiscoveredProjectTest {
  functionId: string;
  functionName: string;
  matchedBy: MatchMethod[];
  confidence: "high" | "medium" | "low";
  score: number;
}

export interface CoverageGap {
  targetId: string;
  functionId: string;
  title: string;
  status: "missing-recipe" | "ready-to-generate" | "unsupported" | "stale-generated";
  recipeId?: string;
}

export interface UatFunctionCoverage {
  id: string;
  name: string;
  tests: MatchedProjectTest[];
  gaps: CoverageGap[];
}
```

- [ ] **Step 2: Write deterministic scoring tests**

Assert this precedence:

```text
explicit path = 100
source FN/TC ID = 90
path keyword = 40 per unique keyword
title keyword = 25 per unique keyword
source text keyword = 10 per unique keyword, capped at 30
```

Confidence:

```text
high: score >= 80
medium: score 40..79
low: score 1..39
```

Tie-breaking must use explicit mapping first, then higher score, then manifest function order. A test receives one primary function only so it appears once in Explorer.

- [ ] **Step 3: Implement normalized token matching**

Normalize to lowercase, convert `_`, `-`, `/`, and `\\` to spaces, collapse whitespace, and compare whole tokens where possible. Do not use AI, embeddings, network calls, or fuzzy packages.

Coverage target satisfaction must require at least one matched test with either the target ID in `sourceIds` or an explicit mapping. Keyword-only matches count as function coverage but do not satisfy a specific TC target.

- [ ] **Step 4: Run matcher tests**

Run:

```powershell
npx vitest run tests/unit/test-agent/uat-test-matcher.test.ts
```

Expected: deterministic grouping, stable tie-breaking, and explicit mappings win.

---

### Task 5: Generate Only Recipe-Backed Playwright Coverage Gaps

**Files:**
- Create: `E:\project-monitor\agent\src\playwright-recipe-generator.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\playwright-recipe-generator.test.ts`

**Interfaces:**
- Consumes: `CoverageGap`, `AutomationRecipe`, workspace root, and generated root.
- Produces: `generateMissingPlaywrightTests(args): Promise<GeneratedTestResult[]>`.

- [ ] **Step 1: Write generator safety tests**

Cover these cases:

- `ready-to-generate` with a valid recipe creates one file under generated root.
- Existing generated file with the same generated header is replaced atomically.
- Existing manual file is never changed.
- Missing recipe returns `missing-recipe` without writing.
- Output traversal is rejected.
- A stale generated file is reported but not deleted.

- [ ] **Step 2: Define the generated file header and renderer**

Every generated file must start with:

```ts
// @generated by Morniter Local Agent
// source: test-automation-map.json
// target: TC-STS-01-LOGIN
// recipe: login-page-visible
```

Render only these allowlisted assertions:

```ts
function renderAssertion(assertion: AutomationRecipeAssertion): string {
  switch (assertion.kind) {
    case "role-visible":
      return `await expect(page.getByRole(${JSON.stringify(assertion.role)}, { name: ${JSON.stringify(assertion.name)} })).toBeVisible();`;
    case "heading-visible":
      return `await expect(page.getByRole("heading", { name: ${JSON.stringify(assertion.name)} })).toBeVisible();`;
    case "text-visible":
      return `await expect(page.getByText(${JSON.stringify(assertion.name)})).toBeVisible();`;
    case "url-matches":
      return `await expect(page).toHaveURL(new RegExp(${JSON.stringify(assertion.value)}));`;
  }
}
```

The complete generated test body is:

```ts
import { test, expect } from "@playwright/test";

test("<target ID> <target title>", async ({ page }) => {
  await page.goto("<recipe route>");
  <rendered assertions>
});
```

All inserted strings must use `JSON.stringify`; never concatenate raw manifest text into TypeScript literals.

- [ ] **Step 3: Implement atomic contained writes**

Resolve the output beneath `generatedRoot`, create parent directories, write to `<filename>.tmp`, and rename to the final file. Before replacement, read the existing first line and reject replacement unless it equals `// @generated by Morniter Local Agent`.

- [ ] **Step 4: Validate generated files with Playwright list**

After a generation batch, execute through the existing safe process adapter:

```text
npx playwright test --config frontend/playwright.config.ts --list frontend/e2e/generated
```

Build arguments internally. Do not accept this command from the browser. If validation fails, keep the previous valid file and return the redacted validation error.

- [ ] **Step 5: Run generator tests**

Run:

```powershell
npx vitest run tests/unit/test-agent/playwright-recipe-generator.test.ts
npm run test-agent:build
```

Expected: safe generation passes and manual-file overwrite tests remain rejected.

---

### Task 6: Publish Coverage-Aware Catalog Metadata

**Files:**
- Modify: `E:\project-monitor\agent\src\types.ts`
- Modify: `E:\project-monitor\agent\src\playwright-catalog.ts`
- Modify: `E:\project-monitor\src\lib\playwright-runner\types.ts`
- Modify: `E:\project-monitor\src\lib\playwright-runner\schemas.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\playwright-runner.test.ts`
- Test: `E:\project-monitor\tests\unit\playwright-runner\schemas.test.ts`

**Interfaces:**
- Produces: browser-safe `coverageGroups` while preserving existing `tests` and `testGroups` for runnable Playwright compatibility.
- Consumed by: catalog API and Test Explorer.

- [ ] **Step 1: Add browser-safe descriptor types to Agent and server**

Use the same names in both type modules:

```ts
export type CatalogTestRunner = "playwright" | "generated-playwright" | "node-test" | "jest" | "jest-e2e";

export interface ProjectCoverageTest {
  id: string;
  title: string;
  relativePath: string;
  runner: CatalogTestRunner;
  executable: boolean;
  origin: "manual" | "generated";
  confidence: "high" | "medium" | "low";
  matchedBy: Array<"explicit" | "source-id" | "path" | "title" | "keyword" | "unmatched">;
}

export interface ProjectCoverageGap {
  targetId: string;
  title: string;
  status: "missing-recipe" | "ready-to-generate" | "unsupported" | "stale-generated";
}

export interface ProjectCoverageGroup {
  id: string;
  name: string;
  tests: ProjectCoverageTest[];
  gaps: ProjectCoverageGap[];
}
```

Add `coverageGroups?: ProjectCoverageGroup[]` to the project catalog.

- [ ] **Step 2: Assemble catalog without exposing source or absolute paths**

In `buildPlaywrightCatalogFromConfig`:

1. Load the optional map.
2. Discover and match project tests.
3. Generate only recipe-backed gaps when generation is explicitly enabled by Agent configuration.
4. Re-scan after successful generation.
5. Set `coverageGroups` from all matched test runners.
6. Preserve `tests` and `testGroups` as Playwright-only arrays.
7. Preserve `sourceByPath` only for Playwright files beneath `testRoot`; do not publish Node/Jest source bodies.

- [ ] **Step 3: Extend strict Zod schemas**

Add strict schemas for runner, origin, confidence, match method, gap status, coverage test, gap, and group. Reject absolute `relativePath` values and paths containing `..` segments.

- [ ] **Step 4: Test the real ProjectSTS shape**

The focused Agent test must assert:

```ts
expect(stsProject.tests).toHaveLength(3);
expect(stsProject.coverageGroups?.map((group) => group.id)).toEqual([
  "FN-STS-01", "FN-STS-02", "FN-STS-03", "FN-STS-04", "FN-STS-05",
  "FN-STS-06", "FN-STS-07", "FN-STS-08", "FN-STS-09", "FN-STS-10", "FN-STS-11",
]);
expect(JSON.stringify(stsProject)).not.toContain("E:\\ProjectSTS");
```

Do not equate the number of discovered files with UAT matches. ProjectSTS currently contains more than 300 test files, but the matcher must intentionally filter unrelated files. Assert that discovery sees the broad inventory while the UAT catalog contains more coverage than the three existing Playwright files:

```ts
const discovered = await discoverProjectTests("E:\\ProjectSTS", automationMap);
expect(discovered.length).toBeGreaterThanOrEqual(300);
const coverageCount = stsProject.coverageGroups?.flatMap((group) => group.tests).length ?? 0;
expect(coverageCount).toBeGreaterThan(3);
expect(coverageCount).toBeLessThanOrEqual(discovered.length);
```

- [ ] **Step 5: Run catalog and schema tests**

Run:

```powershell
npx vitest run tests/unit/test-agent/playwright-runner.test.ts tests/unit/playwright-runner/schemas.test.ts
npm run test-agent:build
npm run typecheck
```

Expected: all commands pass and catalog contains no absolute paths.

---

### Task 7: Prevent Non-Playwright Execution and Source Leakage

**Files:**
- Modify: `E:\project-monitor\agent\src\playwright-executor.ts`
- Modify: `E:\project-monitor\src\lib\playwright-runner\client-validation.ts`
- Modify: `E:\project-monitor\src\app\api\playwright-runner\source\route.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\playwright-runner.test.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-source-route.test.ts`

**Interfaces:**
- Consumes: runnable Playwright catalog and read-only coverage metadata.
- Produces: rejection of Node/Jest execution IDs while allowing safe source metadata display.

- [ ] **Step 1: Write rejection tests**

Assert that a job containing a `node-test`, `jest`, or `jest-e2e` ID returns `400 INVALID_TEST_SELECTION`, while manual and generated Playwright IDs remain valid.

- [ ] **Step 2: Validate selections against `project.tests` only**

Do not validate against `coverageGroups`. The authoritative executable set remains:

```ts
const executableIds = new Set(project.tests?.map((test) => test.id) ?? []);
const invalidIds = selectedTestIds.filter((id) => !executableIds.has(id));
```

Return a generic error without echoing unknown IDs or paths.

- [ ] **Step 3: Keep source opening contained**

For Playwright rows, continue loading source through the existing source route and `sourceByPath`. For Node/Jest coverage rows, return metadata-only preview:

```json
{
  "readOnly": true,
  "sourceAvailable": false,
  "message": "Source preview for this runner is not enabled"
}
```

This plan does not expand browser access to arbitrary backend source files.

- [ ] **Step 4: Run security tests**

Run:

```powershell
npx vitest run tests/unit/test-agent/playwright-runner.test.ts tests/integration/playwright-runner-source-route.test.ts
```

Expected: non-Playwright IDs cannot reach execution and no absolute path appears in responses.

---

### Task 8: Redesign Test Explorer for UAT Coverage Groups

**Files:**
- Modify: `E:\project-monitor\src\components\playwright-runner\explorer\TestExplorer.tsx`
- Modify: `E:\project-monitor\src\components\playwright-runner\PlaywrightWorkspace.tsx`
- Modify: `E:\project-monitor\src\components\playwright-runner\usePlaywrightRunner.ts`
- Test: `E:\project-monitor\tests\components\playwright-runner\TestExplorer.test.tsx`
- Test: `E:\project-monitor\tests\components\playwright-runner\PlaywrightWorkspace.test.tsx`

**Interfaces:**
- Consumes: `coverageGroups`, runnable selection IDs, search text, and Playwright source callbacks.
- Produces: grouped UAT Explorer with selectable Playwright and disabled coverage references.

- [ ] **Step 1: Change Explorer props**

```ts
interface TestExplorerProps {
  groups: ProjectCoverageGroup[];
  scanPathLabel?: string;
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onLoadSource: (testId: string) => Promise<void>;
  disabled?: boolean;
}
```

- [ ] **Step 2: Write component tests before UI changes**

Assert this fixture behavior:

```text
FN-STS-01 Authentication
  [ ] login.spec.ts              Playwright
  [ ] generated-login.spec.ts    Generated
  [disabled] auth.test.mjs       Node
  [disabled] auth.e2e-spec.ts    Jest E2E
  Coverage Gap: Password reset   Missing recipe
```

Specific assertions:

- Only two checkboxes exist.
- `Select all` selects only executable rows.
- Node/Jest rows have `aria-disabled="true"` and no checkbox.
- Search matches function name, file path, runner label, title, and target ID.
- Clicking Playwright source calls `onLoadSource`; coverage references do not.
- Confidence badge appears for medium and low matches.

- [ ] **Step 3: Render taxonomy and nested runner sections**

For each function group, partition tests by runner and render labels:

```ts
const RUNNER_LABELS: Record<CatalogTestRunner, string> = {
  playwright: "Playwright",
  "generated-playwright": "Generated Playwright",
  "node-test": "Frontend Node",
  jest: "Backend Jest",
  "jest-e2e": "Backend Jest E2E",
};
```

Runnable condition:

```ts
const runnable = test.executable &&
  (test.runner === "playwright" || test.runner === "generated-playwright");
```

- [ ] **Step 4: Pass coverage groups from workspace**

Use:

```ts
const explorerGroups = runner.currentProject?.coverageGroups ?? [];
```

When no automation map exists, adapt legacy `testGroups` into Playwright-only coverage groups so other projects continue working.

- [ ] **Step 5: Restrict selection helpers to runnable tests**

In `usePlaywrightRunner`, derive all selectable IDs from `currentProject.tests`, not `coverageGroups`, and remove selected IDs that disappear after catalog refresh.

- [ ] **Step 6: Run component tests**

Run:

```powershell
npx vitest run tests/components/playwright-runner/TestExplorer.test.tsx tests/components/playwright-runner/PlaywrightWorkspace.test.tsx
```

Expected: grouping, search, disabled coverage rows, and selection tests pass.

---

### Task 9: Integrate Refresh, Generation, and Catalog Lifecycle

**Files:**
- Modify: `E:\project-monitor\agent\src\runner.ts`
- Modify: `E:\project-monitor\agent\src\playwright-catalog.ts`
- Modify: `E:\project-monitor\src\components\playwright-runner\usePlaywrightRunner.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-e2e-flow.test.ts`

**Interfaces:**
- Consumes: Agent catalog publish loop and browser catalog refresh.
- Produces: bounded re-scan behavior with no additional frontend polling loop.

- [ ] **Step 1: Add catalog fingerprinting inputs**

Fingerprint the automation map content plus discovered relative paths, modification times, sizes, generated status, and matching metadata. Do not hash complete source bodies on every idle poll.

- [ ] **Step 2: Generate only during explicit catalog refresh/startup**

Run discovery and recipe generation when:

- Agent starts;
- automation map fingerprint changes;
- discovered file fingerprint changes; or
- the existing catalog refresh action requests a publish.

Do not generate on every 30-second idle poll.

- [ ] **Step 3: Re-scan once after generation**

Allow at most one generation pass and one re-scan per refresh cycle. If generated output still leaves a gap, publish the gap and stop; never loop generation.

- [ ] **Step 4: Add integration coverage**

Test this sequence:

```text
Agent publishes 11 UAT groups
Explorer catalog includes 3 runnable existing Playwright tests
Node/Jest entries are visible but non-executable
one recipe-backed missing target generates a contained spec
Agent re-scans once
generated test becomes runnable
next unchanged poll does not rewrite or republish the catalog
```

- [ ] **Step 5: Run integration verification**

Run:

```powershell
npx vitest run tests/integration/playwright-runner-e2e-flow.test.ts
npm run test-agent:build
npm run typecheck
```

Expected: all commands pass with one bounded generation cycle.

---

### Task 10: Verify Against the Real ProjectSTS Workspace

**Files:**
- Read: `E:\ProjectSTS\test-automation-map.json`
- Read: `E:\ProjectSTS\frontend\e2e`
- Read: `E:\ProjectSTS\frontend\tests`
- Read: `E:\ProjectSTS\backend\test`
- Read: `E:\ProjectSTS\backend\src`
- Update: `E:\project-monitor\docs\superpowers\plans\STATUS.md`

**Interfaces:**
- Consumes: completed Agent and UI implementation.
- Produces: real catalog evidence and final remaining-work status.

- [ ] **Step 1: Build and start exactly one Local Agent**

Run:

```powershell
npm run test-agent:build
npm run test-agent
```

Expected: Agent starts with `sts-playwright`, loads `test-automation-map.json`, and publishes without exposing absolute paths.

- [ ] **Step 2: Verify catalog API after login**

Check `/api/playwright-runner/catalog` and assert:

```text
project id = sts-playwright
coverageGroups = 11
runnable existing Playwright tests >= 3
coverage references >= 300
every path is relative
every Node/Jest entry has executable=false
```

- [ ] **Step 3: Verify Test Explorer behavior**

In `/monitor/tests`:

```text
Select ProjectSTS
Explorer shows FN-STS-01 through FN-STS-11
Playwright rows have checkboxes
Node/Jest rows show runner badges without checkboxes
Search "auth" filters related functions and files
Select all selects only runnable Playwright
clicking login.spec.ts opens source
switching projects refreshes the catalog and clears selection
```

- [ ] **Step 4: Run one existing Playwright test**

Select `frontend/e2e/auth/login.spec.ts`, Chromium, headless, and Run.

Expected: the Local Agent claims the job, Terminal streams output while running, and the result reaches a terminal status with `logCount > 0`.

- [ ] **Step 5: Verify safe generation without touching manual tests**

Temporarily use a manifest fixture containing one recipe-backed target with no existing explicit/source-ID match. Refresh the catalog and verify one generated file appears below `frontend/e2e/generated`. Restore the production manifest after the check. Confirm hashes or modification times of the three existing manual Playwright files are unchanged.

- [ ] **Step 6: Run the full automated gate**

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run test-agent:build
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 7: Update team status from evidence**

Record actual discovered counts, generated counts, unmatched counts, command results, and real smoke-test status in `STATUS.md`. Do not record credentials, source bodies, or absolute ProjectSTS paths.

---

## Acceptance Criteria

- [ ] ProjectSTS owns `test-automation-map.json` with FN-STS-01 through FN-STS-11.
- [ ] The Local Agent scans the configured ProjectSTS roots without Google Sheet access.
- [ ] Existing Playwright, frontend Node, backend Jest, and backend Jest E2E files are classified automatically.
- [ ] Test Explorer displays all matched files grouped by UAT function and runner.
- [ ] Only existing/generated Playwright rows have selectable checkboxes.
- [ ] Node/Jest rows are visible read-only coverage references.
- [ ] Search filters by function, title, relative path, runner, and target ID.
- [ ] Existing manual tests are never overwritten.
- [ ] Generated files stay beneath `frontend/e2e/generated` and include traceable metadata.
- [ ] Missing coverage without an approved recipe remains a visible gap and creates no guessed test.
- [ ] Recipe-backed gaps generate at most once per refresh cycle and pass `playwright --list`.
- [ ] Execution rejects non-Playwright IDs.
- [ ] No API response, Redis value, browser log, or UI contains an absolute ProjectSTS path.
- [ ] A real ProjectSTS Playwright test runs from Explorer and streams Terminal output.

## Self-Review Result

- Scope coverage: taxonomy ownership, local discovery, multi-runner classification, deterministic matching, safe generation, catalog publication, UI rendering, execution safety, and real verification each have a dedicated task.
- Type consistency: Agent and server use the same runner, origin, match, coverage test, coverage gap, and coverage group names.
- Security coverage: all filesystem writes are contained, browser paths are relative, raw commands are prohibited, manual files cannot be overwritten, and non-Playwright IDs cannot execute.
- Loop protection: generation is limited to one pass plus one re-scan and does not run on unchanged idle polls.
- Placeholder scan: the plan contains no undefined implementation placeholders; unsupported coverage is an explicit product state rather than deferred code.
