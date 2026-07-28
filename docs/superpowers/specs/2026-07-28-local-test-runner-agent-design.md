# Local Test Runner Agent Design

## เป้าหมาย

เปลี่ยน Diagnostic Terminal จากช่องค้นหา event เป็น Test Runner สำหรับสั่ง Unit, Integration, E2E/UAT, Cypress, Playwright, Type Check, Lint และ Build ของโปรเจกต์บนเครื่อง local แล้วส่งสถานะกับ log กลับมาแสดงใน Monitor

หน้าเว็บต้องไม่สามารถรัน shell command อิสระได้ ผู้ใช้เลือกได้เฉพาะ project และ preset ที่ Local Agent ประกาศว่าอนุญาต

## ขอบเขตเวอร์ชันแรก

- Local Agent ทำงานบน Windows ผ่าน `npm run test-agent`
- รองรับ Agent หนึ่งตัวและรันงานทีละงาน
- Monitor บน Vercel ใช้ Upstash Redis เป็น durable queue และเก็บผลชั่วคราว
- มี project selector, preset selector, Run, Cancel, Rerun, status และ streaming-like log polling
- มี preset สำหรับ Unit, Integration, E2E/UAT, Cypress, Playwright, Type Check, Lint และ Build ตาม config ของแต่ละ project
- เก็บประวัติงาน 7 วัน
- Cypress ใช้ `npx cypress run` แบบ headless เท่านั้น

ไม่รวม schedule/cron, Cypress GUI (`cypress open`), artifact upload, screenshot/video download, parallel agents, remote shell, command arguments จากผู้ใช้ และการแก้ไข repository ที่ถูกทดสอบ

## สถาปัตยกรรม

```text
Monitor UI
  -> authenticated Test Runner API
  -> Upstash Redis queue/job/log records
  <- Local Agent polls authenticated Agent API
  -> spawn allowlisted executable + args in configured cwd
  -> upload redacted log chunks and final exit result
  -> UI polls only while a job is queued/running
```

Upstash REST เหมาะกับ Vercel เพราะเป็น HTTP-based client สำหรับ serverless functions และใช้ `UPSTASH_REDIS_REST_URL` กับ `UPSTASH_REDIS_REST_TOKEN` ฝั่ง server เท่านั้น

## สิทธิ์และความปลอดภัย

รหัสกลุ่มเดิมให้สิทธิ์ดู Monitor เท่านั้น การรัน test บนเครื่องต้องใช้ step-up password แยก:

```env
TEST_RUNNER_PASSWORD_HASH=
TEST_RUNNER_AGENT_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

หลังยืนยันรหัส Test Runner ระบบออก HttpOnly, Secure, SameSite=Strict cookie อายุ 15 นาที พร้อม scope `monitor:execute`

Agent ใช้ Bearer token แยกจาก `MONITOR_AGENT_INGEST_TOKEN` และเปรียบเทียบ token แบบ timing-safe

ข้อบังคับการรัน:

- config เก็บ `command` และ `args` แยกกัน
- ใช้ `child_process.spawn(command, args, { shell: false })`
- `cwd` ต้องเป็น absolute path ที่มีอยู่และตรงกับ project config
- browser ส่งได้เฉพาะ `projectId` กับ `presetId`
- ห้ามส่ง command, args, cwd หรือ environment จาก browser
- รันพร้อมกันสูงสุดหนึ่งงาน
- queue สูงสุด 10 งาน
- timeout สูงสุด 30 นาทีต่อ preset
- log สูงสุด 5,000 lines และ 1 MiB ต่อ job
- redaction ทำทั้ง Agent และ server
- ห้ามส่งไฟล์ `.env`, token หรือ environment dump กลับหน้าเว็บ

## Local Agent config

ไฟล์จริง `test-runner.config.local.json` ไม่เข้า Git ส่วนตัวอย่างอยู่ที่ `agent/test-runner.config.example.json`

```json
{
  "agentId": "windows-main",
  "serverUrl": "https://monitorsoftdeath.vercel.app",
  "projects": [
    {
      "id": "student-tracking",
      "label": "Student Tracking",
      "cwd": "E:\\projects\\student-tracking",
      "presets": [
        {
          "id": "cypress-e2e",
          "label": "Cypress E2E",
          "command": "npx",
          "args": ["cypress", "run"],
          "timeoutSeconds": 900
        },
        {
          "id": "unit",
          "label": "Unit Test",
          "command": "npm",
          "args": ["test"],
          "timeoutSeconds": 600
        }
      ]
    }
  ]
}
```

บน Windows Agent resolve `npm` และ `npx` เป็น `npm.cmd` และ `npx.cmd` โดยไม่เปิด shell

## Job model

สถานะ:

```text
queued -> running -> passed
                  -> failed
                  -> timed_out
                  -> cancelled
```

ข้อมูล job:

- job ID
- agent/project/preset IDs และ labels
- requester session fingerprint แบบ hash
- queued/started/finished timestamps
- status, exit code, duration
- cancelRequested
- truncated
- log sequence ล่าสุด

Redis keys ใช้ namespace `monitor:test-runner:v1:*` และ TTL 7 วันสำหรับ jobs/logs ส่วน catalog/heartbeat หมดอายุ 75 วินาที

## Polling และการควบคุม request

Agent:

- poll ทุก 5 วินาทีในหนึ่งนาทีแรกหลังมี activity
- backoff เป็น 30 วินาทีเมื่อ idle
- heartbeat และ catalog version ส่งรวมมากับ poll ไม่สร้าง request heartbeat แยก
- ส่ง catalog เต็มเมื่อเริ่ม Agent, config เปลี่ยน หรือครบ 60 วินาที
- ส่ง log เมื่อครบ 50 lines, 32 KiB หรือ 2 วินาที

Browser:

- โหลด catalog/history เมื่อเปิด panel
- poll job ทุก 2 วินาทีเฉพาะ queued/running
- หยุด polling เมื่อ job final, panel ปิด หรือ tab hidden
- history idle refresh ทุก 60 วินาที

ไม่มี retry loop เมื่อได้ 401, 403 หรือ 429 ใช้ exponential backoff สูงสุด 60 วินาทีเฉพาะ network error/5xx ฝั่ง Agent

## UI

แทนที่ `DiagnosticTerminal` ด้วย `TestRunnerPanel`:

- Agent online/offline และ last heartbeat
- project selector
- preset command palette
- ตัวอย่าง command แบบ read-only เช่น `npx cypress run`
- Run button พร้อม confirm ชื่อ project/preset
- current job status, duration และ Cancel
- terminal log มี timestamp, stdout/stderr tag และข้อความ
- history 20 งานล่าสุด พร้อม Rerun

ถ้า execution session หมดอายุ ให้เปิด step-up password form โดยไม่ล้างผล job ที่กำลังดู

## ข้อแนะนำเชิงวิจารณ์

1. ห้ามเปลี่ยน textbox เดิมให้ส่ง raw `npx ...` ไป server แม้จะ validate prefix เพราะ `npx` สามารถดาวน์โหลดและรัน package ใดก็ได้
2. ห้ามให้รหัสกลุ่มเดียวกับเพื่อนมีสิทธิ์รัน test บนเครื่อง ต้องมี execution password แยก
3. อย่าใช้ memory queue บน Vercel เพราะ request อาจไปคนละ instance
4. อย่า polling ทุก 1 วินาทีตลอดเวลา เพราะเพิ่ม Vercel invocation และ Redis command โดยไม่จำเป็น
5. เริ่มจาก logs เท่านั้น Cypress screenshot/video เก็บอยู่ local ก่อน การ upload artifact เพิ่ม storage, permission และ retention ที่ยังไม่จำเป็น
6. UAT ที่ยิง production ต้องเป็น preset แยกพร้อม label เตือน ห้ามใช้ test ที่ลบหรือแก้ข้อมูลจริงโดยไม่ตั้งใจ

## Acceptance criteria

1. คนที่มี monitor session แต่ไม่มี execution session สั่ง Run/Cancel ไม่ได้
2. Browser ไม่สามารถส่ง command, args หรือ cwd ไปให้ Agent ได้
3. Agent offline แสดงชัดและ Run ถูกปิด
4. Agent รับงานทีละงานและ reject project/preset ที่ไม่มีใน config
5. Unit/Cypress/Playwright preset รันจาก cwd ที่กำหนดและแสดง stdout/stderr
6. exit code 0 เป็น passed ส่วน non-zero เป็น failed
7. timeout และ cancel หยุด process tree แล้วได้สถานะถูกต้อง
8. token, password และ secret patterns ไม่ปรากฏใน log
9. reload หน้าแล้วยังเห็น job/history เพราะเก็บใน Redis
10. Agent idle ไม่ poll ถี่กว่า 30 วินาที และ UI idle ไม่ poll job ทุก 2 วินาที
11. test, typecheck, lint, build และ E2E ของ Monitor ผ่าน

## เอกสารอ้างอิงทางเทคนิค

- Upstash Redis REST client สำหรับ serverless: https://upstash.com/docs/redis/howto/connect-with-upstash-redis
- Upstash REST คิดการใช้งานตาม command/request: https://upstash.com/docs/redis/features/restapi
- Node `child_process.spawn` ใช้ `shell: false` เป็นค่าเริ่มต้น: https://nodejs.org/api/child_process.html
