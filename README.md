# Project Monitor

เว็บภายในสำหรับให้สมาชิกกลุ่มดูสถานะ deployment, service health และ log ที่ผู้ให้บริการเปิดให้เรียกดูได้จากหน้าจอเดียว

แอปใช้ Next.js แบบ full-stack ตัวเดียว หน้าเว็บและ server routes อยู่ใน repository เดียวกัน ไม่มี database และไม่มีคำสั่งที่แก้ไข production

แอปรองรับ PWA เพื่อให้สมาชิกติดตั้งเป็น icon บน Desktop หรือมือถือได้ โดยยังใช้ URL และ backend เดิม

ตัวแอปเป็น portable monitor ไม่ผูกกับ project ใด project หนึ่ง การนำไปใช้กับ project ใหม่ทำโดยเปลี่ยน environment variables แล้ว deploy instance ใหม่ ไม่ต้องแก้ source code และไม่มีหน้าเพิ่ม project ในรุ่นแรก

รองรับ Diagnostic Terminal แบบ read-only สำหรับค้นหา provider logs, deployment errors, health status และ log ที่ส่งจาก optional project agent ห้ามใช้เป็น interactive shell และห้ามสั่งคำสั่งที่แก้ระบบ

## เป้าหมาย

- รวมสถานะจาก Vercel, Render, Aiven และ cron-job.org
- แสดง event ในหน้าตาคล้าย terminal
- สมาชิกใช้รหัสผ่านกลางของกลุ่ม
- ทุกความสามารถเป็น read-only
- API token อยู่ฝั่ง server เท่านั้น
- กรอง secret และข้อมูลส่วนตัวก่อนตอบ frontend

## ขอบเขตของรุ่นแรก

- ดูสถานะ service และ deployment ล่าสุด
- ดูประวัติ deployment เท่าที่ provider API ส่งกลับ
- ดูผลการทำงานของ scheduled jobs เท่าที่ provider API ส่งกลับ
- ดู health endpoint ของแต่ละ project
- กรองตาม provider, project, severity และช่วงเวลา
- refresh อัตโนมัติทุก 15 วินาที
- pause, resume และ manual refresh
- เปิดลิงก์ไปยัง dashboard ต้นทาง
- ใช้คำสั่ง diagnostic แบบ allowlist เช่น `logs`, `errors`, `deploys`, `health` และ `cron`
- รับ stdout/stderr จาก optional agent ที่ติดตั้งใน project ปลายทาง

รุ่นแรกไม่เก็บ raw log ย้อนหลังเอง หาก provider ลบ log หรือไม่มี API สำหรับอ่าน raw log แอปจะแสดงเฉพาะสถานะและ event ที่เข้าถึงได้

## เทคโนโลยี

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Zod
- jose
- bcryptjs
- Vitest และ React Testing Library
- Playwright
- Vercel สำหรับ deployment
- Web App Manifest และ service worker สำหรับ PWA

## การติดตั้งในอนาคต

คำสั่งเหล่านี้เป็นคำสั่งเป้าหมายหลังดำเนินการตาม implementation plan:

```bash
npm install
cp .env.example .env.local
npm run dev
```

เปิด `http://localhost:3000`

## Environment variables

ค่าจริงต้องอยู่ใน `.env.local` หรือ Vercel Environment Variables และห้าม commit:

```dotenv
GROUP_ACCESS_PASSWORD_HASH=
SESSION_SIGNING_SECRET=
MONITOR_DISPLAY_NAME=Project Monitor
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_IDS=
RENDER_API_KEY=
RENDER_SERVICE_IDS=
AIVEN_API_TOKEN=
AIVEN_PROJECT_NAME=
AIVEN_SERVICE_NAMES=
CRONJOB_API_KEY=
CRONJOB_JOB_IDS=
MONITORED_HEALTH_ENDPOINTS=
```

รายการหลายค่าจะใช้ comma-separated values เช่น:

```dotenv
RENDER_SERVICE_IDS=srv_backend,srv_worker
MONITORED_HEALTH_ENDPOINTS=https://example.com/api/health,https://api.example.com/health
```

agent configuration:

```dotenv
MONITOR_AGENT_INGEST_TOKEN=
MONITOR_AGENT_PROJECT_ID=
MONITOR_AGENT_BUFFER_SECONDS=60
```

agent logs เป็น best-effort เมื่อใช้ Vercel serverless เพราะ memory cache อาจหายหรืออยู่คนละ function instance หากต้องการ stream และย้อนหลังที่เชื่อถือได้ ต้องเพิ่ม long-running ingestion service หรือ log storage ในรุ่นถัดไป

resource ที่ต้องการดูจะผูกด้วย ID และ label จาก environment:

```dotenv
VERCEL_PROJECT_IDS=project_id:frontend,another_project_id:admin
RENDER_SERVICE_IDS=srv_backend:backend,srv_worker:worker
AIVEN_SERVICE_NAMES=kairos-db:database
CRONJOB_JOB_IDS=8158370:news-process
```

ถ้าไม่ตั้ง provider ใด provider นั้นจะถูกปิดและไม่ทำให้แอปทั้งหน้าล้มเหลว

สร้าง password hash ด้วย script ที่จะเพิ่มตาม implementation plan:

```bash
npm run hash-password -- "group-password"
```

สร้าง session secret:

```bash
openssl rand -base64 48
```

## เอกสาร

- `CONTEXT.md` เหตุผล ข้อกำหนด และขอบเขต
- `ARCHITECTURE.md` โครงสร้างและ data flow
- `CLAUDE.md` ข้อกำหนดสำหรับ agent ที่รับช่วงพัฒนา
- `docs/superpowers/specs/2026-07-25-project-monitor-design.md` design specification
- `docs/superpowers/plans/2026-07-25-project-monitor-implementation.md` implementation plan

## Deployment model

Monitor ใช้ Vercel project เดียวเป็นทั้ง frontend และ server-side API ของ Next.js ไม่ต้องมี Render backend แยกสำหรับรุ่นแรก

การเปลี่ยน project ที่ monitor ต้องแก้ environment variables ของ deployment นั้นแล้ว redeploy การตั้งค่า provider ไม่รับผ่าน query string หรือหน้าเว็บ เพื่อไม่ให้ token ถูกบันทึกใน browser history

PWA เป็น client ของ deployment นี้ ไม่เก็บ provider token และไม่ทำงานแทน server routes

## หลักความปลอดภัย

- ห้ามส่ง provider token ไปยัง browser
- ห้ามแสดง environment variables หรือ request headers แบบดิบ
- ห้ามเพิ่มปุ่ม deploy, restart, retry job หรือแก้ configuration
- ทุก server route ต้องตรวจ session ยกเว้น `/api/auth/login`
- cookie ต้องเป็น `HttpOnly`, `Secure` ใน production และ `SameSite=Strict`
- ข้อความจาก provider ต้องผ่าน redaction ก่อนส่งออก
