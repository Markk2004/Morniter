# Local Test Runner Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the repository's task execution workflow to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน Diagnostic Terminal เป็น Test Runner ที่สั่ง preset test บน Windows Local Agent และแสดงผลผ่าน Morniter อย่างปลอดภัย

**Architecture:** Next.js APIs ตรวจ monitor/execute sessions แล้วเก็บ catalog, queue, jobs และ logs ใน Upstash Redis. Local Agent polling งานด้วย token แยก รัน `spawn` แบบไม่ใช้ shell จาก config local และส่ง log/result กลับ ส่วน React panel poll เฉพาะตอนมีงาน active.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 4, `@upstash/redis`, Node `child_process`, Vitest, Testing Library, Playwright

## Global Constraints

- ไม่มี raw shell command จาก browser
- ใช้ `spawn(command, args, { shell: false })` เท่านั้น
- test execution ต้องมี session scope `monitor:execute` อายุ 15 นาที
- Agent token แยกจาก monitor ingest token
- รันพร้อมกันหนึ่งงาน queue สูงสุด 10
- timeout สูงสุด 1,800 วินาที
- log สูงสุด 5,000 lines/1 MiB และผ่าน redaction
- jobs/logs TTL 7 วัน catalog/heartbeat TTL 75 วินาที
- Agent idle polling 30 วินาที active polling 5 วินาที
- Browser poll 2 วินาทีเฉพาะ queued/running และ 60 วินาทีเมื่อ idle
- Git operations ไม่อยู่ในแผน ผู้ใช้จัดการเองตาม `AGENTS.md`

---

### Task 1: เพิ่ม dependency, environment และ shared contracts

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `src/lib/env/server.ts`
- Create: `src/lib/test-runner/redis.ts`
- Create: `src/lib/test-runner/types.ts`
- Create: `src/lib/test-runner/schemas.ts`
- Test: `tests/unit/test-runner/schemas.test.ts`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- เพิ่ม dependency `@upstash/redis`
- เพิ่ม script `"test-agent": "node --enable-source-maps agent/dist/index.js"` และ `"test-agent:build": "tsc -p agent/tsconfig.json"`
- env: `TEST_RUNNER_PASSWORD_HASH`, `TEST_RUNNER_AGENT_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- types: `TestProjectCatalog`, `TestPreset`, `TestJob`, `TestJobStatus`, `TestLogChunk`
- browser create schema รับ `{ projectId, presetId }` เท่านั้น
- `getRunnerRedis(): Redis` สร้าง connectionless client ด้วย server env

- [ ] **Step 1: เขียน failing schema tests**

```ts
expect(CreateJobSchema.parse({
  projectId: "student-tracking",
  presetId: "cypress-e2e",
})).toEqual({
  projectId: "student-tracking",
  presetId: "cypress-e2e",
});

expect(() => CreateJobSchema.parse({
  projectId: "student-tracking",
  presetId: "cypress-e2e",
  command: "npx arbitrary-package",
})).toThrow();
```

- [ ] **Step 2: รัน `npx vitest run tests/unit/test-runner/schemas.test.ts tests/unit/env.test.ts` และยืนยันว่า fail เพราะ contracts/env ยังไม่มี**

- [ ] **Step 3: ติดตั้ง `npm install @upstash/redis` และเพิ่ม scripts**

- [ ] **Step 4: เพิ่ม Zod env fields แบบ optional ทั้งชุด แต่ให้ Test Runner APIs คืน 503 เมื่อ config ไม่ครบ**

- [ ] **Step 5: implement `getRunnerRedis()` ด้วย `UPSTASH_REDIS_REST_URL` และ `UPSTASH_REDIS_REST_TOKEN` โดย import จาก server-only module**

- [ ] **Step 6: เพิ่ม `.gitignore` สำหรับ `test-runner.config.local.json`, `agent/dist/` และ Cypress local artifacts ที่กำหนด**

- [ ] **Step 7: implement schemas แบบ `.strict()` และจำกัด ID ด้วย `/^[a-z0-9][a-z0-9-]{0,63}$/`**

- [ ] **Step 8: รัน tests และ `npm run typecheck` ให้ผ่าน**

### Task 2: เพิ่ม execution step-up session

**Files:**
- Modify: `src/lib/auth/session.ts`
- Create: `src/lib/auth/execute-session.ts`
- Create: `src/lib/test-runner/rate-limit.ts`
- Create: `src/app/api/test-runner/auth/route.ts`
- Create: `src/app/api/test-runner/lock/route.ts`
- Test: `tests/unit/execute-session.test.ts`
- Test: `tests/integration/test-runner-auth-route.test.ts`

**Interfaces:**
- cookie `project_monitor_execute`
- `createExecuteSessionToken(now?): Promise<string>`
- `verifyExecuteSessionToken(token, now?): Promise<SessionPayload | null>`
- `requireExecuteSession(req): Promise<SessionPayload>`
- `consumeExecuteLoginAttempt(identifierHash): Promise<{ allowed: boolean; retryAfterSeconds: number }>`
- `requireSameOrigin(req): void`
- POST auth body `{ password: string }`, DELETE/POST lock ลบ cookie

- [ ] **Step 1: เขียน test ว่า token มี issuer `project-monitor`, audience `project-monitor-test-runner`, scope `monitor:execute` และหมดอายุ 15 นาที**

- [ ] **Step 2: เขียน route tests สำหรับ wrong password 401, missing config 503, correct password 204 และ cookie flags HttpOnly/Secure/SameSite=Strict**

- [ ] **Step 3: implement execute token ด้วย `SESSION_SIGNING_SECRET` เดิมและ audience แยก**

- [ ] **Step 4: ใช้ Redis `INCR` + `EXPIRE 600` จำกัด 5 ครั้งต่อ identifier hash ใน 10 นาทีและคืน 429 พร้อม Retry-After**

- [ ] **Step 5: ตรวจ Origin ให้ตรง request origin ใน auth/create/cancel routes และ reject cross-origin ด้วย 403**

- [ ] **Step 6: verify `TEST_RUNNER_PASSWORD_HASH` ด้วย password helper เดิมโดยไม่ log password**

- [ ] **Step 7: รัน `npx vitest run tests/unit/execute-session.test.ts tests/integration/test-runner-auth-route.test.ts`**

### Task 3: สร้าง Redis store สำหรับ catalog, queue, jobs และ logs

**Files:**
- Create: `src/lib/test-runner/store.ts`
- Test: `tests/unit/test-runner/store.test.ts`

**Interfaces:**
- `getRunnerRedis(): Redis`
- `publishCatalog(catalog): Promise<void>`
- `getCatalog(): Promise<TestProjectCatalog | null>`
- `enqueueJob(input, requesterHash): Promise<TestJob>`
- `claimNextJob(agentId): Promise<TestJob | null>`
- `appendLogChunk(jobId, chunk): Promise<void>`
- `completeJob(jobId, result): Promise<TestJob>`
- `requestCancel(jobId): Promise<TestJob>`
- `listJobs(limit): Promise<TestJob[]>`
- `getJobWithLogs(jobId, afterSequence): Promise<{ job; chunks }>`

- [ ] **Step 1: สร้าง in-memory fake Redis tests สำหรับ queue limit 10, FIFO claim, final status, TTL calls และ cancel flag**

- [ ] **Step 2: implement key helpers ภายใต้ prefix `morniter:test-runner:v1`**

- [ ] **Step 3: ใช้ Redis list สำหรับ queue, hashes/JSON values สำหรับ job, sorted set สำหรับ history และ list สำหรับ log chunks**

- [ ] **Step 4: `claimNextJob` ใช้ atomic `LPOP`; ตรวจ status queued ก่อนเปลี่ยน running และข้าม cancelled job**

- [ ] **Step 5: trim log list, ตรวจ accumulated bytes/lines และตั้ง `truncated: true` เมื่อถึง limit**

- [ ] **Step 6: รัน `npx vitest run tests/unit/test-runner/store.test.ts`**

### Task 4: สร้าง browser-facing Test Runner APIs

**Files:**
- Create: `src/app/api/test-runner/catalog/route.ts`
- Create: `src/app/api/test-runner/jobs/route.ts`
- Create: `src/app/api/test-runner/jobs/[jobId]/route.ts`
- Create: `src/app/api/test-runner/jobs/[jobId]/cancel/route.ts`
- Test: `tests/integration/test-runner-browser-routes.test.ts`

**Interfaces:**
- GET catalog/history ต้องมี monitor session
- POST job และ POST cancel ต้องมี monitor session + execute session
- POST job รับเฉพาะ `{ projectId, presetId }`
- GET job รองรับ `afterSequence` และคืนเฉพาะ log chunks ใหม่

- [ ] **Step 1: เขียน route tests สำหรับ 401 monitor, 403 execute, 409 agent offline/queue full, 400 unknown preset และ 201 queued**

- [ ] **Step 2: implement catalog/history read routes พร้อม `Cache-Control: private, no-store`**

- [ ] **Step 3: implement create route โดย resolve project/preset จาก catalog ใน Redis ไม่รับ command จาก body**

- [ ] **Step 4: implement job detail/cancel routes และห้าม cancel final job**

- [ ] **Step 5: รัน `npx vitest run tests/integration/test-runner-browser-routes.test.ts`**

### Task 5: สร้าง Agent APIs และ authentication

**Files:**
- Create: `src/lib/test-runner/agent-auth.ts`
- Create: `src/app/api/test-runner/agent/poll/route.ts`
- Create: `src/app/api/test-runner/agent/jobs/[jobId]/logs/route.ts`
- Create: `src/app/api/test-runner/agent/jobs/[jobId]/complete/route.ts`
- Test: `tests/integration/test-runner-agent-routes.test.ts`

**Interfaces:**
- Bearer `TEST_RUNNER_AGENT_TOKEN`
- poll body มี `agentId`, `catalogVersion` และ optional strict catalog; request นี้ต่ออายุ heartbeat TTL 75 วินาที
- poll คืน `204` เมื่อไม่มีงาน หรือ `200` พร้อม job ที่ไม่มี raw command
- logs รับ sequence, stream (`stdout|stderr|system`) และ lines
- complete รับ status, exitCode, startedAt, finishedAt

- [ ] **Step 1: เขียน tests สำหรับ missing/wrong token, malformed catalog/log chunk, no job 204 และ valid completion**

- [ ] **Step 2: implement token comparison ด้วย `timingSafeEqual` หลังตรวจ byte length**

- [ ] **Step 3: implement poll ให้ต่ออายุ heartbeat ทุกครั้ง และ publish catalog เมื่อ body ส่ง catalog ใหม่มา**

- [ ] **Step 4: implement poll/log/complete โดยตรวจว่า job ถูก claim โดย agent ID เดียวกัน**

- [ ] **Step 5: redaction ทุก log line อีกครั้งก่อนเขียน Redis**

- [ ] **Step 6: รัน `npx vitest run tests/integration/test-runner-agent-routes.test.ts`**

### Task 6: สร้าง Local Agent config และ command resolver

**Files:**
- Create: `agent/tsconfig.json`
- Create: `agent/src/config.ts`
- Create: `agent/src/types.ts`
- Create: `agent/test-runner.config.example.json`
- Test: `tests/unit/test-agent/config.test.ts`

**Interfaces:**
- `loadAgentConfig(path): Promise<AgentConfig>`
- `resolvePreset(config, projectId, presetId): ResolvedPreset`
- `resolveExecutable(command, platform): string`

- [ ] **Step 1: เขียน tests สำหรับ absolute cwd, duplicate IDs, timeout 1..1800, empty args และ unknown preset**

- [ ] **Step 2: implement config Zod schema และตรวจ directory ด้วย `fs.stat`**

- [ ] **Step 3: resolve `npm`/`npx` เป็น `.cmd` เฉพาะ Windows และคงชื่อเดิมบน Unix**

- [ ] **Step 4: ยืนยันว่า API job ไม่มี command แล้ว Agent resolve จาก local config เท่านั้น**

- [ ] **Step 5: รัน `npx vitest run tests/unit/test-agent/config.test.ts`**

### Task 7: สร้าง safe process executor

**Files:**
- Create: `agent/src/executor.ts`
- Create: `agent/src/redact.ts`
- Test: `tests/unit/test-agent/executor.test.ts`

**Interfaces:**
- `runPreset(preset, callbacks, signal): Promise<ExecutionResult>`
- callbacks: `onLines(stream, lines)`, `onStarted(pid)`
- result: status, exitCode, startedAt, finishedAt, durationMs, truncated

- [ ] **Step 1: เขียน fixture command ด้วย `process.execPath` ที่พิมพ์ stdout/stderr และจบด้วย exit code ที่กำหนด**

- [ ] **Step 2: test ว่า executor ใช้ `shell: false`, cwd ที่กำหนด, capture ทั้งสอง streams และ map exit code**

- [ ] **Step 3: test timeout/cancel และ Windows process-tree termination ผ่าน injectable kill function**

- [ ] **Step 4: implement line buffering ป้องกัน chunk ตัดกลางบรรทัด และ batch 50 lines/32 KiB/2 วินาที**

- [ ] **Step 5: redact bearer token, common secret assignments และค่าจาก explicit secret list ก่อน callback**

- [ ] **Step 6: รัน `npx vitest run tests/unit/test-agent/executor.test.ts`**

### Task 8: สร้าง Agent polling loop

**Files:**
- Create: `agent/src/client.ts`
- Create: `agent/src/runner.ts`
- Create: `agent/src/index.ts`
- Test: `tests/unit/test-agent/runner.test.ts`

**Interfaces:**
- `AgentClient.heartbeat`, `.poll`, `.appendLogs`, `.complete`
- `runAgent(config, signal): Promise<void>`
- active poll 5s, idle poll 30s, catalog refresh 60s ผ่าน poll request เดียวกัน

- [ ] **Step 1: ใช้ fake timers test heartbeat ที่ piggyback กับ poll, catalog refresh 60s, active/idle backoff, one-job concurrency และ network 5xx backoff**

- [ ] **Step 2: implement API client ด้วย Authorization header และ request timeout 15 วินาที**

- [ ] **Step 3: implement loop ที่ poll พร้อม heartbeat/catalog, resolve preset local, execute และ upload result**

- [ ] **Step 4: poll job detail/cancel flag ระหว่างรันทุก 2 วินาที และ abort process เมื่อ cancelRequested**

- [ ] **Step 5: 401/403 ต้องหยุด Agent พร้อมข้อความสั้นที่ไม่แสดง token; network/5xx backoff สูงสุด 60 วินาที**

- [ ] **Step 6: รัน `npx vitest run tests/unit/test-agent/runner.test.ts` และ `npm run test-agent:build`**

### Task 9: เปลี่ยน Diagnostic Terminal เป็น Test Runner Panel

**Files:**
- Delete: `src/components/monitor/DiagnosticTerminal.tsx`
- Delete: `src/app/api/monitor/command/route.ts`
- Delete: `src/lib/monitor/commands.ts`
- Delete: `tests/integration/command-route.test.ts`
- Delete: `tests/unit/commands.test.ts`
- Create: `src/components/test-runner/TestRunnerPanel.tsx`
- Create: `src/components/test-runner/ExecutionUnlock.tsx`
- Create: `src/components/test-runner/JobTerminal.tsx`
- Create: `src/components/test-runner/JobHistory.tsx`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Test: `tests/components/TestRunnerPanel.test.tsx`

**Interfaces:**
- panel fetch catalog/history เมื่อเปิด
- command input เป็น searchable preset palette แต่ submit เป็น IDs เท่านั้น
- active job polling 2s; idle history polling 60s; pause เมื่อ tab hidden

- [ ] **Step 1: เขียน tests สำหรับ offline Agent, locked execution, select preset, confirmation, running log, cancel และ final result**

- [ ] **Step 2: implement ExecutionUnlock โดยไม่เก็บ password ใน state หลัง request เสร็จ**

- [ ] **Step 3: implement selector ที่แสดง read-only command preview แต่ไม่มี custom args**

- [ ] **Step 4: implement JobTerminal tags `[time] [stdout|stderr|system]` และ auto-scroll เฉพาะเมื่อผู้ใช้อยู่ท้าย log**

- [ ] **Step 5: implement Run confirmation, Cancel, Rerun และ history 20 รายการ**

- [ ] **Step 6: แทนที่ DiagnosticTerminal ใน MonitorDashboard และลบ query-result state ที่ไม่ใช้แล้ว**

- [ ] **Step 7: ลบ old command API/parser/tests แล้วรัน `npx vitest run tests/components/TestRunnerPanel.test.tsx`**

### Task 10: E2E, documentation และ full verification

**Files:**
- Create: `e2e/test-runner.spec.ts`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `.env.example`

- [ ] **Step 1: E2E mock APIs แล้วทดสอบ locked -> unlock -> select Cypress -> run -> stream logs -> passed**

- [ ] **Step 2: E2E ทดสอบ Agent offline, cancel, 429 และ execution session expiry**

- [ ] **Step 3: อธิบาย setup Upstash, hash execution password, Vercel env และ local config โดยห้ามใส่ token ใน Git**

- [ ] **Step 4: ระบุวิธีใช้งาน**

```powershell
npm install
npm run test-agent:build
$env:TEST_RUNNER_CONFIG="E:\project-monitor\test-runner.config.local.json"
$env:TEST_RUNNER_AGENT_TOKEN="<local-secret>"
npm run test-agent
```

- [ ] **Step 5: รัน `npm run test` คาดหวังทุก test ผ่าน**

- [ ] **Step 6: รัน `npm run typecheck` คาดหวัง exit code 0**

- [ ] **Step 7: รัน `npm run lint` คาดหวัง exit code 0**

- [ ] **Step 8: รัน `npm run build` คาดหวัง production build สำเร็จ**

- [ ] **Step 9: รัน `npm run test:e2e` คาดหวังทุก E2E ผ่าน**

- [ ] **Step 10: ทดสอบ manual ด้วย harmless preset `node --version` ก่อนใช้ Cypress/Playwright project จริง**

## Production prerequisites

ก่อนเปิดใช้ต้องมี:

```env
TEST_RUNNER_PASSWORD_HASH=<bcrypt hash>
TEST_RUNNER_AGENT_TOKEN=<random secret at least 32 bytes>
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

Local Agent ต้องมี `TEST_RUNNER_AGENT_TOKEN` ค่าเดียวกับ Vercel และ `test-runner.config.local.json` ที่ไม่เข้า Git

## Final review checklist

- [ ] browser payload ไม่มี command/args/cwd/env
- [ ] execute session แยกจาก monitor read session
- [ ] Agent token ไม่ใช้ร่วมกับ ingest token
- [ ] spawn ใช้ shell false
- [ ] queue/log/history อยู่ใน Redis ไม่ใช่ process memory
- [ ] idle polling/backoff ตรงข้อกำหนด
- [ ] timeout/cancel ฆ่า process tree ได้
- [ ] secret redaction ผ่านทั้ง Agent และ server
- [ ] old Diagnostic Terminal/API/parser ถูกลบ
- [ ] production env และ local config ไม่ถูกแสดงใน log
