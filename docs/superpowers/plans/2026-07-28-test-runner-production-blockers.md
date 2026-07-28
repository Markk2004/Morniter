# Test Runner Production Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิด blocker ที่ยังทำให้ Monitor ไม่พร้อมใช้งานจริง โดยทำให้ local agent รันคำสั่งบน Windows ได้เสถียร, test suite ไม่ timeout จากการเตรียมข้อมูลทดสอบ, lint ผ่าน, หน้า Logs และ Tests แยกหน้าที่ถูกต้อง และตรวจว่า Vercel provider ชี้ไปยังโปรเจกต์ `ststracking` จริง

**Architecture:** คงการรันคำสั่งไว้ที่ local agent ของผู้ใช้ ส่วน Monitor ทำหน้าที่สร้าง job, เก็บสถานะ, แสดงผล และกู้คืนสถานะเมื่อ agent หลุด การแก้รอบนี้ไม่แตะ repository หรือ runtime ของโปรเจกต์ที่ถูก monitor หน้า `/monitor` จะแสดง log อย่างเดียว และหน้า `/monitor/tests` จะใช้ workspace ใหม่สำหรับสั่ง test

**Tech Stack:** Next.js, React, TypeScript, Vitest, Playwright, bcrypt, Upstash Redis, cross-spawn, Vercel API, Render API, Aiven API

## Global Constraints

- ห้ามแก้ไข source, dependency, environment หรือคำสั่ง build ของโปรเจกต์ที่ถูก monitor
- ห้ามเก็บหรือส่งค่า API token, password หรือ secret ลงใน log, response, test artifact หรือไฟล์ plan
- คำสั่ง test ที่รันจริงต้องผ่าน local agent เท่านั้น ไม่ให้ Vercel Function รัน process ของโปรเจกต์ผู้ใช้
- สถานะ job ต้องเป็นผลจาก process จริงและ heartbeat จริง ไม่สร้างผลสำเร็จปลอมเพื่อให้ UI ผ่าน
- การหยุด process ต้องรองรับ Windows และ Unix โดยไม่ทำให้ process ที่จบปกติถูก kill ซ้ำ
- ไม่ปรับ production timeout ให้ยาวขึ้นเพื่อกลบปัญหา test ที่ช้า
- งาน Git เป็นของผู้ใช้ แผนนี้ไม่มีคำสั่ง `git add`, `git commit`, `git push` หรือการเปลี่ยน branch อัตโนมัติ

---

## Task 1: แก้ Windows executor ให้จบงานปกติและหยุดงานได้ถูกสถานะ

ไฟล์ที่เกี่ยวข้อง:

- `agent/src/executor.ts`
- `agent/src/process-adapter.ts`
- `tests/unit/test-agent/executor.test.ts`
- `tests/unit/test-agent/process-adapter.test.ts` ถ้ามีอยู่แล้ว; ถ้าไม่มีให้เพิ่มไฟล์นี้

### ขั้นที่ 1.1 เขียน regression test ให้เห็นปัญหาก่อน

- [ ] เพิ่ม test ที่เรียก `runPreset` ด้วย `command: "npm"`, `args: ["--version"]` และยืนยันว่า promise resolve เป็น `passed`, `exitCode: 0` ภายในเวลาสั้นกว่าค่า timeout ของ test
- [ ] เพิ่ม test ที่ mock หรือ spy การหยุด process เพื่อยืนยันว่า process ที่ส่ง `close` แล้วไม่ถูกเรียก `taskkill.exe` ซ้ำ
- [ ] คง test สำหรับ `AbortSignal` และ preset timeout ไว้ และยืนยันว่าทั้งสองกรณียังเรียกการหยุด process tree และคืนสถานะ `cancelled` กับ `timed_out` ตามลำดับ
- [ ] เพิ่ม test ของ `resolveExecutable` ให้ยืนยันว่า Windows แปลง `npm`, `npx`, `pnpm`, `yarn` เป็น `.cmd` แต่ไม่เปลี่ยนคำสั่งอื่น

รัน:

```powershell
npx vitest run tests/unit/test-agent/executor.test.ts tests/unit/test-agent/process-adapter.test.ts
```

ผลที่คาดไว้ก่อนแก้: test ที่รัน `npm` อาจค้างจน timeout หรือแสดงว่า cleanup หลัง process จบทำให้ promise ไม่เสถียร

### ขั้นที่ 1.2 แก้ lifecycle ของ process

- [ ] แยกเส้นทางจบปกติออกจากเส้นทาง abort และ timeout ให้ชัดเจน
- [ ] ให้ `close` ของ child process เป็นผู้สรุปผลตาม exit code โดยไม่เรียก `terminateProcessTree` หลัง process จบแล้ว
- [ ] ให้ `abort` และ timeout เรียก `terminateProcessTree` ก่อนสรุปผล และยังป้องกัน callback ซ้ำด้วย guard เดิม
- [ ] ล้าง timer และ abort listener ทุกเส้นทาง รวมถึงกรณี spawn error
- [ ] รักษา stdout/stderr callback, redaction, duration และค่า `truncated` ให้ทำงานเหมือนเดิม
- [ ] ใช้ `cross-spawn` และ `shell: false` ต่อไป ห้ามแก้เป็นการต่อ command string หรือเปิด shell แบบกว้าง

### ขั้นที่ 1.3 ตรวจผล

- [ ] รัน targeted tests ซ้ำจนผ่าน
- [ ] รัน `npm run test-agent:build`
- [ ] รัน `npm run typecheck`

จุดผ่านงาน: `npm --version` ผ่านบน Windows, timeout/cancel จบได้จริง, ไม่มี child process ค้าง และไม่มีการ kill process ที่จบปกติ

## Task 2: ทำ auth integration test ให้ deterministic

ไฟล์ที่เกี่ยวข้อง:

- `tests/integration/test-runner-auth-route.test.ts`

### ขั้นที่ 2.1 ลดงาน bcrypt ที่ไม่จำเป็นใน test

- [ ] แทนการเรียก `bcrypt.hash` ในทุก `beforeEach` ด้วย test-only hash แบบคงที่ของรหัส `execute-secret-123`
- [ ] ใช้ hash cost ต่ำเฉพาะใน test เพื่อไม่ให้การเตรียม fixture แข่งกับ test timeout
- [ ] ห้ามเปลี่ยน cost หรือ policy ของ hash ที่ใช้ใน production
- [ ] คงการทดสอบ wrong password, correct password, missing auth และ token ที่ไม่ถูกต้องไว้ครบ

ค่า hash ที่ใช้ใน test:

```ts
const VALID_PASSWORD_HASH =
  "$2b$04$RlXxHNPOt0IMHz0F7KuhYu0NsEzLhUMeoeexhqPWv9e6fDGITXvz2";
```

### ขั้นที่ 2.2 ตรวจผล

- [ ] รัน `npx vitest run tests/integration/test-runner-auth-route.test.ts --reporter=verbose`
- [ ] รันไฟล์เดิมซ้ำหลายรอบเพื่อยืนยันว่าไม่ขึ้นกับเวลาของ bcrypt หรือความเร็วเครื่อง
- [ ] รัน `npm run test` และยืนยันว่าไม่มี auth case ใดเกินค่า timeout 5 วินาที

จุดผ่านงาน: auth test ผ่านโดยไม่ต้องเพิ่ม timeout และ production code ยังใช้การตรวจรหัสผ่านเดิม

## Task 3: แก้ lint ให้ไม่อ่าน generated artifact ที่ไม่มีอยู่

ไฟล์ที่เกี่ยวข้อง:

- `eslint.config.mjs`

### ขั้นที่ 3.1 เพิ่ม ignore สำหรับไฟล์ที่สร้างจากการทดสอบ

- [ ] เพิ่ม ignore สำหรับ `test-results/**`
- [ ] เพิ่ม ignore สำหรับ `playwright-report/**`
- [ ] เพิ่ม ignore สำหรับ `coverage/**`
- [ ] คง ignore ของ `.next/**`, `out/**`, `build/**`, `next-env.d.ts` และ `agent/dist/**` ไว้
- [ ] ไม่แก้ source เพื่อหลบ lint error และไม่สร้าง directory เปล่าเพื่อกลบปัญหา path

### ขั้นที่ 3.2 ตรวจผล

- [ ] รัน `npm run lint`
- [ ] รัน `npm run typecheck`

จุดผ่านงาน: ESLint เริ่มทำงานและจบด้วย exit code 0 โดยไม่ฟ้อง `ENOENT` ที่ `test-results`

## Task 4: ต่อหน้า production ให้ใช้ workspace ใหม่และแยก Logs ออกจาก Tests

ไฟล์ที่เกี่ยวข้อง:

- `src/app/monitor/tests/page.tsx`
- `src/components/monitor/MonitorDashboard.tsx`
- `src/components/monitor/MonitorShell.tsx`
- `src/components/test-runner/TestRunnerWorkspace.tsx`
- `src/components/test-runner/TestRunnerPanel.tsx`
- `tests/components/TestRunnerPanel.test.tsx`
- เพิ่ม `tests/components/TestRunnerWorkspace.test.tsx` หากยังไม่มี
- E2E ที่เกี่ยวข้องกับ `/monitor` และ `/monitor/tests`

### ขั้นที่ 4.1 เขียน test ของการแยกหน้า

- [ ] เพิ่ม component test ที่ยืนยันว่า `/monitor/tests` แสดง `TestRunnerWorkspace`, preset selector, command input, run button, สถานะ running และ terminal output
- [ ] เพิ่มหรือปรับ test ที่ยืนยันว่า `/monitor` ไม่มี `TestRunnerPanel`, ไม่มี command input และไม่ยิง endpoint สร้าง test job เมื่อเปิดหน้า log
- [ ] คง test เรื่อง auth redirect และ generic error ของ wrong password ไว้

รัน:

```powershell
npx vitest run tests/components/TestRunnerWorkspace.test.tsx tests/components/TestRunnerPanel.test.tsx
```

ผลที่คาดไว้ก่อนแก้: หน้า Tests ยัง render component เก่า หรือหน้า Logs ยังมี test runner ปนอยู่

### ขั้นที่ 4.2 เปลี่ยน wiring

- [ ] เปลี่ยน `src/app/monitor/tests/page.tsx` ให้ import และ render `TestRunnerWorkspace`
- [ ] ลบ import และ render ของ `TestRunnerPanel` จาก `MonitorDashboard`
- [ ] ให้ `MonitorDashboard` รับผิดชอบ log/status เท่านั้น และให้ navigation อยู่ใน `MonitorShell`
- [ ] ตรวจ active tab จาก pathname ให้ `/monitor` เป็น Logs และ `/monitor/tests` เป็น Tests ทั้งการคลิกและ direct URL
- [ ] ย้าย test ที่ยังผูกกับ `TestRunnerPanel` ไปทดสอบ behavior ของ workspace ใหม่ หรือเอา test ที่ซ้ำกับ component ใหม่ออกอย่างมีเหตุผล
- [ ] ห้ามลบ API หรือ lifecycle logic ที่ workspace ใหม่ใช้อยู่

### ขั้นที่ 4.3 ตรวจ stale wiring และ behavior

- [ ] รัน `rg -n "TestRunnerPanel|JobTerminal" src tests e2e`
- [ ] production route ต้องไม่เหลือ import เก่าที่ทำให้ Logs โหลด test runner
- [ ] รัน `npx vitest run tests/components tests/integration`
- [ ] รัน `npm run test:e2e`

จุดผ่านงาน: เปิด Logs แล้วเห็นเฉพาะ provider log/status, เปิด Tests แล้วเห็น workspace สำหรับ local agent และทั้งสองหน้าสลับกันได้โดยไม่แชร์ state ผิดหน้า

## Task 5: ตรวจ provider mapping และ release gate ก่อน deploy

ไฟล์ที่ต้องตรวจ:

- `.env.local` เฉพาะชื่อและรูปแบบค่า ห้ามคัดลอก secret ลงเอกสาร
- `src/lib/providers/vercel.ts`
- `src/lib/monitor/aggregate.ts`
- `src/app/api/monitor/route.ts`
- Vercel Production Environment Variables ของโปรเจกต์ Monitor

### ขั้นที่ 5.1 ยืนยันว่า Vercel monitor ชี้ไป `ststracking`

- [ ] ตรวจว่า `VERCEL_PROJECT_IDS` ใช้ mapping ของ project id ไปยัง `ststracking` ไม่ใช่ `monitor`
- [ ] ตรวจว่า `VERCEL_TEAM_ID` เป็น team เดียวกับ project `ststracking`
- [ ] ตรวจว่า provider ส่ง `projectId` เป็น id ของ `ststracking` ไปยัง Vercel API และใช้ host ของ Monitor เฉพาะเป็น UI/API ของระบบ monitor
- [ ] ตั้งค่าเดียวกันใน Vercel Production ของ Monitor โดยไม่เปิดเผยค่า token
- [ ] Redeploy หลังแก้ environment และตรวจ deployment ล่าสุดที่รันด้วยค่าใหม่
- [ ] ตรวจว่า snapshot cache ประมาณ 30 วินาทีไม่ถูกตีความว่าเป็น log หาย และ refresh หลัง cache window แล้วเห็น deployment ล่าสุด

### ขั้นที่ 5.2 ตรวจ release gate ทั้งระบบ

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test-agent:build`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] จาก `E:\ProjectSTS\frontend` รันคำสั่ง test ของโปรเจกต์นั้นแยกต่างหาก เพื่อยืนยันว่า local agent เรียก process ของ target project ได้โดยไม่แก้ไฟล์ของ target
- [ ] เปิด production `/monitor` ตรวจว่า provider log เป็นของ `ststracking`
- [ ] เปิด production `/monitor/tests`, รัน `node --version` หรือ preset ที่ปลอดภัย และตรวจลำดับ `queued -> running -> passed` ใน terminal
- [ ] ทดสอบ timeout, cancel และ agent offline แล้วตรวจว่า job ไม่ค้างเป็น `running` และมีรายละเอียดสาเหตุที่อ่านได้
- [ ] ตรวจว่า `/monitor` ไม่ยิง test-runner job endpoint และ `/monitor/tests` ไม่ดึง provider logs เกินกว่าที่ workspace ต้องใช้

จุดผ่านงาน: คำสั่งทั้งหมดจบด้วย exit code 0, production UI แยกหน้าถูกต้อง, log Vercel เป็นของ `ststracking`, และ test runner รันผ่าน local agent โดยไม่ทำให้ระบบถูก monitor เปลี่ยนแปลง

## Self-review ก่อนเริ่ม implementation

- [ ] ทุก task มีไฟล์เป้าหมาย, failing test, คำสั่งรัน, วิธีแก้ และเกณฑ์ผ่านงาน
- [ ] ไม่มีขั้นตอนที่พึ่ง placeholder, `TODO`, การเพิ่ม timeout เพื่อกลบปัญหา หรือการคัดลอก secret
- [ ] ชื่อสถานะ `passed`, `failed`, `cancelled`, `timed_out`, `agent_lost` ตรงกับ type และ lifecycle ที่มีอยู่
- [ ] การตรวจ provider mapping แยก project id ของ `ststracking` ออกจาก deployment host ของ Monitor ชัดเจน
- [ ] งานนี้เป็น follow-up จาก `docs/superpowers/plans/2026-07-28-production-test-runner-navigation.md` และไม่ทำซ้ำงาน feature ที่เสร็จแล้ว
- [ ] หลัง implementation ผู้ใช้เป็นผู้จัดการ Git เองตามข้อกำหนดของ workspace

## Handoff

แผนนี้พร้อมให้ทำต่อแบบ inline ใน task เดียว โดยเริ่มจาก Task 1 เพื่อปิด timeout ของ executor ก่อน แล้วไล่ Task 2 ถึง Task 5 ตามลำดับ หากต้องการแยกงานเป็นชุดย่อย ให้ใช้ Task 1-3 เป็น backend/agent reliability และ Task 4-5 เป็น UI/release verification
