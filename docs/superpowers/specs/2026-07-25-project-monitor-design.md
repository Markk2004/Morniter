# Project Monitor Design

## Goal

สร้างเว็บ Next.js แยกที่ `E:\project-monitor` สำหรับให้สมาชิกกลุ่มใช้รหัสผ่านกลางเข้าดูสถานะ deployment, scheduled jobs, database service health และ log/event ที่ provider เปิดให้เรียกอ่าน โดยไม่มี database ใหม่และไม่มีความสามารถแก้ production แอปติดตั้งเป็น PWA ได้ แต่ไม่มี standalone executable ในรุ่นแรก

ตัวแอปเป็น portable monitor ไม่ hardcode project ใด project หนึ่ง การนำไปใช้กับระบบอื่นทำโดยเปลี่ยน provider credentials และ resource references ใน environment แล้ว deploy instance ใหม่

เพิ่ม Diagnostic Terminal แบบ read-only เพื่อรวม provider logs, deployment errors, health checks และ optional agent logs จาก process ใน project ปลายทาง โดยไม่เปิด interactive shell

## Product scope

หน้าหลักมี service summary และ terminal event stream ผู้ใช้กรองตาม source, project, severity และช่วงเวลาได้ ระบบ refresh ทุก 15 วินาที มี pause, resume และ manual refresh

ข้อมูลมาจาก:

- Vercel
- Render
- Aiven
- cron-job.org
- health endpoints ที่เจ้าของกำหนดไว้ล่วงหน้า

## Authentication

กลุ่มใช้รหัสผ่านเดียว รหัสจริงไม่ถูกเก็บใน source code แต่เก็บเป็น bcrypt hash ใน `GROUP_ACCESS_PASSWORD_HASH`

เมื่อ login สำเร็จ server ออก JWT อายุ 8 ชั่วโมงใน signed HttpOnly cookie ไม่มี session table และไม่มี account table

ระบบนี้ไม่แยกตัวตนสมาชิกและไม่มี audit รายบุคคล หากต้องการยกเลิกสิทธิ์ทุกคน เจ้าของเปลี่ยน password hash และ signing secret

## Architecture

ใช้ Next.js App Router ตัวเดียว:

- React pages แสดง UI
- route handlers ทำหน้าที่ backend
- provider adapters เรียก external APIs
- aggregator รวมผล
- redactor ปิดข้อมูลลับ
- memory cache ลด request ซ้ำ
- PWA manifest และ service worker สำหรับติดตั้งเป็น icon
- Diagnostic command parser แบบ allowlist
- Optional project agent สำหรับ stdout/stderr

ไม่มี direct call จาก browser ไป provider API

Vercel project เดียวให้บริการทั้ง UI และ server route handlers จึงไม่ต้อง deploy Render backend แยกสำหรับ Monitor รุ่นแรก

## Data model

ระบบใช้ normalized `MonitorEvent`, `ServiceStatus`, `ProviderSnapshot` และ `MonitorSnapshot` ตาม `ARCHITECTURE.md`

ข้อมูลทั้งหมดเป็น ephemeral ไม่มี persistence เมื่อ serverless instance ถูกแทนที่ cache จะหายและระบบเรียก provider ใหม่

## Provider behavior

แต่ละ adapter:

1. ตรวจ config ของตัวเอง
2. เรียก upstream ด้วย timeout default 8 วินาที; Render API requests use a 15-second provider-specific timeout
3. validate response
4. normalize เป็นข้อมูลกลาง
5. redact ข้อความ
6. คืน provider-level error เมื่อทำงานไม่ได้

ชื่อ resource และ ID มาจาก environment ในรูปแบบ `id:label` ตัวแอปไม่รับ token, ID หรือ URL จาก query string หรือหน้าเว็บ

provider อื่นต้องยังแสดงผลเมื่อ adapter หนึ่งล้มเหลว

Diagnostic command เป็น query language ขนาดเล็ก ไม่ใช่ shell command ตัวอย่างที่รองรับคือ `logs render backend --last 100`, `errors vercel frontend --today`, `deploys render backend`, `health all` และ `cron failures`

Agent ส่ง event แบบ batch ผ่าน HTTPS พร้อม token เฉพาะ project ระบบจะ redact และเก็บใน memory buffer ชั่วคราวเท่านั้น จึงไม่รับประกันประวัติหลัง Vercel function เปลี่ยน instance

## User interface

หน้า `/login` มีช่อง password เดียวและข้อความผิดพลาดทั่วไป

หน้า `/monitor` ประกอบด้วย:

- header แสดงเวลาที่ refresh ล่าสุด
- service cards
- source และ severity filters
- terminal panel
- pause/resume และ refresh
- provider error panel
- logout

terminal ใช้สีเพื่อแยกระดับ แต่ต้องมี label ตัวอักษร ไม่อาศัยสีเพียงอย่างเดียว

## Security

- shared password ส่งผ่าน HTTPS เท่านั้น
- cookie เป็น HttpOnly และ SameSite Strict
- provider token อยู่ใน Vercel server environment
- external link ใช้ domain allowlist
- health URL มาจาก environment เท่านั้นเพื่อป้องกัน SSRF
- raw provider payload ไม่ถูกส่ง browserหรือเขียน log
- redaction ทำก่อนสร้าง event
- ทุก monitor route ตรวจ session
- mutation routes ไม่มีอยู่ในระบบ

## Availability

snapshot บางส่วนสำเร็จถือเป็นผลสำเร็จและตอบ `200` พร้อม `partial: true`

หาก provider ทั้งหมดล้มเหลว ตอบ `503` แต่ยังส่ง error summary ที่ปลอดภัยให้ UI แสดง

UI ต้องหยุด polling เมื่อ:

- ผู้ใช้กด pause
- browser tab ถูกซ่อน
- component unmount
- request ก่อนหน้ายังไม่จบ

## Testing

- unit tests สำหรับ session, redaction, cache และ normalization
- provider adapter tests ด้วย mocked fetch
- aggregator tests สำหรับ partial และ total failure
- component tests สำหรับ filter และ polling
- Playwright tests สำหรับ login, logout และ dashboard
- production build ตรวจว่า server-only modules ไม่เข้า client bundle

## Non-goals

- historical log archive
- user registration
- individual accounts
- provider mutation
- real-time WebSocket
- mobile native application
- standalone `.exe`
- arbitrary shell execution
- remote deploy, restart หรือ package installation
- analytics และ billing

## Acceptance

ถือว่างานเสร็จเมื่อสมาชิกเปิด Vercel URL, login ด้วยรหัสกลาง, เห็น source statuses และ event stream, กรองข้อมูลได้ และ provider หนึ่งล่มโดยหน้าอื่นยังทำงาน ทั้งหมดต้องผ่าน tests และไม่พบ secret ใน browser response
