# Complete Browser UAT Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง Playwright UAT ที่บันทึก เรียกซ้ำ และรันได้ทั้ง headless และ headed บน browser ครบทุกฟังก์ชัน `FN-STS-01` ถึง `FN-STS-11` โดยอ้างอิง UAT และ UI จริงของ ProjectSTS

**Architecture:** เก็บ UAT case เป็น manifest ที่ตรวจสอบด้วย Zod แล้ว map แต่ละ case ไปยัง Playwright spec และฟังก์ชันใน `test-automation-map.json` ใช้ role-scoped storage state, fixture IDs จาก environment และ Page Object ขนาดเล็กเพื่อไม่ให้ test ผูกกับ selector เปราะบาง การสร้าง test อัตโนมัติทำจาก manifest และ source evidence แต่ test ที่แก้ข้อมูลจะบันทึกได้เมื่อมี cleanup และผ่าน isolated UAT run เท่านั้น

**Tech Stack:** TypeScript, Playwright 1.55, Next.js 16, Zod 4, Node.js 20+, Morniter Local Agent, ProjectSTS automation map

## Global Constraints

- ห้ามรัน Git commands อัตโนมัติ ผู้ใช้จัดการ add, commit, push และ branch เอง
- เป้าหมายคือ UAT environment เท่านั้น ห้ามรัน mutating scenarios บน production host
- รองรับ `headless`, `headed` และ Morniter interactive mode ด้วย Playwright spec ชุดเดียวกัน
- ใช้ browser-visible locators ตามลำดับ `getByRole`, `getByLabel`, `getByText`, `data-testid`; ห้ามใช้ CSS class ที่สร้างเพื่อ styling
- ห้ามเก็บ username, password, token, student PII หรือ absolute path ใน source, report หรือ browser payload
- ทุก case ต้องมี `uatId`, `functionId`, `role`, `risk`, `spec`, `title` และหลักฐานต้นทาง
- ทุก mutating case ต้องใช้ข้อมูลเฉพาะรอบทดสอบและมี cleanup ที่ตรวจผลได้ แม้ test ล้มเหลว
- ห้ามสร้างชื่อ route, selector หรือ expected result จาก keyword เพียงอย่างเดียว ต้องมีหลักฐานจาก UAT sheet, page/component หรือ API contract
- ตัวเลข UAT 154 และ 178 ในเอกสารเดิมขัดกัน Task 1 ต้องสร้าง canonical inventory และหยุดทันทีเมื่อ reconcile ไม่ได้
- generated specs อยู่ใต้ `frontend/e2e/generated/` เท่านั้น และห้ามเขียนทับ manual spec
- ทุก task จบด้วยคำสั่งทดสอบที่ระบุและการตรวจแบบ headed อย่างน้อยหนึ่ง scenario ต่อกลุ่มฟังก์ชัน

---

## File map

- `E:\ProjectSTS\frontend\e2e\uat\manifest.ts`: schema และ canonical UAT inventory
- `E:\ProjectSTS\frontend\e2e\uat\manifest.test.ts`: ตรวจ ID, function, role, spec และ coverage
- `E:\ProjectSTS\frontend\e2e\fixtures\auth.ts`: login และ storage state ของแต่ละ role
- `E:\ProjectSTS\frontend\e2e\fixtures\uat-data.ts`: อ่าน fixture IDs และสร้าง run suffix โดยไม่เผย secret
- `E:\ProjectSTS\frontend\e2e\pages\*.ts`: browser actions และ assertions ที่ใช้ซ้ำ
- `E:\ProjectSTS\frontend\e2e\generated\fn-sts-XX\*.spec.ts`: executable UAT specs
- `E:\ProjectSTS\frontend\scripts\verify-uat-coverage.ts`: ตรวจว่า manifest ทุก case มี test และ 11 function groups ไม่ตกหล่น
- `E:\ProjectSTS\frontend\playwright.config.ts`: projects, storage state, output และ headed-compatible settings
- `E:\ProjectSTS\test-automation-map.json`: explicit mappings, coverage targets และ recipes
- `E:\project-monitor\docs\superpowers\plans\STATUS.md`: สถานะและหลักฐานหลังผ่านจริง

### Task 1: สร้าง canonical UAT manifest และปิดช่องว่าง 154/178 cases

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\uat\manifest.ts`
- Create: `E:\ProjectSTS\frontend\e2e\uat\manifest.test.ts`
- Create: `E:\ProjectSTS\frontend\scripts\verify-uat-coverage.ts`
- Read: `E:\ProjectSTS\docs\testing\evidence\uat\2026-08-24\uat-baseline.json`
- Read: `E:\ProjectSTS\docs\testing\current-sheet-uat-run.md`
- Modify: `E:\ProjectSTS\frontend\package.json`

**Interfaces:**
- Produces: `UatCase`, `UAT_CASES`, `casesForFunction(functionId)` และ command `npm run test:e2e:coverage`
- Consumes: 11 function IDs จาก `E:\ProjectSTS\test-automation-map.json`

- [ ] **Step 1: เขียน failing manifest tests**

```ts
import { expect, test } from "@playwright/test";
import { UAT_CASES } from "./manifest";

test("UAT manifest has unique IDs and covers every STS function", () => {
  const ids = UAT_CASES.map((item) => item.uatId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(UAT_CASES.map((item) => item.functionId))).toEqual(
    new Set(Array.from({ length: 11 }, (_, index) => `FN-STS-${String(index + 1).padStart(2, "0")}`)),
  );
  expect(UAT_CASES.every((item) => item.evidence.length > 0)).toBe(true);
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail เพราะยังไม่มี manifest**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/uat/manifest.test.ts --config playwright.config.ts`

Expected: FAIL พร้อมข้อความว่า resolve `./manifest` ไม่ได้

- [ ] **Step 3: สร้าง schema และ inventory จาก UAT source จริง**

```ts
import { z } from "zod";

export const UatCaseSchema = z.object({
  uatId: z.string().regex(/^TC-(?:UAT-)?STS-/),
  functionId: z.string().regex(/^FN-STS-(?:0[1-9]|1[01])$/),
  role: z.enum(["platform-admin", "province-officer", "school-admin", "teacher", "director"]),
  risk: z.enum(["read-only", "mutating"]),
  spec: z.string().regex(/^e2e\/generated\/fn-sts-(?:0[1-9]|1[01])\/.+\.spec\.ts$/),
  title: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
});

export type UatCase = z.infer<typeof UatCaseSchema>;
export const UAT_CASES = z.array(UatCaseSchema).parse([
  {
    uatId: "TC-UAT-STS-AUTH-001",
    functionId: "FN-STS-01",
    role: "teacher",
    risk: "read-only",
    spec: "e2e/generated/fn-sts-01/authentication.spec.ts",
    title: "Teacher login succeeds and opens the teacher dashboard",
    evidence: ["docs/testing/current-sheet-uat-run.md#work-packages-detail"],
  },
]);

export function casesForFunction(functionId: string): UatCase[] {
  return UAT_CASES.filter((item) => item.functionId === functionId);
}
```

ขยาย array ด้วยทุก case จาก canonical UAT workbook export โดยคง ID, role, expected result และ evidence ตามต้นฉบับ ห้ามคัดเฉพาะ 38 cases ใน current run หาก baseline ยืนยันว่ามี 178 cases

- [ ] **Step 4: สร้าง coverage verifier**

```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { UAT_CASES } from "../e2e/uat/manifest";

const root = resolve(import.meta.dirname, "..");
const missing = UAT_CASES.filter((item) => !existsSync(resolve(root, item.spec)));
const functions = new Set(UAT_CASES.map((item) => item.functionId));
if (missing.length || functions.size !== 11) {
  console.error(JSON.stringify({ missingSpecs: missing.map((item) => item.uatId), functionCount: functions.size }, null, 2));
  process.exit(1);
}
console.log(`UAT coverage complete: ${UAT_CASES.length} cases across ${functions.size} functions`);
```

เพิ่ม script: `"test:e2e:coverage": "node --experimental-strip-types scripts/verify-uat-coverage.ts"`

- [ ] **Step 5: รัน manifest test และบันทึกจำนวน canonical จริง**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/uat/manifest.test.ts --config playwright.config.ts`

Expected: PASS และทุก ID ไม่ซ้ำ ครบ 11 function groups

### Task 2: สร้าง role authentication fixtures สำหรับ browser UAT

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\fixtures\auth.ts`
- Create: `E:\ProjectSTS\frontend\e2e\auth.setup.ts`
- Create: `E:\ProjectSTS\frontend\e2e\fixtures\auth.spec.ts`
- Modify: `E:\ProjectSTS\frontend\playwright.config.ts`

**Interfaces:**
- Produces: `ROLE_ENV`, `loginAs(page, role)`, storage files `test-results/auth/<role>.json`
- Consumes: `STS_UAT_<ROLE>_USERNAME`, `STS_UAT_<ROLE>_PASSWORD`, `PLAYWRIGHT_BASE_URL`

- [ ] **Step 1: เขียน failing test สำหรับ role credentials และ login redirect**

```ts
import { expect, test } from "@playwright/test";
import { credentialsFor } from "./auth";

test("credentialsFor rejects a missing teacher account", () => {
  expect(() => credentialsFor("teacher", {})).toThrow(/STS_UAT_TEACHER_USERNAME/);
});
```

- [ ] **Step 2: สร้าง fixture โดยใช้ label และ role ที่มีในหน้า login จริง**

```ts
import { expect, type Page } from "@playwright/test";

export const ROLES = ["platform-admin", "province-officer", "school-admin", "teacher", "director"] as const;
export type UatRole = (typeof ROLES)[number];

const PREFIX: Record<UatRole, string> = {
  "platform-admin": "STS_UAT_PLATFORM_ADMIN",
  "province-officer": "STS_UAT_PROVINCE_OFFICER",
  "school-admin": "STS_UAT_SCHOOL_ADMIN",
  teacher: "STS_UAT_TEACHER",
  director: "STS_UAT_DIRECTOR",
};

export function credentialsFor(role: UatRole, env: NodeJS.ProcessEnv = process.env) {
  const prefix = PREFIX[role];
  const username = env[`${prefix}_USERNAME`];
  const password = env[`${prefix}_PASSWORD`];
  if (!username || !password) throw new Error(`${prefix}_USERNAME and ${prefix}_PASSWORD are required`);
  return { username, password };
}

export async function loginAs(page: Page, role: UatRole) {
  const account = credentialsFor(role);
  await page.goto("/login");
  await page.getByLabel(/ชื่อผู้ใช้|username/i).fill(account.username);
  await page.getByLabel(/รหัสผ่าน|password/i).fill(account.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|sign in|login/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}
```

- [ ] **Step 3: เพิ่ม setup projects แยก role ใน Playwright config**

สร้าง setup project หนึ่งตัวที่เรียก `loginAs` ครบทุก role และบันทึก `storageState` ใต้ `test-results/auth` จากนั้นสร้าง Chromium project ต่อ roleด้วย `dependencies: ["auth-setup"]` และ `testMatch` ตามโฟลเดอร์ role

- [ ] **Step 4: ทดสอบ login แบบ headed ด้วยบัญชี UAT จริง**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/auth.setup.ts --project=auth-setup --headed`

Expected: PASS, เปิด browser ให้เห็นการ login และสร้าง storage state 5 ไฟล์โดยไม่มี credential ใน output

### Task 3: สร้าง UAT data contract และ cleanup guard

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\fixtures\uat-data.ts`
- Create: `E:\ProjectSTS\frontend\e2e\fixtures\uat-data.spec.ts`
- Modify: `E:\ProjectSTS\frontend\.env.example`

**Interfaces:**
- Produces: `uatData()`, `uniqueRunValue(prefix)`, `registerCleanup(fn)`, `runCleanup()`
- Consumes: fixture IDs เฉพาะ UAT เช่น school, classroom, student และ case

- [ ] **Step 1: เขียน failing tests สำหรับ URL guard, fixture IDs และ unique suffix**

```ts
test("rejects production and incomplete UAT data", () => {
  expect(() => uatData({ PLAYWRIGHT_BASE_URL: "https://app.projectsts.com" })).toThrow(/production/i);
  expect(() => uatData({ PLAYWRIGHT_BASE_URL: "https://uat.example", STS_UAT_SCHOOL_ID: "" })).toThrow(/STS_UAT_SCHOOL_ID/);
});
```

- [ ] **Step 2: สร้าง typed environment reader และ cleanup stack**

`uatData()` ต้อง validate HTTPS, ปฏิเสธ `projectsts.com`, `api.projectsts.com`, `app.projectsts.com` และคืนค่า fixture IDs แบบ string เท่านั้น `uniqueRunValue()` ใช้ `uat-${Date.now()}-${process.pid}` โดยไม่ใส่ PII

- [ ] **Step 3: เพิ่มชื่อ environment variables โดยไม่ใส่ค่าจริง**

```dotenv
PLAYWRIGHT_BASE_URL=
STS_UAT_SCHOOL_ID=
STS_UAT_CLASSROOM_ID=
STS_UAT_STUDENT_ID=
STS_UAT_CASE_ID=
STS_UAT_FOREIGN_SCHOOL_ID=
```

- [ ] **Step 4: รัน fixture tests**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/fixtures/uat-data.spec.ts`

Expected: PASS และ production URL ถูกปฏิเสธ

### Task 4: ทำ FN-STS-01 Authentication ให้ครบ

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\pages\login.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-01\authentication.spec.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`

**Interfaces:**
- Produces: browser UAT สำหรับ username/password, validation, logout, session persistence และ role boundary
- Consumes: `loginAs`, authentication cases จาก `UAT_CASES`

- [ ] **Step 1: เขียน failing browser test จาก `TC-UAT-STS-AUTH-001`**

```ts
import { expect, test } from "@playwright/test";
import { credentialsFor } from "../../fixtures/auth";

test("TC-UAT-STS-AUTH-001 teacher login opens dashboard", async ({ page }) => {
  const account = credentialsFor("teacher");
  await page.goto("/login");
  await page.getByLabel(/ชื่อผู้ใช้|username/i).fill(account.username);
  await page.getByLabel(/รหัสผ่าน|password/i).fill(account.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|sign in|login/i }).click();
  await expect(page).toHaveURL(/\/teacher\/dashboard$/);
});
```

- [ ] **Step 2: รัน headed และยืนยันว่า selector ตรง UI จริง**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-01/authentication.spec.ts --headed --project=chromium`

Expected: test เปิดหน้า login กรอกข้อมูล และไป `/teacher/dashboard`; หาก label ไม่ตรง ให้แก้ accessibility label ใน product ก่อนแก้ test ไปใช้ CSS selector

- [ ] **Step 3: เพิ่ม AUTH-002 ถึง AUTH-008 และ authentication cases ที่เหลือใน canonical manifest**

แต่ละ test ใช้ `test(<uatId + title>)`; invalid-login test ใช้รหัสสุ่มที่ไม่ log ค่า, logout ตรวจ `/login`, refresh ตรวจ role เดิม, forbidden route ตรวจ redirect หรือหน้า 403 ตาม contract จริง

- [ ] **Step 4: เพิ่ม explicit mapping และรันทั้ง headless/headed**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-01/authentication.spec.ts`

Expected: PASS ทุก FN-STS-01 case

### Task 5: ทำ FN-STS-02 และ FN-STS-03 User, Student และ Classroom

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\pages\admin-users.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\pages\students.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-02\user-management.spec.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-03\students-classrooms.spec.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`

**Interfaces:**
- Produces: role/permission, suspend/reset validation, student search/detail/import และ classroom placement UAT
- Consumes: platform-admin/school-admin states, `uatData()`, cleanup guard

- [ ] **Step 1: เขียน read-only access tests ก่อน**

ตัวอย่าง FN-STS-03:

```ts
test("teacher can open an assigned student profile", async ({ page }) => {
  const { studentId } = uatData();
  await page.goto(`/teacher/students/${studentId}`);
  await expect(page.getByRole("tab", { name: "ข้อมูลทั่วไป" })).toBeVisible();
  await expect(page.getByText("รหัสนักเรียน")).toBeVisible();
});
```

- [ ] **Step 2: เพิ่ม mutating tests พร้อม cleanup**

User create/suspend, classroom placement และ import ต้องสร้างชื่อด้วย `uniqueRunValue`; ลงทะเบียน cleanup ทันทีหลังได้ resource ID และเรียก cleanup ใน `test.afterEach`

- [ ] **Step 3: รันแยกกลุ่มแบบ headed**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-02 e2e/generated/fn-sts-03 --headed --project=chromium`

Expected: PASS และไม่มี test data เหลือหลังจบ

### Task 6: ทำ FN-STS-04 Attendance และ FN-STS-05 Student Cases

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\pages\attendance.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\pages\cases.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-04\attendance.spec.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-05\student-cases.spec.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`

**Interfaces:**
- Produces: attendance status/validation/absence escalation และ teacher/director case lifecycle UAT
- Consumes: teacher/director states, student/classroom fixture, cleanup guard

- [ ] **Step 1: สร้าง case lifecycle test ที่แบ่งขั้นชัดเจน**

```ts
test("TC-UAT-STS-TCASE-003 teacher records case tracking", async ({ page }) => {
  const { caseId } = uatData();
  await page.goto(`/teacher/cases/${caseId}`);
  await page.getByRole("button", { name: /บันทึกการติดตาม/ }).click();
  await page.getByLabel(/รายละเอียด/).fill(uniqueRunValue("browser-uat-tracking"));
  await page.getByRole("button", { name: /บันทึก$/ }).click();
  await expect(page.getByRole("status")).toContainText(/บันทึกสำเร็จ/);
});
```

- [ ] **Step 2: ครอบคลุม negative rules**

ทดสอบ active case ซ้ำ, ปิดโดยไม่มี severity, ปิดโดยไม่มี tracking, HIGH ส่งต่อ director, teacher ปิด HIGH ไม่ได้ และ cross-school access โดยยืนยัน browser-visible error

- [ ] **Step 3: รัน serial เพื่อไม่ให้ fixture ชนกัน**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-04 e2e/generated/fn-sts-05 --workers=1 --headed`

Expected: PASS และ cleanup ผ่านทุก case

### Task 7: ทำ FN-STS-06 Case Reports และ FN-STS-07 Observations

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\pages\reports.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\pages\observations.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-06\case-reports.spec.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-07\observations.spec.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`

**Interfaces:**
- Produces: filter, preview, PDF/XLSX download และ observation timeline UAT
- Consumes: authenticated contexts, `download` event, case/student fixtures

- [ ] **Step 1: เขียน report download test ที่ตรวจไฟล์จริง**

```ts
test("case report exports PDF", async ({ page }) => {
  await page.goto("/province/reports");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /ส่งออก PDF/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(await download.failure()).toBeNull();
});
```

- [ ] **Step 2: เพิ่ม observation create/read/permission cases**

Mutating observation ใช้ run suffix และลบผ่าน UI/API cleanup contract; read-only cases ตรวจ recorded-by, timestamp และ timeline order

- [ ] **Step 3: รัน tests และตรวจ artifacts**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-06 e2e/generated/fn-sts-07 --headed`

Expected: PASS, download สำเร็จ และ trace ถูกเก็บเฉพาะเมื่อ fail

### Task 8: ทำ FN-STS-08 Dashboard และ FN-STS-09 AI Insights

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\pages\dashboard.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\pages\ai-insights.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-08\dashboard.spec.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-09\ai-insights.spec.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`

**Interfaces:**
- Produces: teacher/director/province dashboard filters, URL persistence, metrics, empty/error state และ AI insight governance UAT
- Consumes: role storage states, stable UAT fixtures

- [ ] **Step 1: เขียน URL-persistent dashboard filter test**

```ts
test("TC-UAT-STS-DDASH-005 keeps date filter in URL", async ({ page }) => {
  await page.goto("/director/dashboard");
  await page.getByLabel(/วันที่เริ่มต้น/).fill("2026-08-01");
  await page.getByLabel(/วันที่สิ้นสุด/).fill("2026-08-31");
  await page.getByRole("button", { name: /ค้นหา|ใช้ตัวกรอง/ }).click();
  await expect(page).toHaveURL(/startDate=2026-08-01/);
  await expect(page).toHaveURL(/endDate=2026-08-31/);
});
```

- [ ] **Step 2: ทำ empty/error states ด้วย network interception**

ใช้ `page.route` เฉพาะ browser test เพื่อคืน empty result และ HTTP 500 แล้วตรวจ empty copy, error copy และ Retry โดยไม่เปลี่ยนข้อมูล UAT

- [ ] **Step 3: ทำ AI insight cases แบบ deterministic**

ตรวจ permission, evidence/source presentation, confidence/risk group และ failure fallback จาก fixture ที่กำหนด ห้าม assert ข้อความ generative แบบเต็มประโยค

- [ ] **Step 4: รัน headed**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-08 e2e/generated/fn-sts-09 --headed`

Expected: PASS โดยไม่มี external AI call ที่ทำให้ผลไม่แน่นอน

### Task 9: ทำ FN-STS-10 Platform & Province และ FN-STS-11 Profile

**Files:**
- Create: `E:\ProjectSTS\frontend\e2e\pages\platform.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\pages\profile.page.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-10\platform-province.spec.ts`
- Create: `E:\ProjectSTS\frontend\e2e\generated\fn-sts-11\profile.spec.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`

**Interfaces:**
- Produces: province/school/readiness scope, cross-province isolation, profile read/update และ change-password boundary UAT
- Consumes: platform/province role states, own-user fixture, foreign-school fixture

- [ ] **Step 1: เขียน cross-scope tests**

Province officer ต้องเห็นเฉพาะ province ที่กำหนด, school admin เห็นโรงเรียนตนเอง และ foreign school ID ต้องไม่ปรากฏใน table, URL หรือ response-driven UI

- [ ] **Step 2: เขียน profile tests โดยไม่เผย PII**

ใช้ assertion กับ label และ masked value เท่านั้น การเปลี่ยน profile ใช้ข้อความ run-specific และ cleanup; change-password test ใช้บัญชี disposable เฉพาะ UAT ห้ามเปลี่ยนรหัสของ shared account

- [ ] **Step 3: รัน headed**

Run: `npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-10 e2e/generated/fn-sts-11 --headed`

Expected: PASS และ shared UAT credentials ยังใช้ login ได้หลัง suite จบ

### Task 10: ผูกทุก spec เข้ากับ Morniter และรองรับการเรียกซ้ำ

**Files:**
- Modify: `E:\ProjectSTS\test-automation-map.json`
- Test: `E:\project-monitor\tests\unit\test-agent\project-test-discovery.test.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\uat-test-matcher.test.ts`

**Interfaces:**
- Produces: catalog ที่มีทุก UAT case, function grouping, `generated-playwright` runner และ relative paths
- Consumes: specs จาก Tasks 4-9 และ canonical manifest

- [ ] **Step 1: เขียน failing catalog assertions**

เพิ่ม assertion ว่า catalog มี `FN-STS-01` ถึง `FN-STS-11`, ทุก manifest case map ไป test ID เดียว และไม่มี absolute path ใน payload

- [ ] **Step 2: เพิ่ม explicit mappings และ coverage targets**

ทุก generated spec ต้องมี mapping เช่น:

```json
{
  "path": "frontend/e2e/generated/fn-sts-04/attendance.spec.ts",
  "functionId": "FN-STS-04"
}
```

เพิ่ม mapping ให้ครบ 11 กลุ่ม และสร้าง coverage target ต่อ UAT case จาก manifest export ห้ามใช้ keyword matching เป็น final mapping

- [ ] **Step 3: รัน Agent catalog tests และ build**

Run: `npm --prefix E:\project-monitor test -- tests/unit/test-agent/project-test-discovery.test.ts tests/unit/test-agent/uat-test-matcher.test.ts`

Run: `npm --prefix E:\project-monitor run agent:build`

Expected: PASS และ Agent build exit 0

- [ ] **Step 4: ตรวจ catalog จริง**

Run: `node E:\project-monitor\scripts\smoke-test-live-agent.mjs`

Expected: catalog แสดง generated Playwright ครบ 11 function groups โดยไม่เผย absolute path

### Task 11: เพิ่มคำสั่ง one-click สำหรับ headless และ headed UAT

**Files:**
- Modify: `E:\ProjectSTS\frontend\package.json`
- Modify: `E:\ProjectSTS\frontend\playwright.config.ts`
- Create: `E:\ProjectSTS\frontend\docs\browser-uat.md`

**Interfaces:**
- Produces: `test:uat:browser`, `test:uat:browser:headed`, `test:uat:browser:list`
- Consumes: generated specs และ role projects

- [ ] **Step 1: เพิ่ม scripts**

```json
{
  "test:uat:browser": "playwright test e2e/generated --workers=1",
  "test:uat:browser:headed": "playwright test e2e/generated --workers=1 --headed",
  "test:uat:browser:list": "playwright test e2e/generated --list"
}
```

- [ ] **Step 2: เขียนเอกสารคำสั่งเรียกใช้**

เอกสารต้องระบุการตั้ง environment, รันทั้งหมด, รัน function เดียวด้วย path, รัน case เดียวด้วย `--grep <UAT-ID>`, เลือก browser mode ใน Morniter และตำแหน่ง report โดยไม่ใส่ secret จริง

- [ ] **Step 3: ตรวจ list และ headed smoke**

Run: `npm --prefix E:\ProjectSTS\frontend run test:uat:browser:list`

Expected: จำนวน tests เท่ากับ canonical manifest และไม่มี duplicated UAT ID

Run: `npm --prefix E:\ProjectSTS\frontend run test:uat:browser:headed -- --grep TC-UAT-STS-AUTH-001`

Expected: Chromium เปิดให้เห็น login flow และ test ผ่าน

### Task 12: Full release gate, evidence และปิดแผน

**Files:**
- Modify: `E:\project-monitor\docs\superpowers\plans\STATUS.md`
- Modify: `E:\project-monitor\docs\superpowers\plans\2026-09-07-complete-browser-uat-automation.md`
- Create: `E:\ProjectSTS\docs\testing\evidence\uat-browser\README.md`

**Interfaces:**
- Produces: หลักฐาน coverage, headless result, headed smoke, cleanup และ Morniter execution
- Consumes: ทุก task ก่อนหน้า

- [ ] **Step 1: รัน ProjectSTS static gates**

Run: `npm --prefix E:\ProjectSTS\frontend run lint`

Run: `npm --prefix E:\ProjectSTS\frontend run typecheck`

Run: `npm --prefix E:\ProjectSTS\frontend run build`

Expected: ทุกคำสั่ง exit 0

- [ ] **Step 2: รัน coverage และ browser UAT ทั้งหมดแบบ headless**

Run: `npm --prefix E:\ProjectSTS\frontend run test:e2e:coverage`

Run: `npm --prefix E:\ProjectSTS\frontend run test:uat:browser`

Expected: manifest ทุก case มี spec, 11 function groups ครบ และ browser UAT ผ่านทั้งหมดโดยไม่มี skipped case ที่ไม่ได้ระบุเหตุผล

- [ ] **Step 3: รัน headed smoke อย่างน้อยหนึ่ง case ต่อ function**

Run: `npm --prefix E:\ProjectSTS\frontend run test:uat:browser:headed -- --grep "FN-STS-(01|02|03|04|05|06|07|08|09|10|11)-SMOKE"`

Expected: 11 smoke tests ผ่านและเห็น browser ทำงานจริง

- [ ] **Step 4: รันผ่าน Morniter Local Agent**

เลือก ProjectSTS ใน Test Explorer เลือก generated test หนึ่งรายการต่อ function แล้วรัน Headless จากนั้นรัน `TC-UAT-STS-AUTH-001` แบบ Headed

Expected: job ผ่าน, terminal logs มาแบบ realtime, ผลลัพธ์ถูกบันทึก และเรียก test เดิมซ้ำได้โดยไม่สร้าง Draft ใหม่

- [ ] **Step 5: ตรวจ cleanup และ secret boundary**

ยืนยันว่าไม่มี resource ที่ขึ้นต้น `uat-` จากรอบทดสอบค้างอยู่ ตรวจ Playwright JSON/report และ Morniter payload ว่าไม่มี password, token, PII หรือ absolute path

- [ ] **Step 6: บันทึก evidence และสถานะ**

บันทึกวันที่, canonical case count, passed/failed/skipped, 11 headed smoke results, cleanup result และ Morniter job IDs ใน evidence README และ `STATUS.md` ทำเครื่องหมายแผนเสร็จเมื่อทุก exit criterion ผ่านจริงเท่านั้น

## Exit criteria

- Canonical UAT inventory reconcile กับ source ล่าสุดและไม่มี ID ซ้ำ
- UAT cases ทุก case map ไป executable Playwright test
- `FN-STS-01` ถึง `FN-STS-11` มีอย่างน้อยหนึ่ง headed smoke และ test suite เต็ม
- test เดียวกันรันได้ทั้ง headless, headed และผ่าน Morniter
- role boundaries ครบ platform admin, province officer, school admin, teacher และ director
- mutating cases cleanup สำเร็จและ production denylist ทำงาน
- ไม่มี secret, PII หรือ absolute path ใน code, report และ browser payload
- generated test ถูกบันทึกและเรียกซ้ำได้จาก Test Explorer โดยไม่ต้อง Draft ใหม่

## ตัวอย่างการเรียกใช้หลัง implement

```powershell
# รัน UAT ทั้งหมดเบื้องหลัง
npm --prefix E:\ProjectSTS\frontend run test:uat:browser

# เปิด browser ให้เห็นทุกขั้นตอน
npm --prefix E:\ProjectSTS\frontend run test:uat:browser:headed

# รันเฉพาะ Attendance
npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated/fn-sts-04 --headed

# รันเฉพาะ UAT case
npm --prefix E:\ProjectSTS\frontend exec playwright test e2e/generated --headed --grep TC-UAT-STS-AUTH-001
```
