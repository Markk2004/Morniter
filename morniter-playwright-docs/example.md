# Playwright Automation Workspace — Detailed Examples

This document contains complete, concrete implementation examples for building and testing the **Playwright Automation Workspace** (`/monitor/tests`) in Morniter.

---

## 1. Example UI Page

`src/app/monitor/tests/page.tsx`

```tsx
import { PlaywrightWorkspace } from "@/components/playwright-runner/PlaywrightWorkspace";

export default function PlaywrightTestPage() {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-800/80">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Playwright Automation
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Build, execute and inspect browser automation tests
        </p>
      </div>

      <PlaywrightWorkspace />
    </div>
  );
}
```

---

## 2. Example Workspace Component

`src/components/playwright-runner/PlaywrightWorkspace.tsx`

```tsx
"use client";

import { ExecutionUnlock } from "@/components/test-runner/ExecutionUnlock";
import { AgentStatusBanner } from "@/components/test-runner/AgentStatusBanner";
import { LiveTestTerminal } from "@/components/test-runner/LiveTestTerminal";
import JobHistory from "@/components/test-runner/JobHistory";

import { ProjectSelector } from "./project/ProjectSelector";
import { TestExplorer } from "./explorer/TestExplorer";
import { BrowserSelector } from "./browser/BrowserSelector";
import { RunModeSelector } from "./browser/RunModeSelector";
import { CodeWorkspace } from "./editor/CodeWorkspace";
import { ExecutionToolbar } from "./execution/ExecutionToolbar";
import { BrowserExecutionStatus } from "./browser/BrowserExecutionStatus";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import { usePlaywrightRunner } from "./usePlaywrightRunner";

export function PlaywrightWorkspace() {
  const runner = usePlaywrightRunner();

  if (runner.loadingCatalog) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-400">
        Loading Playwright workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!runner.isUnlocked && (
        <ExecutionUnlock onUnlocked={runner.refreshUnlock} />
      )}

      <AgentStatusBanner presence={runner.presence} />

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <ProjectSelector
            projects={runner.projects}
            value={runner.selectedProjectId}
            onChange={runner.selectProject}
          />

          <BrowserSelector
            selected={runner.selectedBrowsers}
            capabilities={runner.browserCapabilities}
            onToggle={runner.toggleBrowser}
            disabled={runner.isJobRunning}
          />

          <RunModeSelector
            value={runner.runMode}
            headedAvailable={runner.headedAvailable}
            onChange={runner.setRunMode}
            disabled={runner.isJobRunning}
          />

          <TestExplorer
            groups={runner.testGroups}
            selected={runner.selectedTestIds}
            onToggle={runner.toggleTest}
            disabled={runner.isJobRunning}
          />
        </aside>

        <main className="space-y-4">
          <CodeWorkspace
            code={runner.editorCode}
            onChange={runner.setEditorCode}
            dirty={runner.editorDirty}
          />

          <ExecutionToolbar
            canRun={runner.canRun}
            isSubmitting={runner.isSubmitting}
            isJobRunning={runner.isJobRunning}
            onRun={runner.run}
            onCancel={runner.cancelActiveJob}
          />

          <BrowserExecutionStatus results={runner.browserResults} />
        </main>
      </div>

      <LiveTestTerminal lines={runner.terminalLines} />

      {runner.activeJob && (
        <ArtifactPanel artifacts={runner.activeJob.artifacts ?? []} />
      )}

      <JobHistory
        history={runner.history}
        onRefresh={runner.refreshHistory}
      />
    </div>
  );
}
```

---

## 3. Browser Selector Component Example

`src/components/playwright-runner/browser/BrowserSelector.tsx`

```tsx
export type BrowserName = "chromium" | "firefox" | "webkit";

interface Props {
  selected: BrowserName[];
  capabilities?: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  onToggle: (browser: BrowserName) => void;
  disabled?: boolean;
}

const ALL_BROWSERS = [
  { id: "chromium", label: "Chromium" },
  { id: "firefox", label: "Firefox" },
  { id: "webkit", label: "WebKit" },
] as const;

export function BrowserSelector({
  selected,
  capabilities,
  onToggle,
  disabled,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-800 p-4 bg-slate-900/50">
      <h2 className="text-sm font-semibold text-white">Browsers</h2>
      <div className="mt-3 space-y-2">
        {ALL_BROWSERS.map((browser) => {
          const available = capabilities?.[browser.id] !== false;
          return (
            <label
              key={browser.id}
              className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
                checked={selected.includes(browser.id)}
                disabled={disabled || !available}
                onChange={() => onToggle(browser.id)}
              />
              <span>{browser.label}</span>
              {!available && (
                <span className="text-xs text-amber-400 font-mono">
                  (not installed)
                </span>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
```

---

## 4. Browser State Management Example

```tsx
export type BrowserName = "chromium" | "firefox" | "webkit";

const [selectedBrowsers, setSelectedBrowsers] = useState<BrowserName[]>(["chromium"]);

function toggleBrowser(browser: BrowserName) {
  setSelectedBrowsers((current) =>
    current.includes(browser)
      ? current.filter((item) => item !== browser)
      : [...current, browser]
  );
}
```

---

## 5. Run Mode Selector Example

`src/components/playwright-runner/browser/RunModeSelector.tsx`

```tsx
export type RunMode = "headless" | "headed";

interface Props {
  value: RunMode;
  headedAvailable: boolean;
  onChange: (mode: RunMode) => void;
  disabled?: boolean;
}

export function RunModeSelector({
  value,
  onChange,
  headedAvailable,
  disabled,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-800 p-4 bg-slate-900/50">
      <h2 className="text-sm font-semibold text-white">Execution Mode</h2>
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="radio"
            name="run-mode"
            checked={value === "headless"}
            disabled={disabled}
            onChange={() => onChange("headless")}
          />
          <span>Headless</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="radio"
            name="run-mode"
            checked={value === "headed"}
            disabled={disabled || !headedAvailable}
            onChange={() => onChange("headed")}
          />
          <span>Headed</span>
        </label>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Headed mode opens browser windows on the connected Local Agent machine.
        </p>
      </div>
    </section>
  );
}
```

---

## 6. Example Playwright Job Schema

`src/lib/playwright-runner/schemas.ts`

```ts
import { z } from "zod";

const BrowserSchema = z.enum(["chromium", "firefox", "webkit"]);

const BaseSchema = z.object({
  projectId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  browsers: z.array(BrowserSchema).min(1).max(3),
  mode: z.enum(["headless", "headed"]),
});

const ExistingTestSchema = BaseSchema.extend({
  source: z.literal("project-test"),
  testIds: z.array(z.string().min(1).max(128)).min(1).max(50),
});

const WorkspaceSchema = BaseSchema.extend({
  source: z.literal("workspace"),
  code: z.string().min(1).max(200_000),
});

export const CreatePlaywrightJobSchema = z.discriminatedUnion("source", [
  ExistingTestSchema,
  WorkspaceSchema,
]);

// Deduplicate helper
export function sanitizeBrowsers(browsers: z.infer<typeof BrowserSchema>[]): z.infer<typeof BrowserSchema>[] {
  return [...new Set(browsers)];
}
```

---

## 7. Example Existing Test Job Payload

`POST /api/test-runner/jobs`

```json
{
  "projectId": "projectsts",
  "source": "project-test",
  "testIds": [
    "auth-login-valid"
  ],
  "browsers": [
    "chromium",
    "firefox"
  ],
  "mode": "headed"
}
```

---

## 8. Example Workspace Job Payload

`POST /api/test-runner/jobs`

```json
{
  "projectId": "projectsts",
  "source": "workspace",
  "browsers": [
    "chromium"
  ],
  "mode": "headed",
  "code": "import { test, expect } from '@playwright/test';\n\ntest('Login Flow', async ({ page }) => {\n  await page.goto('http://localhost:3000/login');\n  await page.getByLabel('Username').fill('test-user');\n  await page.getByLabel('Password').fill('test-password');\n  await page.getByRole('button', { name: 'Login' }).click();\n  await expect(page).toHaveURL(/dashboard/);\n});"
}
```

---

## 9. Example Code Workspace Content

```typescript
import { test, expect } from "@playwright/test";

test("Login Flow", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Username").fill("test-user");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: /dashboard/i })
  ).toBeVisible();
});
```

> [!NOTE]
> **Credential Security**: Never hardcode production credentials directly in workspace script strings. Use allowlisted environment variables or storage states.

---

## 10. Example Project Agent Configuration

`test-runner.config.local.json` (Local to Agent host):

```json
{
  "agentId": "windows-dev-01",
  "serverUrl": "https://monitor.example.com",
  "agentToken": "${TEST_RUNNER_AGENT_TOKEN}",
  "projects": [
    {
      "id": "projectsts",
      "name": "ProjectSTS",
      "root": "E:\\ProjectSTS",
      "playwright": {
        "enabled": true,
        "testDir": "e2e",
        "config": "playwright.config.ts",
        "allowWorkspaceExecution": true,
        "allowHeaded": true,
        "allowedBaseUrls": [
          "http://localhost:3000",
          "https://staging.example.com"
        ]
      },
      "allowedTestEnv": {
        "STS_UAT_BASE_URL": "${STS_UAT_BASE_URL}",
        "STS_UAT_USERNAME": "${STS_UAT_USERNAME}",
        "STS_UAT_PASSWORD": "${STS_UAT_PASSWORD}"
      }
    }
  ]
}
```

*Note: The absolute filesystem `root` is never published to the browser client.*

---

## 11. Example Agent Path Containment

`agent/src/playwright/validator.ts`

```typescript
import path from "node:path";

export function resolveInsideRoot(root: string, relativePath: string): string {
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes configured project root");
  }

  return resolved;
}
```

*Use this helper for all test files, configurations, and directory resolutions.*

---

## 12. Example Catalog JSON

`GET /api/test-runner/catalog`

```json
{
  "version": "2.0.0",
  "updatedAt": "2026-08-26T16:00:00.000Z",
  "projects": [
    {
      "id": "projectsts",
      "name": "ProjectSTS",
      "capabilities": {
        "workspaceExecution": true,
        "headed": true,
        "browsers": {
          "chromium": true,
          "firefox": true,
          "webkit": true
        }
      },
      "testGroups": [
        {
          "name": "Authentication",
          "tests": [
            {
              "id": "auth-login-valid",
              "title": "Login with valid credentials",
              "relativePath": "e2e/auth/login.spec.ts"
            },
            {
              "id": "auth-logout",
              "title": "Logout",
              "relativePath": "e2e/auth/logout.spec.ts"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 13. Example Test Explorer Component

`src/components/playwright-runner/explorer/TestExplorer.tsx`

```tsx
interface TestItem {
  id: string;
  title: string;
  relativePath: string;
}

interface TestGroup {
  name: string;
  tests: TestItem[];
}

interface Props {
  groups: TestGroup[];
  selected: string[];
  onToggle: (testId: string) => void;
  disabled?: boolean;
}

export function TestExplorer({ groups, selected, onToggle, disabled }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 p-4 bg-slate-900/50">
      <h2 className="text-sm font-semibold text-white">Test Explorer</h2>
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.name} className="space-y-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {group.name}
            </h3>
            <div className="space-y-1.5 pl-2 border-l border-slate-800">
              {group.tests.map((test) => (
                <label
                  key={test.id}
                  className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(test.id)}
                    disabled={disabled}
                    onChange={() => onToggle(test.id)}
                  />
                  <span>{test.title}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## 14. Example Command Builder

`agent/src/playwright/command-builder.ts`

```typescript
export interface ResolvedPlaywrightProject {
  root: string;
  npxExecutable: string;
  safeEnvironment: Record<string, string>;
}

export function buildPlaywrightInvocation(
  project: ResolvedPlaywrightProject,
  specPaths: string[],
  browsers: BrowserName[],
  mode: RunMode
) {
  const command = project.npxExecutable;
  const args = ["playwright", "test", ...specPaths];

  for (const browser of browsers) {
    args.push(`--project=${browser}`);
  }

  if (mode === "headed") {
    args.push("--headed");
  }

  return {
    command,
    args,
    cwd: project.root,
    env: project.safeEnvironment,
  };
}
```

*Important: `specPaths` must derive from resolved catalog IDs, never raw client strings.*

---

## 15. Example Safe Environment Builder

`agent/src/playwright/validator.ts`

```typescript
const BLOCKED_ENV_KEYS = new Set([
  "TEST_RUNNER_AGENT_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
  "SESSION_SIGNING_SECRET",
  "GROUP_ACCESS_PASSWORD_HASH",
  "TEST_RUNNER_PASSWORD_HASH",
]);

export function buildSafeTestEnv(allowed: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test",
  };

  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    result.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  for (const [key, value] of Object.entries(allowed)) {
    if (BLOCKED_ENV_KEYS.has(key)) {
      throw new Error(`Blocked test environment key: ${key}`);
    }
    result[key] = value;
  }

  return result;
}
```

---

## 16. Example Workspace Creation

`agent/src/playwright/workspace.ts`

```typescript
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createWorkspace(jobId: string, code: string) {
  const root = path.join(
    process.env.LOCALAPPDATA ?? os.tmpdir(),
    "Morniter",
    "runs",
    jobId
  );

  await fs.mkdir(root, { recursive: true });

  const specPath = path.join(root, "workspace.spec.ts");
  await fs.writeFile(specPath, code, "utf8");

  return { root, specPath };
}
```

---

## 17. Example Browser Execution Result

```typescript
export interface BrowserExecutionResult {
  browser: "chromium" | "firefox" | "webkit";
  status: "waiting" | "running" | "passed" | "failed" | "cancelled";
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
}
```

Example JSON state:
```json
[
  {
    "browser": "chromium",
    "status": "passed",
    "passed": 3,
    "failed": 0,
    "skipped": 0,
    "durationMs": 8200
  },
  {
    "browser": "firefox",
    "status": "running",
    "passed": 1,
    "failed": 0,
    "skipped": 0
  }
]
```

---

## 18. Example Terminal Output (Passing Run)

```text
[23:21:04] [system] Job queued
[23:21:05] [system] Agent claimed job
[23:21:05] [system] Preparing ProjectSTS
[23:21:06] [system] Browsers: chromium, firefox
[23:21:06] [system] Mode: headed
[23:21:07] [chromium] Starting browser
[23:21:08] [chromium] Running: Login with valid credentials
[23:21:10] [chromium] ✓ Login with valid credentials (2.3s)
[23:21:11] [firefox] Starting browser
[23:21:12] [firefox] Running: Login with valid credentials
[23:21:15] [firefox] ✓ Login with valid credentials (3.1s)
[23:21:15] [system] Collecting artifacts
[23:21:16] [system] Job passed: 2 passed, 0 failed, Duration: 10.8s
```

---

## 19. Example Failure Terminal & Artifact Links

```text
[chromium] Running: Create Student
[chromium] ✗ Create Student
Error: Expected page.getByText("Student created") to be visible
Screenshot: create-student-failed.png
Trace: trace.zip
```

UI Card:
```text
Chromium ✗ Failed  [Open Trace] [View Screenshot] [Watch Video]
```

---

## 20. Example Playwright Project Config

`playwright.config.ts`

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [
    ["line"],
    ["html", { open: "never" }],
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
```

---

## 21. Example `usePlaywrightRunner` Hook Shape

`src/components/playwright-runner/usePlaywrightRunner.ts`

```typescript
export interface UsePlaywrightRunnerResult {
  catalog: PlaywrightCatalog | null;
  presence: AgentPresence | null;
  isUnlocked: boolean;
  selectedProjectId: string | null;
  selectedTestIds: string[];
  selectedBrowsers: BrowserName[];
  runMode: RunMode;
  editorCode: string;
  editorDirty: boolean;
  activeJob: PlaywrightJob | null;
  terminalLines: TestLogLine[];
  history: PlaywrightJob[];
  loadingCatalog: boolean;
  isSubmitting: boolean;
  isJobRunning: boolean;

  selectProject(id: string): void;
  toggleTest(id: string): void;
  toggleBrowser(browser: BrowserName): void;
  setRunMode(mode: RunMode): void;
  setEditorCode(code: string): void;
  loadTestSource(testId: string): Promise<void>;
  run(): Promise<boolean>;
  cancelActiveJob(): Promise<boolean>;
  refreshCatalog(): Promise<void>;
  refreshHistory(): Promise<void>;
  refreshUnlock(): Promise<void>;
}
```

---

## 22. Example Run Validation Logic

```typescript
function canRun(state: RunnerState): boolean {
  if (!state.isUnlocked) return false;
  if (state.presence?.state !== "online") return false;
  if (!state.selectedProjectId) return false;
  if (state.selectedBrowsers.length === 0) return false;

  if (state.source === "project-test" && state.selectedTestIds.length === 0) {
    return false;
  }

  if (state.source === "workspace" && state.editorCode.trim().length === 0) {
    return false;
  }

  return true;
}
```

---

## 23. Example Function Scanner Output (Phase 5)

```json
{
  "groups": [
    {
      "name": "Students",
      "functions": [
        {
          "id": "students-createStudent",
          "name": "createStudent",
          "relativePath": "src/students/createStudent.ts"
        }
      ]
    }
  ]
}
```

---

## 24. Example Generated Automation Skeleton

```typescript
import { test, expect } from "@playwright/test";

test("createStudent automation", async ({ page }) => {
  // Arrange
  await page.goto("/students");

  // Act
  // TODO: describe the UI actions that execute createStudent

  // Assert
  // TODO: verify the expected user-visible outcome
});
```

---

## 25. Example Job History Item Representation

```text
Today 23:21  ProjectSTS  Login Flow      Chromium, Firefox  ✓ Passed  10.8s
Today 22:48  ProjectSTS  Create Student  Chromium           ✗ Failed   6.4s
```

Clicking a history item opens:
- Execution summary metrics
- Terminal snapshot with line sequences
- Per-browser results
- Artifact download links
- Request metadata (excluding all secrets)

---

## 26. Example Security Error Messages

### Path Violation
```text
Execution rejected: Resolved test path is outside the configured project root.
```

### Production Guard
```text
Workspace execution is disabled for the Production target. Use an approved read-only UAT test instead.
```

### Agent Capability Mismatch
```text
WebKit is not installed on the connected Agent. Run Playwright browser installation on the Agent machine.
```

---

## 27. Example End-to-End Execution Flow

```text
User
  │
  ▼
/monitor/tests
  │
  ▼
Execution Unlock (15m JWT Session)
  │
  ▼
Select ProjectSTS
  │
  ▼
Select Login Flow
  │
  ▼
Select Browsers: ☑ Chromium  ☑ Firefox  ☐ WebKit
  │
  ▼
Select Mode: ● Headed
  │
  ▼
Load test source / Edit draft
  │
  ▼
Click [Run ▶]
  │
  ▼
Validated Playwright Job Enqueued in Redis
  │
  ▼
Windows Local Agent Claims Job
  │
  ▼
Creates Temporary Workspace (%LOCALAPPDATA%\Morniter\runs\<jobId>)
  │
  ▼
Playwright Launches Browsers (Chromium -> Firefox)
  │
  ▼
stdout / stderr Streams to Live Terminal
  │
  ▼
Structured Results Emitted
  │
  ▼
Traces / Screenshots / Videos Harvested
  │
  ▼
Job Appears in Job History
```

---

## 28. Recommended First Coding Slice

Begin with a minimal, reliable end-to-end slice:
1. `BrowserSelector` (Chromium + Firefox)
2. `RunModeSelector` (Headless + Headed)
3. Zod Job schema for existing test execution
4. Agent Playwright command builder
5. Execute one existing `.spec.ts`
6. Reuse existing Live Terminal streaming
7. Reuse existing Cancel / Timeout handling
8. Display structured pass/fail results

*Postpone the embedded Code Workspace until this core loop is fully verified and stable, as arbitrary code execution introduces the highest security and isolation requirements.*
