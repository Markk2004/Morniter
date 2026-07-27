# Project Monitor Architecture

## ภาพรวม

Project Monitor เป็น Next.js App Router application ตัวเดียว Browser หรือ PWA เรียกเฉพาะ route ภายใต้ `/api/monitor/*` ส่วน route เหล่านั้นเรียก provider API ฝั่ง server แล้ว normalize, redact และ cache ก่อนตอบกลับ

```text
Browser
  |
  | secure session cookie
  v
Next.js pages and route handlers
  |
  +-- authentication and authorization
  +-- monitor aggregator
  +-- redaction
  +-- short-lived memory cache
  |
  +-- Vercel API
  +-- Render API
  +-- Aiven API
  +-- cron-job.org API
  +-- project health endpoints
```

## ส่วนประกอบ

### Web UI

- `/login` รับรหัสผ่านกลาง
- `/monitor` แสดง service summary และ unified event terminal
- `SourceFilters` กรอง provider, project และ severity
- `TerminalPanel` แสดง event เรียงตามเวลา
- `ServiceCards` แสดงสถานะล่าสุดของแต่ละ source
- `AutoRefreshControl` ควบคุม polling 15 วินาที
- `manifest.webmanifest` และ service worker ให้ติดตั้งเป็น PWA

### Authentication

`POST /api/auth/login` เปรียบเทียบรหัสผ่านกับ bcrypt hash จาก environment และออก signed JWT ใน cookie ชื่อ `project_monitor_session`

JWT มีเพียง:

```ts
type SessionPayload = {
  scope: "monitor:read";
  issuedAt: number;
  expiresAt: number;
};
```

cookie มีอายุ 8 ชั่วโมง ใช้ `HttpOnly`, `SameSite=Strict`, path `/` และเปิด `Secure` ใน production

`POST /api/auth/logout` ลบ cookie ฝั่ง browser ไม่มี server-side session store

### Provider adapters

ทุก provider ต้อง implement interface เดียวกัน:

```ts
export interface MonitorProvider {
  readonly source: MonitorSource;
  fetchSnapshot(signal: AbortSignal): Promise<ProviderSnapshot>;
}
```

ชนิดข้อมูลกลาง:

```ts
export type MonitorSource =
  | "vercel"
  | "render"
  | "aiven"
  | "cronjob"
  | "health";

export type Severity = "info" | "warning" | "error";

export type MonitorEvent = {
  id: string;
  source: MonitorSource;
  service: string;
  type: "deployment" | "runtime" | "database" | "cron" | "health";
  severity: Severity;
  status: string;
  message: string;
  occurredAt: string;
  externalUrl?: string;
};

export type ProviderSnapshot = {
  source: MonitorSource;
  fetchedAt: string;
  stale: boolean;
  services: ServiceStatus[];
  events: MonitorEvent[];
  error?: {
    code: "unauthorized" | "rate_limited" | "timeout" | "upstream_error";
    message: string;
  };
};
```

Provider-specific response types ต้องอยู่ในไฟล์ adapter ของ provider นั้นและไม่รั่วออกไปยัง UI

Adapters ไม่ hardcode project, service หรือ job ใด ๆ ใช้ resource references ที่ parse จาก environment เท่านั้น รูปแบบ reference คือ `provider_id:display_label` และ label ใช้แสดงผลอย่างเดียว

### Aggregator

`getMonitorSnapshot()` เรียก adapters พร้อมกันด้วย `Promise.allSettled()` แต่ละ request มี timeout 8 วินาที จากนั้นรวมผลและเรียง event จากใหม่ไปเก่า

provider ที่ล้มเหลวต้องคืน snapshot ที่มี `error` โดยไม่ throw จน route ตอบ 500 ทั้งหน้า

API response:

```ts
export type MonitorSnapshot = {
  generatedAt: string;
  refreshAfterSeconds: 15;
  partial: boolean;
  providers: ProviderSnapshot[];
  events: MonitorEvent[];
};
```

### Cache

ใช้ module-level memory cache อายุ 10 วินาทีเพื่อลด request ซ้ำจากสมาชิกหลายคน:

```ts
type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};
```

cache เป็น optimization เท่านั้น ระบบต้องทำงานถูกต้องแม้ cache หายทุก request

### Diagnostic terminal

UI ส่งข้อความคำสั่งไปที่ `POST /api/monitor/command` แต่ parser รับเฉพาะ grammar ที่กำหนดไว้:

```text
logs <source> [service] [--last <count>]
errors <source> [service] [--today|--since <iso>]
deploys <source> [service]
health [all|<source>]
cron failures
```

คำสั่งถูกแปลงเป็น structured query ก่อนเรียก aggregator ห้ามส่ง string ไป execute ใน shell และห้ามมีคำสั่ง `exec`, `run`, `install`, `migrate`, `restart`, `deploy` หรือ `delete`

### Optional project agent

agent เป็น process ที่ติดตั้งใน project ปลายทางและอ่านเฉพาะ stdout/stderr ของ process ที่เจ้าของระบุ เช่น `npm run dev` หรือ `npm run start:dev` จากนั้นส่ง batch ไป `POST /api/monitor/agent/events`

```ts
export type AgentEvent = {
  projectId: string;
  service: string;
  stream: "stdout" | "stderr";
  message: string;
  occurredAt: string;
};
```

Agent token แยกต่อ project และไม่เคยส่งให้ browser ข้อมูลผ่าน redaction ก่อนเข้า memory ring buffer ที่มีอายุ 60 วินาที

Vercel serverless ไม่รับประกัน live stream ต่อเนื่องหรือการแชร์ memory ระหว่าง instances ดังนั้น agent mode บน Vercel เป็น best-effort เท่านั้น หากต้องการความน่าเชื่อถือ ต้องย้าย ingestion ไป long-running service หรือเพิ่ม log storage ซึ่งอยู่นอก MVP

### Redaction

ข้อความทุกข้อความจาก provider ต้องผ่าน `redactText()` ก่อนเข้า `MonitorEvent`

pattern ขั้นต่ำ:

- `Authorization` และ `Bearer`
- `password`, `passwd`, `secret`, `token`, `api_key`, `apikey`
- URL ที่มี username และ password
- PostgreSQL, MySQL และ Redis connection strings
- JSON field ที่มีชื่อ sensitive

ค่าที่ตรวจพบเปลี่ยนเป็น `[REDACTED]` และไม่บันทึก raw payload ลง console

## API

### `POST /api/auth/login`

Request:

```json
{ "password": "group password" }
```

Responses:

- `204` login สำเร็จ
- `400` request ไม่ถูกต้อง
- `401` รหัสผ่านผิด
- `429` request ถี่เกินไปใน instance ปัจจุบัน

### `POST /api/auth/logout`

- ลบ session cookie
- ตอบ `204`

### `GET /api/monitor/snapshot`

- ต้องมี session scope `monitor:read`
- ตอบ `MonitorSnapshot`
- ใช้ `Cache-Control: private, no-store` เพราะ response อาจมีรายละเอียดภายใน

### `POST /api/monitor/command`

- ต้องมี session `monitor:read`
- รับ `{ "command": "string" }`
- parse เป็น structured query จาก allowlist เท่านั้น
- ตอบ `400` เมื่อ grammar ไม่ถูกต้อง
- ตอบผลลัพธ์เดียวกับ snapshot โดยไม่ execute shell

### `POST /api/monitor/agent/events`

- ใช้ `Authorization: Bearer <agent token>` เฉพาะ server-to-server
- รับ batch ไม่เกิน 100 events และ message ไม่เกิน 8,000 ตัวอักษร
- ตอบ `202` หลัง validate และ redact
- ไม่มี endpoint สำหรับ agent สั่งงานกลับไปยัง project

### `GET /api/monitor/session`

Response:

```json
{ "authenticated": true, "expiresAt": "2026-07-25T20:00:00.000Z" }
```

## Data flow

1. ผู้ใช้ login ด้วยรหัสกลาง
2. server ตรวจ bcrypt hash และออก signed cookie
3. หน้า `/monitor` ตรวจ session
4. client เรียก `/api/monitor/snapshot`
5. aggregator อ่าน cache
6. cache miss แล้วเรียก adapters พร้อมกัน
7. adapter normalize และ redact ข้อมูล
8. aggregator รวมผลและตอบ frontend
9. client รอ 15 วินาทีก่อน request รอบถัดไป
10. เมื่อ pause, tab ถูกซ่อน หรือ component unmount ต้องหยุด timer และ abort request

## Error handling

- ไม่มี session: `401`
- environment ของ provider ไม่ครบ: provider นั้นแสดง `configuration_error`
- upstream `401/403`: แสดง `unauthorized`
- upstream `429`: แสดง `rate_limited`
- timeout 8 วินาที: แสดง `timeout`
- JSON ไม่ตรง schema: แสดง `upstream_error`
- snapshot บางส่วนสำเร็จ: route ยังตอบ `200` และตั้ง `partial: true`
- provider ทั้งหมดล้มเหลว: route ตอบ `503` พร้อม snapshot ที่มี error ของทุก source

## Security boundary

- browser ไม่มี provider token
- environment validation ทำงานเฉพาะ server
- route handler ต้อง import provider modules ผ่าน `server-only`
- ไม่ส่ง raw response body เมื่อเกิด error
- external URL ต้องผ่าน allowlist ของ provider domains
- health endpoints ต้องกำหนดล่วงหน้าใน environment ผู้ใช้ห้ามส่ง URL เอง
- route มีเฉพาะ GET สำหรับข้อมูลและ POST สำหรับ login/logout

## Deployment

แอป deploy บน Vercel โดยตั้ง environment แยก Preview และ Production ห้ามใส่ production provider token ใน Preview หากไม่จำเป็น

Vercel project เดียวให้บริการทั้ง UI และ Next.js route handlers ที่เป็น backend ของ Monitor จึงไม่ต้องมี Render service แยกสำหรับรุ่นแรก

การนำแอปไปใช้กับ project อื่นทำโดยตั้งค่า token และ resource references ชุดใหม่ใน deployment environment แล้ว redeploy ไม่มี runtime settings UI และไม่มีการรับ credential จาก request

PWA ใช้ service worker สำหรับ shell และ asset เท่านั้น ไม่ cache snapshot หรือข้อมูล provider เพื่อไม่ให้สมาชิกเห็นข้อมูลเก่าหลัง logout

Vercel Firewall เป็นจุดควบคุม rate limit ระดับ global ส่วน rate limiter ในแอปเป็นเพียงการลด brute-force ภายใน function instance
