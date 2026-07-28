# ProjectSTS Aiven `defaultdb` Test Runner Integration Implementation Plan

> **For agentic workers:** Use the existing test-driven workflow and execute these tasks in order. Git operations are intentionally omitted; the repository owner will stage and commit changes manually.

**Goal:** ให้ Local Agent ของ Monitor รันชุดทดสอบ ProjectSTS ผ่าน terminal ได้ โดยให้ Aiven `defaultdb` เป็นฐานสำหรับ E2E ทั้งจาก terminal และ Monitor และรักษา `student_tracking` ไว้เป็นฐานจริงของระบบ

**Architecture:** Monitor จะส่งเพียง `projectId` และ `presetId` เข้า queue เดิม ส่วน Windows Local Agent จะ resolve คำสั่ง, working directory และ environment จาก config ที่อยู่บนเครื่อง agent แล้วรัน ProjectSTS ในเครื่องนั้น Backend E2E จะต่อ Aiven `defaultdb`; production UAT ไม่อยู่ในชุด mutation test และถ้าจะเพิ่มภายหลังต้องเป็น preset read-only แยกต่างหาก

**Tech Stack:** Next.js + TypeScript, Vitest, Zod, Node `child_process` ผ่าน `cross-spawn`, NestJS + TypeORM, PostgreSQL/Aiven, PowerShell, Upstash Redis REST queue

## Global Constraints

- `student_tracking` เป็น production database และห้าม migration, seed, truncate, insert, update หรือ delete จาก test preset
- `defaultdb` เป็น test database เท่านั้น และต้องถูกคัดลอกข้อมูลจาก `student_tracking` ก่อนรัน E2E ครั้งแรก
- Browser payload ต้องมีเพียง `{ projectId, presetId }`; ห้ามรับ `DATABASE_URL`, command, args, cwd หรือ environment จาก browser
- Agent ต้องรัน `shell: false`, จำกัดหนึ่ง job พร้อมกัน และใช้ process-tree termination เดิม
- Aiven connection URI และ password อยู่ใน environment/config local ที่ถูก ignore เท่านั้น ห้ามใส่ใน tracked example, Redis, log หรือหน้าเว็บ
- การ refresh ข้อมูลจาก production ไป `defaultdb` เป็นคำสั่ง manual ที่ต้องรันบนเครื่องผู้ดูแล ไม่เปิดเป็น Monitor preset
- ทุก test guard ต้อง fail closed เมื่อชื่อ database ไม่ตรงกับ target ที่กำหนด
- ห้ามใช้ `defaultdb` เป็น fallback ของ production runtime หรือ deployment config

---

## File Map

### ProjectSTS backend

- Modify `E:\ProjectSTS\backend\src\test\helpers\test-db-guard.ts`: parse database name และตรวจ test target ที่กำหนดจาก environment
- Modify `E:\ProjectSTS\backend\src\test\helpers\test-db-guard.spec.ts`: unit tests สำหรับ `student_tracking_test`, `defaultdb`, production rejection และ malformed URI
- Modify `E:\ProjectSTS\backend\src\test\setup.ts`: โหลด `.env.test` โดยไม่ทับ environment ที่ Local Agent ส่งมา
- Modify `E:\ProjectSTS\backend\src\core\config\typeorm.config.ts`: ใช้ test target เดียวกับ guard และไม่ทับ Aiven URI
- Modify `E:\ProjectSTS\backend\scripts\seed-test-data.ts`: ใช้ target ที่ guard อนุญาตและไม่พิมพ์ connection URI
- Modify `E:\ProjectSTS\backend\scripts\repair-province-dashboard-test-data.ts`: ใช้ target ที่ guard อนุญาต
- Modify `E:\ProjectSTS\backend\package.json`: เอา localhost ที่ hardcode ออกจาก E2E และ migration test commands
- Create `E:\ProjectSTS\backend\.env.test.example`: template สำหรับ Aiven `defaultdb` test database
- Modify `E:\ProjectSTS\backend\docs\TESTING.md`: อธิบาย local test กับ Aiven `defaultdb`
- Modify `E:\ProjectSTS\backend\docs\DEPLOYMENT.md`: คง production target เป็น `student_tracking` และเพิ่มข้อห้ามใช้ `defaultdb` ใน production
- Create `E:\ProjectSTS\backend\scripts\refresh-aiven-test-db.ps1`: manual, fail-closed dump/restore จาก `student_tracking` ไป `defaultdb`
- Create `E:\ProjectSTS\backend\docs\AIVEN-TEST-DATABASE.md`: ขั้นตอนสร้าง/ตรวจ/refresh ฐานทดสอบและการเก็บ secrets

### Project Monitor / Local Agent

- Modify `E:\project-monitor\agent\src\config.ts`: resolve environment references ใน preset โดยไม่ให้ secret ถูกส่งกลับ catalog
- Modify `E:\project-monitor\tests\unit\test-agent\config.test.ts`: test environment expansion และ missing-variable failure
- Modify `E:\project-monitor\agent\test-runner.config.example.json`: เพิ่ม preset สำหรับ ProjectSTS backend E2E ที่ใช้ `defaultdb` ผ่าน `${STS_TEST_DATABASE_URL}`
- Modify `E:\project-monitor\test-runner.config.local.json`: เพิ่มค่าจริงของ Aiven ในไฟล์ ignored บนเครื่อง agent; ห้ามคัดลอกค่าไป tracked file
- Modify `E:\project-monitor\src\components\test-runner\PresetLauncher.tsx` only if catalog copy needs a visible database-safety label; otherwise keep UI unchanged and put the target in preset description
- Modify `E:\project-monitor\tests\components\TestRunnerPanel.test.tsx` only if the visible catalog label is added

---

### Task 1: Make the ProjectSTS test database guard configurable but fail closed

**Files:**

- Modify: `E:\ProjectSTS\backend\src\test\helpers\test-db-guard.ts`
- Modify: `E:\ProjectSTS\backend\src\test\helpers\test-db-guard.spec.ts`
- Modify: `E:\ProjectSTS\backend\src\test\setup.ts`
- Modify: `E:\ProjectSTS\backend\src\core\config\typeorm.config.ts`

**Interfaces:**

```ts
export const DEFAULT_TEST_DATABASE_NAME = 'defaultdb';

export function databaseNameFromUrl(databaseUrl: string): string;

export function assertStudentTrackingTestDatabase(
  databaseUrl?: string,
  expectedDatabaseName?: string,
): void;
```

- `expectedDatabaseName` defaults to `process.env.TEST_DATABASE_NAME ?? DEFAULT_TEST_DATABASE_NAME`.
- `databaseNameFromUrl` must reject an empty or malformed URL instead of returning an empty string.
- `assertStudentTrackingTestDatabase` must reject `student_tracking` when the expected target is `defaultdb`, and reject `defaultdb` when the expected target is `student_tracking_test`.
- Error text must include the actual and expected database names without including the password or complete URI.

- [ ] **Step 1: Add failing guard tests**

Add these cases to `test-db-guard.spec.ts`:

```ts
it('accepts the Aiven defaultdb test database by default', () => {
  expect(() => assertStudentTrackingTestDatabase(
    'postgres://avnadmin:secret@host:26895/defaultdb?sslmode=require',
  )).not.toThrow();
});

it('accepts Aiven defaultdb only when explicitly selected', () => {
  expect(() => assertStudentTrackingTestDatabase(
    'postgres://avnadmin:secret@host:26895/defaultdb?sslmode=require',
    'defaultdb',
  )).not.toThrow();
});

it('rejects production when the test target is defaultdb', () => {
  expect(() => assertStudentTrackingTestDatabase(
    'postgres://avnadmin:secret@host:26895/student_tracking?sslmode=require',
    'defaultdb',
  )).toThrow('defaultdb');
});

it('rejects a missing or malformed database URL', () => {
  expect(() => assertStudentTrackingTestDatabase(undefined)).toThrow('DATABASE_URL');
  expect(() => assertStudentTrackingTestDatabase('not-a-url')).toThrow();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run from `E:\ProjectSTS\backend`:

```powershell
npm test -- --runInBand src/test/helpers/test-db-guard.spec.ts
```

Expected: FAIL because the helper currently hardcodes `student_tracking_test` and does not accept an explicit target.

- [ ] **Step 3: Implement the minimal guard**

Use URL parsing and compare only the pathname database name. Keep the function name for existing imports, but make the expected target explicit through the second argument/environment. Never log `databaseUrl`.

- [ ] **Step 4: Preserve agent-provided environment**

Change both dotenv calls in `src/test/setup.ts` and `src/core/config/typeorm.config.ts` from `override: true` to `override: false`. Load `.env.test` as defaults, then call:

```ts
assertStudentTrackingTestDatabase(
  process.env.DATABASE_URL,
  process.env.TEST_DATABASE_NAME,
);
```

The test process must set `NODE_ENV=test` before the guard runs. TypeORM CLI must apply the same check when `NODE_ENV=test`.

- [ ] **Step 5: Run the focused test and verify it passes**

```powershell
npm test -- --runInBand src/test/helpers/test-db-guard.spec.ts
```

Expected: PASS for all guard cases.

---

### Task 2: Let terminal E2E commands use the selected test database

**Files:**

- Modify: `E:\ProjectSTS\backend\package.json`
- Create: `E:\ProjectSTS\backend\.env.test.example`
- Modify: `E:\ProjectSTS\backend\scripts\seed-test-data.ts`
- Modify: `E:\ProjectSTS\backend\scripts\repair-province-dashboard-test-data.ts`
- Modify: `E:\ProjectSTS\backend\docs\TESTING.md`

**Interfaces:**

- `npm run test:e2e` reads `DATABASE_URL` and `TEST_DATABASE_NAME` from the process environment or `.env.test`; it must not replace them with a localhost URI.
- `npm run migration:run:test` follows the same environment contract.
- Seed and repair scripts call `assertStudentTrackingTestDatabase(process.env.DATABASE_URL, process.env.TEST_DATABASE_NAME)` and keep their existing destructive behavior restricted by that guard.

- [ ] **Step 1: Add the environment template**

Create `.env.test.example` with the shared Aiven test target:

```env
NODE_ENV=test
TEST_DATABASE_NAME=defaultdb
DATABASE_URL=
JWT_SECRET=test-secret-key-for-e2e-only
JWT_EXPIRATION=1d
JWT_REFRESH_SECRET=test-refresh-secret-key-for-e2e-only
JWT_REFRESH_EXPIRATION=7d
```

Document that the real `.env.test` remains ignored and that the Monitor preset overrides these values for Aiven.

- [ ] **Step 2: Remove hardcoded database URLs from package scripts**

Change the scripts to:

```json
{
  "migration:run:test": "cross-env NODE_ENV=test npm run migration:run",
  "test:e2e": "cross-env NODE_ENV=test npm run test:db:guard && jest --config src/test/jest-e2e.json"
}
```

Do not add a script that embeds an Aiven URI. `DATABASE_URL` must come from the local environment or agent preset.

- [ ] **Step 3: Update seed and repair connection messages**

Derive the database name with `databaseNameFromUrl(process.env.DATABASE_URL)` and log only that name, for example `Connecting to test database "defaultdb"...`. Do not print the host, username, query string, or password.

- [ ] **Step 4: Run terminal regression against Aiven `defaultdb`**

From `E:\ProjectSTS\backend`, with the Aiven test URI available in the current PowerShell process:

```powershell
$env:NODE_ENV = 'test'
$env:TEST_DATABASE_NAME = 'defaultdb'
$env:DATABASE_URL = [Environment]::GetEnvironmentVariable('STS_TEST_DATABASE_URL', 'User')
npx jest --runInBand src/test/helpers/test-db-guard.spec.ts
npm run test:e2e -- --runInBand
```

Expected: guard tests pass and the full terminal E2E suite runs against Aiven `defaultdb` without using `student_tracking`.

- [ ] **Step 5: Update testing documentation**

Document two supported modes:

```text
Terminal mode: DATABASE_URL -> defaultdb, TEST_DATABASE_NAME=defaultdb
Monitor mode: DATABASE_URL -> defaultdb, TEST_DATABASE_NAME=defaultdb
Production mode: DATABASE_URL -> student_tracking, NODE_ENV=production, no E2E seed/mutation command
```

State that `test:e2e` starts the ProjectSTS app/test harness locally; the Aiven database is remote, while Monitor only queues the job.

---

### Task 3: Add a manual, fail-closed refresh from production to Aiven `defaultdb`

**Files:**

- Create: `E:\ProjectSTS\backend\scripts\refresh-aiven-test-db.ps1`
- Create: `E:\ProjectSTS\backend\docs\AIVEN-TEST-DATABASE.md`

**Interfaces:**

- Inputs are environment variables `STS_PRODUCTION_DATABASE_URL` and `STS_TEST_DATABASE_URL` plus the required `-Force` switch.
- Source database must parse exactly as `student_tracking`.
- Target database must parse exactly as `defaultdb`.
- The script must stop before `pg_dump` or `pg_restore` if either URL is missing, malformed, points at another database, or `NODE_ENV=production`.
- The script must use a temporary custom-format dump, restore with `--no-owner --no-acl --clean --if-exists`, and remove the temporary file in `finally`.
- The script must not be exposed as an agent preset or invoked from browser input.

- [ ] **Step 1: Add a safe preflight test path**

Implement `-Force` as a required explicit confirmation. Without it, print the source and target database names and exit before any write. Validate `pg_dump`, `pg_restore`, and `psql` with `Get-Command` before creating the dump.

- [ ] **Step 2: Implement the guarded dump/restore**

Use this command shape after validation:

```powershell
pg_dump --format=custom --no-owner --no-acl --dbname=$env:STS_PRODUCTION_DATABASE_URL --file=$dumpPath
pg_restore --clean --if-exists --no-owner --no-acl --dbname=$env:STS_TEST_DATABASE_URL $dumpPath
```

Run a read-only verification after restore:

```powershell
psql --dbname=$env:STS_TEST_DATABASE_URL --tuples-only --no-align --command "SELECT current_database(), to_regclass('public.users'), to_regclass('public.students');"
```

Expected: `defaultdb` plus non-null `users` and `students` relations. Do not print row contents.

- [ ] **Step 3: Document the manual refresh workflow**

Document the exact PowerShell flow. The two user-level environment variables must already be stored in the Windows user environment or a local secret manager; the commands below read them without echoing the values:

```powershell
$env:STS_PRODUCTION_DATABASE_URL = [Environment]::GetEnvironmentVariable('STS_PRODUCTION_DATABASE_URL', 'User')
$env:STS_TEST_DATABASE_URL = [Environment]::GetEnvironmentVariable('STS_TEST_DATABASE_URL', 'User')
if ([string]::IsNullOrWhiteSpace($env:STS_PRODUCTION_DATABASE_URL) -or [string]::IsNullOrWhiteSpace($env:STS_TEST_DATABASE_URL)) { throw 'Aiven database URL environment variables are not configured' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\refresh-aiven-test-db.ps1 -Force
```

The documentation must state that the URLs are read from local user environment variables, never committed, and that a production dump contains real data. Before sharing the test database, rotate or mask credentials and restrict access.

- [ ] **Step 4: Verify the guard blocks dangerous targets**

Run the script without `-Force`, with a target URL ending in `/student_tracking`, and with `NODE_ENV=production`. Expected: it exits before invoking `pg_dump`/`pg_restore` and reports the reason without printing credentials.

---

### Task 4: Add secret-safe Aiven environment references to Local Agent presets

**Files:**

- Modify: `E:\project-monitor\agent\src\config.ts`
- Modify: `E:\project-monitor\tests\unit\test-agent\config.test.ts`
- Modify: `E:\project-monitor\agent\test-runner.config.example.json`
- Modify: `E:\project-monitor\test-runner.config.local.json` (ignored local file only)

**Interfaces:**

```ts
export function expandPresetEnvironment(
  env: Record<string, string>,
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string>;
```

- Expand only `${NAME}` references in preset environment values.
- Throw a configuration error when a referenced variable is missing; do not leave a literal `${NAME}` in a child process environment.
- Resolve the environment before returning `ResolvedPreset` so the catalog still exposes only `commandPreview`, description, and timeout, never environment values.
- Keep `shell: false` and the existing environment merge `{ ...process.env, ...preset.env }`.

- [ ] **Step 1: Add failing agent config tests**

Add cases to `tests/unit/test-agent/config.test.ts`:

```ts
it('expands preset environment references before execution', () => {
  expect(expandPresetEnvironment(
    { NODE_ENV: 'test', DATABASE_URL: '${STS_TEST_DATABASE_URL}' },
    { STS_TEST_DATABASE_URL: 'postgres://secret@host/defaultdb' },
  )).toEqual({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://secret@host/defaultdb',
  });
});

it('rejects a missing environment reference', () => {
  expect(() => expandPresetEnvironment(
    { DATABASE_URL: '${MISSING_DATABASE_URL}' },
    {},
  )).toThrow('MISSING_DATABASE_URL');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```powershell
npm test -- --runInBand tests/unit/test-agent/config.test.ts
```

Expected: FAIL because preset environment values are currently returned unchanged.

- [ ] **Step 3: Implement expansion in `resolvePreset`**

Call `expandPresetEnvironment(preset.env ?? {})` while building `ResolvedPreset`. Do not expose the resolved map from `buildCatalogFromConfig`.

- [ ] **Step 4: Add the Aiven E2E preset to the tracked example**

Add this preset under the existing `student-tracking` project in `agent/test-runner.config.example.json`:

```json
{
  "id": "backend-e2e-aiven",
  "name": "STS Backend E2E (Aiven defaultdb)",
  "description": "Run mutation-capable backend E2E against the Aiven test database defaultdb; never use student_tracking.",
  "command": "npm",
  "args": ["run", "test:e2e"],
  "cwd": "E:\\ProjectSTS\\backend",
  "env": {
    "NODE_ENV": "test",
    "TEST_DATABASE_NAME": "defaultdb",
    "DATABASE_URL": "${STS_TEST_DATABASE_URL}"
  },
  "timeoutSeconds": 900
}
```

Also add `backend-unit`, `frontend-test`, `frontend-typecheck`, `frontend-lint`, and `frontend-build` presets with the existing `npm run` commands, keeping all command arguments fixed in config.

- [ ] **Step 5: Configure the ignored local agent file**

Set `STS_TEST_DATABASE_URL` in the environment that starts the Windows agent. Copy the new example presets into `test-runner.config.local.json` without committing any Aiven URI. Confirm the catalog response contains the new preset ID and description but no `DATABASE_URL` or password.

- [ ] **Step 6: Run the agent config tests**

```powershell
npm test -- --runInBand tests/unit/test-agent/config.test.ts tests/unit/test-agent/executor.test.ts
```

Expected: PASS, including Windows `npm.cmd` resolution and existing cancellation/timeout behavior.

---

### Task 5: Keep the Monitor UI database-safe and add acceptance coverage

**Files:**

- Modify: `E:\project-monitor\src\components\test-runner\PresetLauncher.tsx` only if the preset description needs an explicit safety label
- Modify: `E:\project-monitor\tests\components\TestRunnerPanel.test.tsx` only for the corresponding label assertion
- Modify: `E:\project-monitor\tests\integration\test-runner-agent-routes.test.ts` if catalog sanitization needs a regression case
- Modify: `E:\project-monitor\docs\superpowers\specs\2026-07-28-local-test-runner-agent-design.md` or add a short linked note if the existing design doc needs the `defaultdb` target recorded

**Interfaces:**

- UI run payload remains exactly `{ projectId, presetId }`.
- Catalog response may show `STS Backend E2E (Aiven defaultdb)` and its safety description, but never environment values.
- Production UAT is not enabled by reusing the mutation-capable E2E preset. A future read-only UAT preset must have a separate command and description.

- [ ] **Step 1: Add a catalog sanitization regression**

Assert that `buildCatalogFromConfig` returns `commandPreview`, `name`, `description`, and `timeoutSeconds`, but does not return an `env` property or any Aiven URI.

- [ ] **Step 2: Run integration/component tests**

```powershell
npm test -- --runInBand tests/integration/test-runner-agent-routes.test.ts tests/components/TestRunnerPanel.test.tsx
```

Expected: PASS with only project/preset IDs crossing the API boundary.

---

### Task 6: Verify the complete workflow

**Files:**

- Test only: `E:\project-monitor\tests\unit\test-agent\config.test.ts`, `E:\project-monitor\tests\integration\test-runner-agent-routes.test.ts`, `E:\project-monitor\e2e\test-runner.spec.ts`
- Test only: `E:\ProjectSTS\backend\src\test\helpers\test-db-guard.spec.ts`

- [ ] **Step 1: Verify Aiven database targets without data output**

Use `psql` read-only checks to confirm:

```sql
SELECT current_database();
SELECT to_regclass('public.users'), to_regclass('public.students');
```

Expected: production URI returns `student_tracking`; test URI returns `defaultdb` after refresh.

- [ ] **Step 2: Run the ProjectSTS test suite against Aiven `defaultdb`**

From `E:\ProjectSTS\backend`, with `DATABASE_URL` set only in the current process:

```powershell
$env:NODE_ENV = 'test'
$env:TEST_DATABASE_NAME = 'defaultdb'
$env:DATABASE_URL = $env:STS_TEST_DATABASE_URL
npm run test:db:guard
npm run test:e2e -- --runInBand
```

Expected: guard passes, E2E runs against `defaultdb`, and no log contains a connection password.

- [ ] **Step 3: Start the Local Agent and verify catalog**

Start the agent with the ignored local config and `STS_TEST_DATABASE_URL` in its process environment. Confirm Monitor shows the new `STS Backend E2E (Aiven defaultdb)` preset and leaves Run disabled when the agent is offline.

- [ ] **Step 4: Run one E2E job through Monitor**

Authenticate the execution session, run the preset, observe queued → running → passed/failed, and verify stdout/stderr are streamed without environment dumps. Confirm the job history survives a page reload.

- [ ] **Step 5: Run the existing Monitor validation suite**

From `E:\project-monitor`:

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/test-runner.spec.ts e2e/test-runner-recovery.spec.ts
```

Expected: all existing tests pass, plus the new Aiven-target and catalog-sanitization assertions.

- [ ] **Step 6: Verify production protection**

Attempt to run the test guard with a `student_tracking` URI and `TEST_DATABASE_NAME=defaultdb`. Expected: immediate failure before any test setup. Confirm Render production remains configured with `student_tracking` and no test preset can be selected as a production deployment command.

---

## Self-review checklist

- Production target is consistently `student_tracking`; no task changes deployment to `defaultdb`.
- Aiven test target is consistently `defaultdb`; no task creates `student_tracking_test` on Aiven.
- No third local database is required for the supported workflow; terminal and Monitor both use Aiven `defaultdb` for E2E.
- The only destructive database operation is the manual, `-Force`-protected refresh script, which validates both database names before running.
- No browser/API payload contains credentials, raw commands, cwd, or environment values.
- No tracked file contains an Aiven URI, password, token, or environment dump.
- No schedule, parallel agent, artifact upload, remote shell, or automatic production mutation is introduced.
