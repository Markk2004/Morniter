# ProjectSTS SRS test categories Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with a test checkpoint after each task. Do not run Git commands automatically; the workspace owner handles Git operations manually.

**Goal:** ให้ Monitor แสดงประเภท automated testing, execution test และ UAT พร้อมเลือกกลุ่ม SRS/BR ของ ProjectSTS แล้วส่งงานไปยัง Windows Local Agent แบบ allowlist เท่านั้น

**Architecture:** ProjectSTS จะประกาศ manifest ของ test group ที่มี SRS/BR IDs, Jest file และ test-name pattern ส่วน Local Agent จะเก็บ preset ที่ allowlist ไว้และส่ง catalog metadata ที่ไม่รวม secret ให้ Monitor browser เลือก category/group ได้ Browser ส่งเพียง `projectId` กับ `presetId`; agent เป็นผู้ประกอบคำสั่งและ environment จาก config local โดย execution ใช้ Aiven `defaultdb` และ UAT ใช้ deployment URL แบบ read-only

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Upstash Redis, Node.js Local Agent, Jest/ts-jest, Node test runner และ ProjectSTS PostgreSQL `defaultdb`

## Global Constraints

- `student_tracking` เป็น production database และห้ามใช้กับ mutation test
- execution preset ต้องตั้ง `NODE_ENV=test`, `TEST_DATABASE_NAME=defaultdb` และ `DATABASE_URL=${STS_TEST_DATABASE_URL}`
- UAT preset ต้องเป็น read-only และใช้ `${STS_UAT_BASE_URL}`; ห้ามส่ง database URL ให้ UAT
- browser request รับเฉพาะ `projectId` และ `presetId`
- command, file path, regex และ environment ของ test ต้องมาจาก local agent allowlist
- catalog ห้ามเผยแพร่ค่า environment ที่เป็น secret
- ไม่เพิ่ม dependency ใหม่ถ้า Node test runner หรือ Jest ที่มีอยู่รองรับงานนั้น

---

## File map

### Project Monitor

- Modify `E:\project-monitor\agent\src\types.ts`: ประเภท metadata ของ preset และ job
- Modify `E:\project-monitor\agent\src\config.ts`: Zod validation, catalog projection และ resolved preset metadata
- Modify `E:\project-monitor\src\lib\test-runner\types.ts`: metadata ที่ browser แสดง
- Modify `E:\project-monitor\src\lib\test-runner\store.ts`: คัดลอก metadata เข้า job ที่ persist ใน Redis
- Modify `E:\project-monitor\src\components\test-runner\PresetLauncher.tsx`: category/group selector และการ์ด preset
- Modify `E:\project-monitor\src\components\test-runner\TestRunnerWorkspace.tsx`: summary ของ category, group และ target ใน active job
- Modify `E:\project-monitor\agent\test-runner.config.example.json`: ตัวอย่าง category/preset
- Modify `E:\project-monitor\test-runner.config.local.json`: local presets สำหรับเครื่องผู้ใช้ โดยไม่แสดง token หรือ URI
- Modify `E:\project-monitor\tests\unit\test-agent\config.test.ts`: metadata validation/catalog tests
- Modify `E:\project-monitor\tests\unit\test-runner\schemas.test.ts`: browser payload contract remains ID-only
- Modify `E:\project-monitor\tests\unit\test-runner\store.test.ts`: metadata copied into jobs
- Modify `E:\project-monitor\tests\components\TestRunnerPanel.test.tsx`: category/group selector behavior
- Modify `E:\project-monitor\tests\integration\test-runner-agent-routes.test.ts`: catalog metadata and job result response

### ProjectSTS

- Create `E:\ProjectSTS\backend\src\test\test-group-manifest.ts`: source-of-truth execution groups
- Create `E:\ProjectSTS\backend\src\test\test-group-manifest.spec.ts`: manifest validation tests
- Create `E:\ProjectSTS\frontend\tests\uat\readonly-smoke.test.mjs`: read-only deployment smoke tests
- Modify `E:\ProjectSTS\frontend\package.json`: `test:uat` command
- Modify `E:\ProjectSTS\backend\docs\AIVEN-TEST-DATABASE.md`: category, manifest and target policy
- Modify `E:\ProjectSTS\backend\docs\TESTING.md`: commands and SRS group examples

---

## Task 1: Add metadata types and catalog validation

**Files:**

- Modify: `E:\project-monitor\agent\src\types.ts`
- Modify: `E:\project-monitor\agent\src\config.ts`
- Modify: `E:\project-monitor\src\lib\test-runner\types.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\config.test.ts`

**Interfaces:**

```ts
export type TestCategory = "automated" | "execution" | "uat";
export type TestRisk = "safe" | "mutating" | "read-only";
export type DatabaseTarget = "none" | "defaultdb" | "production";

export interface TestPresetMetadata {
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
}
```

- Extend `AgentPresetConfig` and `ResolvedPreset` with `metadata: TestPresetMetadata`.
- Extend `TestPreset` in both agent and web types with the four metadata fields.
- Add Zod enums and require `srsIds` to be an array of valid `FR-*`, `BR-*`, or `NFR-*` IDs.
- Reject `category: "execution"` unless `risk === "mutating"` and `databaseTarget === "defaultdb"`.
- Reject `category: "uat"` unless `risk === "read-only"` and `databaseTarget === "none"`.
- Reject `databaseTarget: "production"` when `risk === "mutating"`.
- Make `buildCatalogFromConfig()` copy only public metadata, never `env` values.

**Test steps:**

- Add a valid automated preset, an execution/defaultdb preset and a UAT/read-only preset to `config.test.ts`.
- Assert the catalog contains category, SRS IDs, risk and target.
- Assert invalid combinations throw clear Zod errors.
- Run:

```powershell
npx vitest run tests/unit/test-agent/config.test.ts --pool=threads --maxWorkers=1
```

Expected: all config tests pass, including rejection of production mutation metadata.

---

## Task 2: Persist metadata in jobs while keeping browser input ID-only

**Files:**

- Modify: `E:\project-monitor\src\lib\test-runner\types.ts`
- Modify: `E:\project-monitor\src\lib\test-runner\store.ts`
- Test: `E:\project-monitor\tests\unit\test-runner\schemas.test.ts`
- Test: `E:\project-monitor\tests\unit\test-runner\store.test.ts`
- Test: `E:\project-monitor\tests\integration\test-runner-agent-routes.test.ts`

**Interfaces:**

```ts
export interface TestJob {
  // existing fields remain unchanged
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
}
```

- In `enqueueJob()`, copy metadata from the selected catalog preset into the persisted `TestJob`.
- Keep `CreateJobSchema` limited to `{ projectId, presetId }`; reject `category`, `srsIds`, `command`, `args`, `env`, and `testNamePattern` in request bodies.
- Ensure idempotent replay returns the same metadata as the original job.
- Update integration expectations so catalog and job responses expose metadata but never expose environment values.

**Test steps:**

```powershell
npx vitest run tests/unit/test-runner/schemas.test.ts tests/unit/test-runner/store.test.ts tests/integration/test-runner-agent-routes.test.ts --pool=threads --maxWorkers=1
```

Expected: ID-only payload tests pass and job metadata is present in queued and completed responses.

---

## Task 3: Create the ProjectSTS SRS/BR execution manifest

**Files:**

- Create: `E:\ProjectSTS\backend\src\test\test-group-manifest.ts`
- Create: `E:\ProjectSTS\backend\src\test\test-group-manifest.spec.ts`

**Manifest interface:**

```ts
export interface ProjectStsTestGroup {
  id: string;
  name: string;
  description: string;
  category: "execution";
  srsIds: string[];
  files: string[];
  testNamePattern: string;
  risk: "mutating";
  databaseTarget: "defaultdb";
}

export const PROJECTSTS_EXECUTION_GROUPS: readonly ProjectStsTestGroup[] = [];
```

Populate the manifest with stable initial groups from existing E2E `describe` titles:

- `fr-auth-001`, `fr-auth-002`, `fr-auth-003` from `auth.e2e-spec.ts`
- `fr-att-001`, `br-002-003`, `fr-att-002` from `attendance.e2e-spec.ts`
- `fr-case-002-br-004`, `fr-case-003-br-005`, `br-006`, `br-007` from `tracking.e2e-spec.ts` and `cases.e2e-spec.ts`
- `fr-stu-005-010-br-011` from `import.e2e-spec.ts`
- `fr-dbr-002-003` from `reports.e2e-spec.ts`
- `fr-plat-003` and province-scope groups from the platform/province E2E files

Each pattern must match an existing suite/group title. Do not use a user-provided pattern and do not infer a range such as `FR-CASE-001~007` as though it were an exact `FR-CASE-002` match.

**Test steps:**

- Test unique IDs, valid SRS ID format, absolute source file existence and `defaultdb` target.
- Test that every pattern matches at least one Jest test name by running Jest in list mode for each manifest entry.
- Run:

```powershell
npx jest --config src/test/jest-e2e.json --listTests
npx jest --config src/test/jest-e2e.json src/test/e2e/cases.e2e-spec.ts --runInBand --testNamePattern "BR-006"
```

Expected: the second command selects only the BR-006 group and the manifest test reports no stale file or pattern.

---

## Task 4: Add read-only UAT smoke coverage

**Files:**

- Create: `E:\ProjectSTS\frontend\tests\uat\readonly-smoke.test.mjs`
- Modify: `E:\ProjectSTS\frontend\package.json`
- Modify: `E:\project-monitor\agent\test-runner.config.example.json`
- Modify: `E:\project-monitor\test-runner.config.local.json`

**Runtime contract:**

- `STS_UAT_BASE_URL` is required and must be an HTTPS deployment URL.
- `STS_UAT_USERNAME` and `STS_UAT_PASSWORD` are read only by the local agent process and are never included in catalog metadata or logs.
- The test may call login to obtain a session, then may call only GET/HEAD endpoints for the smoke flow.
- The test must fail before making a request if the URL is missing, localhost, or uses a non-HTTPS scheme.

Create a Node test file using the built-in `fetch` and `node:test` that checks health, login, authenticated student list/profile read, dashboard read and reports read. Do not create, update, delete, seed, truncate or reset records.

Add this script:

```json
"test:uat": "node --test tests/uat/readonly-smoke.test.mjs"
```

Add one UAT preset per smoke group, for example `uat-auth-readonly`, `uat-students-readonly`, `uat-dashboard-readonly` and `uat-reports-readonly`, each with `category: "uat"`, `risk: "read-only"`, `databaseTarget: "none"`, and environment references to the three local UAT variables.

**Test steps:**

- Add unit-level checks for missing URL, HTTP URL, localhost URL and mutation method rejection.
- Run the test with a stub HTTP server in a temporary test-only command, then run the real preset only after the deployment URL and read-only credentials are configured.

```powershell
npm run test:uat
```

Expected: no UAT preset runs without the required local variables, and the suite never sends a mutation method.

---

## Task 5: Add category and SRS group presets to the Local Agent

**Files:**

- Modify: `E:\project-monitor\agent\test-runner.config.example.json`
- Modify: `E:\project-monitor\test-runner.config.local.json`
- Modify: `E:\project-monitor\tests\unit\test-agent\config.test.ts`

Add metadata to the existing automated presets:

- backend unit, lint and build: `automated`, `safe`, `none`
- frontend typecheck, lint and build: `automated`, `safe`, `none`

For every manifest entry from Task 3, add an execution preset with:

```json
{
  "command": "npx",
  "args": [
    "jest",
    "--config",
    "src/test/jest-e2e.json",
    "<manifest-file>",
    "--runInBand",
    "--testNamePattern",
    "<manifest-pattern>"
  ],
  "env": {
    "NODE_ENV": "test",
    "TEST_DATABASE_NAME": "defaultdb",
    "DATABASE_URL": "${STS_TEST_DATABASE_URL}"
  }
}
```

The actual file and pattern values must be copied from the ProjectSTS manifest, not typed by the browser. Add all UAT presets from Task 4 with `STS_UAT_BASE_URL`, `STS_UAT_USERNAME` and `STS_UAT_PASSWORD` references, and no `DATABASE_URL`.

**Test steps:**

- Parse both config files and assert every preset has metadata.
- Assert execution presets reference only `${STS_TEST_DATABASE_URL}`.
- Assert UAT presets do not contain `DATABASE_URL` and have read-only metadata.
- Start the agent with a new PowerShell process and verify the catalog contains category and SRS IDs without printing secrets.

```powershell
npm run test-agent:build
npx vitest run tests/unit/test-agent/config.test.ts --pool=threads --maxWorkers=1
```

Expected: config parsing passes and the agent starts with the expanded test database reference only in the child process environment.

---

## Task 6: Add category and SRS selectors to the Test Runner UI

**Files:**

- Modify: `E:\project-monitor\src\components\test-runner\PresetLauncher.tsx`
- Modify: `E:\project-monitor\src\components\test-runner\TestRunnerWorkspace.tsx`
- Modify: `E:\project-monitor\tests\components\TestRunnerPanel.test.tsx`

Implement two controlled selectors above the preset cards:

- category selector with `All`, `Automated testing`, `Execution test`, `UAT`
- SRS/BR group selector derived from the currently selected category and the `srsIds` metadata

Filtering must be client-side over the catalog only. The run action continues to call `onRunPreset(projectId, presetId)` and must not add command or pattern fields to the request.

Each card must show category, SRS/BR IDs, risk and database target. For an execution card, show `Aiven defaultdb`; for UAT, show `Read-only deployment`; for automated, show `No database`.

The active job summary must show the same metadata copied into `TestJob`. A disabled state must appear when the agent is offline, a job is active, or the execution lock is not unlocked.

**Test steps:**

- Render a catalog containing one preset in each category.
- Select `Execution test` and assert only execution cards remain.
- Select an SRS ID and assert only matching cards remain.
- Assert the run callback receives only the two IDs.
- Assert job summary shows category, SRS IDs and target.

```powershell
npx vitest run tests/components/TestRunnerPanel.test.tsx --pool=threads --maxWorkers=1
```

Expected: category/group filtering is visible and the request contract remains ID-only.

---

## Task 7: Update docs and run end-to-end verification

**Files:**

- Modify: `E:\ProjectSTS\backend\docs\AIVEN-TEST-DATABASE.md`
- Modify: `E:\ProjectSTS\backend\docs\TESTING.md`
- Modify: `E:\project-monitor\README.md` if the test runner section needs the three-category workflow

Document:

- how SRS/BR group IDs map to Jest patterns
- why execution uses `defaultdb`
- why UAT is read-only and uses deployment variables
- how to refresh `defaultdb` manually
- how to start/restart the Local Agent after environment changes
- how to select category and group in Monitor

Run the verification sequence:

```powershell
# Project Monitor
npm run test-agent:build
npx vitest run --pool=threads --maxWorkers=1
npm run typecheck

# ProjectSTS backend
npm run build
npx jest --runInBand src/test/helpers/test-db-guard.spec.ts

# Local smoke
npm run test-agent
```

Then manually run one preset from each category through Monitor:

1. one automated preset such as backend unit
2. one execution group such as `BR-006` against `defaultdb`
3. one UAT read-only group against the configured deployment URL

Expected: the job log names the category, SRS/BR group and target; execution never reports `student_tracking`; UAT reports no database target and no mutation request.

## Self-review checklist

- Metadata types are defined once in the agent and mirrored in the web catalog types.
- Browser input remains `{ projectId, presetId }` throughout the plan.
- Every execution group has an explicit file and test-name pattern from ProjectSTS.
- UAT is not mislabeled from existing mutation E2E; it has a separate read-only suite and environment contract.
- No task exposes secrets, adds an arbitrary command input, or changes production deployment configuration.
