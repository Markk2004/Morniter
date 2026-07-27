# Vercel and Render Deployment Diagnostics Design

## Goal

ทำให้ Project Monitor แจ้งเตือนเมื่อ Vercel deployment ไม่พร้อมใช้งานหรือ Render deploy ผิดพลาด พร้อมแสดงสาเหตุจาก log จริงเมื่อผู้ใช้กดขยายรายละเอียด โดยระบบยังเป็น read-only และไม่แก้ไข project ที่ถูก monitor

## Scope

งานนี้ครอบคลุม:

- status normalization ของ Vercel และ Render
- in-app alert และ browser notification หนึ่งครั้งต่อ incident
- recovery เมื่อกลับมา `READY` หรือ `live`
- filter ตาม source, severity, raw status และ diagnostic stage
- การโหลด build/deploy log เมื่อผู้ใช้กดดูรายละเอียด
- การ redaction และจำกัดขนาด log ก่อนส่งไป browser

งานนี้ไม่ครอบคลุม:

- การ retry, rollback, cancel หรือ trigger deployment
- cron, webhook หรือ notification ขณะปิดหน้าเว็บ
- การวิเคราะห์สาเหตุด้วย AI
- การแก้ไข source code ของ project ที่ถูก monitor

## Architecture

Snapshot polling เดิมจะยังทำงานทุก 15 วินาที แต่ provider จะส่งเฉพาะ metadata ที่จำเป็นต่อการแจ้งเตือน:

- raw provider status
- normalized service status
- deployment ID
- configured resource ID
- incident key
- diagnostic availability

รายละเอียด log จะไม่ถูกโหลดระหว่าง polling ผู้ใช้ต้องกด `View diagnostic details` ใน Terminal จากนั้น client จะเรียก authenticated endpoint:

```text
GET /api/monitor/diagnostics?eventId=<monitor-event-id>
```

endpoint จะค้นหา event จาก snapshot ฝั่ง server ตรวจว่า resource อยู่ใน environment configuration แล้วเรียก provider diagnostics method เฉพาะ event นั้น วิธีนี้ป้องกัน client เลือก resource นอกขอบเขต และลดจำนวน API calls

## Provider status mapping

### Vercel

- `READY` → `healthy`, `info`
- `QUEUED`, `BUILDING`, `INITIALIZING` → `degraded`, `warning`
- `ERROR`, `CANCELED` → `failed`, `error`
- ค่าอื่น → `unknown`, `warning`

deployment ที่ไม่ใช่ `READY` จะมี `diagnosticAvailable: true` และใช้ build events endpoint:

```text
GET /v3/deployments/{deploymentId}/events?direction=backward&limit=20&builds=1
```

Vercel ระบุว่า endpoint นี้คืน build logs และ deployment events ตาม deployment ID:

https://docs.vercel.com/docs/rest-api/reference/endpoints/deployments

### Render

- `live`, `build_succeeded` → `healthy`, `info`
- `created`, `queued`, `building`, `pre_deploy`, `deploying`, `update_in_progress` → `degraded`, `warning`
- `build_failed`, `deploy_failed`, `canceled`, `cancelled`, `suspended`, `deactivated` → `failed`, `error`
- ค่าอื่น → `unknown`, `warning`

Render service response มี `ownerId` ซึ่งจะใช้ร่วมกับ service ID เพื่อ query logs:

```text
GET /v1/logs?ownerId=<owner>&resource=<service>&type=build&startTime=<deploy-start>&endTime=<deploy-end>&direction=backward&limit=20
```

Render Logs API รองรับ filter ตาม resource, level, type และ text:

https://api-docs.render.com/reference/list-logs

ไม่ต้องเพิ่ม `RENDER_OWNER_ID` ใน environment เพราะใช้ `ownerId` จาก service detail response

## Data contract

```ts
export type DiagnosticStage =
  | "build"
  | "deploy"
  | "runtime"
  | "database"
  | "health"
  | "cron"
  | "unknown";

export type MonitorDiagnostic = {
  id: string;
  stage: DiagnosticStage;
  level: Severity;
  message: string;
  occurredAt?: string;
};

export type MonitorDiagnosticsResult = {
  eventId: string;
  summary: string;
  lines: MonitorDiagnostic[];
  truncated: boolean;
};
```

เพิ่ม optional fields ใน `MonitorEvent`:

```ts
stage?: DiagnosticStage;
incidentKey?: string;
deploymentId?: string;
resourceId?: string;
diagnosticAvailable?: boolean;
diagnosticEndTime?: string;
```

`resourceId` และ `deploymentId` ไม่ใช่ credential แต่ endpoint ต้องตรวจว่าค่าดังกล่าวอยู่ใน server-side configuration ก่อนเรียก provider API

## Terminal presentation

แต่ละ event แสดง summary หนึ่งบรรทัด:

```text
[time] PROVIDER | SERVICE | SEVERITY | STATUS | STAGE
summary
```

event ที่มี `diagnosticAvailable` จะแสดงปุ่ม `View diagnostic details` เมื่อกดแล้ว:

1. แสดง loading state
2. fetch diagnostics endpoint
3. แสดง summary ของ error
4. แสดง log ไม่เกิน 20 บรรทัดและไม่เกิน 4 KB
5. แสดง deployment ID และ external provider link
6. สามารถพับรายละเอียดกลับได้

ข้อความสาเหตุใช้ log จริงจาก provider ระบบทำเฉพาะ classification, redaction และเลือกบรรทัดสำคัญ ไม่สร้างสาเหตุที่ไม่มีใน log

## Incident behavior

ระบบ incident กลางรองรับ `aiven`, `vercel` และ `render`

- banner แสดงทันทีเมื่อ service ไม่ใช่ `healthy`
- browser notification ขอ permission จาก user action เท่านั้น
- notification ส่งหนึ่งครั้งต่อ `incidentKey`
- deployment ใหม่ที่ failed ได้ incident key ใหม่ แม้ service เดิมยัง failed
- recovery ล้าง notification keys ของ provider/service เดิม
- recovery banner แสดง 8 วินาทีแล้วหาย
- provider API timeout, unauthorized และ schema mismatch แสดงผ่าน `ProviderErrors` ไม่แปลงเป็น deployment incident

incident key:

```text
vercel:<project-label>:<deployment-id>
render:<service-label>:<deploy-id>
aiven:<service-label>
```

## Filters

ใช้ filter ร่วมกันแบบ AND:

- source
- severity
- raw status
- diagnostic stage

รายการ raw status สร้างจาก events ใน snapshot ปัจจุบัน เพื่อรองรับ provider status ใหม่โดยไม่ hard-code ทุกค่าใน UI

## Security and limits

- token อยู่ server-side เท่านั้น
- diagnostics endpoint ต้องตรวจ session cookie
- event ID ต้องมีอยู่ใน current server snapshot
- resource ID ต้องตรงกับ configured provider resource
- Render log query ต้องจำกัดช่วงเวลาตั้งแต่ deploy เริ่มจน deploy จบหรือ snapshot ล่าสุด
- log ทุกบรรทัดผ่าน `redactText`
- คืนสูงสุด 20 บรรทัด
- payload หลัง redaction รวมไม่เกิน 4 KB
- diagnostics response ใช้ `Cache-Control: private, no-store`
- feature นี้เรียกเฉพาะ GET endpoint ของ provider

## Error handling

- event ไม่มีอยู่ → `404`
- event ไม่มี diagnostics → `400`
- session ไม่ถูกต้อง → `401`
- provider unauthorized → `502` พร้อม generic provider message
- rate limit → `429`
- timeout → `504`
- log schema เปลี่ยน → `502`
- log fetch ล้มเหลวไม่เปลี่ยน service status ที่ได้จาก deployment list

## Verification

- provider unit tests ครอบคลุม status mapping และ diagnostic extraction
- diagnostics service tests ครอบคลุม validation, redaction, line และ byte limits
- incident unit tests ครอบคลุม initial failure, duplicate polling, new failed deployment และ recovery
- component tests ครอบคลุม banner, permission, filters และ expandable log
- route tests ครอบคลุม auth และ error status
- full verification:

```text
npm run test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```
