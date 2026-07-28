# Historical Deployment and Log Loading Design

## เป้าหมาย

เมื่อมีการ push หรือ deployment ระหว่างที่ไม่ได้เปิด Morniter ผู้ใช้ต้องเปิดหน้า Monitor ภายหลังแล้วเห็น deployment ที่เกิดขึ้นย้อนหลัง พร้อม commit message, branch และสถานะจาก provider ได้ โดยไม่ต้องพึ่ง browser event ที่เกิดขึ้นตอนหน้าเว็บเปิดอยู่

## ปัญหาปัจจุบัน

- Vercel และ Render snapshot ดึง deployment metadata ย้อนหลังเพียง 10 รายการ
- Vercel event log ถูกโหลดเฉพาะเมื่อกดดูรายละเอียด และเปิดปุ่มเฉพาะ deployment ที่ไม่ใช่ `READY`
- Vercel event message ปัจจุบันแสดงเพียงชื่อ deployment, ID และ state จึงไม่แสดง commit จาก Git push อย่างชัดเจน
- หน้าเว็บเรียก snapshot ทุก 15 วินาที แม้สถานะปกติ ทำให้มี request มากเกินความจำเป็น
- snapshot cache เป็น memory cache ของ instance จึงใช้ได้เฉพาะลด request ช่วงสั้น ๆ ไม่ใช่ประวัติถาวร

## ขอบเขต

รวม Vercel และ Render deployment history, commit metadata, on-demand diagnostic log, adaptive refresh และการจัดการ rate limit

ไม่รวมการเก็บ log ถาวรของ Morniter, การแก้ไขหรือสั่ง deploy โปรเจกต์ที่ถูก Monitor, webhook ที่ต้องเพิ่มในทุก repository และการดึง raw log ของทุก deployment อัตโนมัติ

## การออกแบบ

### 1. ประวัติ deployment

Provider snapshot ดึง deployment ล่าสุด 20 รายการต่อ project/service ในทุก snapshot

- Vercel: `GET /v6/deployments?projectId=...&limit=20`
- Render: `/v1/services/:serviceId/deploys?limit=20`
- รวมรายการจาก provider แล้วเรียงด้วย `occurredAt` ใหม่สุดก่อน
- เมื่อเปิด Morniter หลังปิดไปหลายชั่วโมง ระบบจะดึงชุดล่าสุดจาก provider ใหม่ จึงเห็น deployment ที่เกิดระหว่างปิดหน้าได้
- ประวัติที่เกิน provider limit 20 รายการไม่รับประกันว่าจะอยู่ในหน้า Monitor

เพิ่ม metadata แบบ optional ใน `MonitorEvent`:

```ts
commitSha?: string;
commitMessage?: string;
branch?: string;
commitAuthor?: string;
deploymentTarget?: string;
```

Vercel จะอ่านค่าจาก `meta` เช่น `githubCommitSha`, `githubCommitMessage`, `githubCommitRef`, `gitlabCommitSha`, `gitlabCommitMessage` และ `gitlabCommitRef` ตามค่าที่มีอยู่จริง ส่วน Render จะใช้ `deploy.commit.id` และ `deploy.commit.message`

### 2. Log จริง

การโหลด snapshot จะไม่เรียก provider log endpoint เพื่อไม่ให้ทุก deployment และทุก polling กลายเป็นหลาย request

deployment ทุกสถานะที่ provider รองรับจะมีปุ่มดู log:

- `READY`, `LIVE` และสถานะสำเร็จดู build/deployment log ย้อนหลังได้
- `BUILDING`, `FAILED`, `ERROR` และสถานะอื่นดู log ได้เหมือนเดิม
- กดซ้ำขณะเปิดอยู่จะไม่เรียก API ใหม่จาก component เดิม
- server จะ cache ผล log ตาม `source:eventId` 60 วินาที และ dedupe request ที่กำลังทำอยู่ใน instance เดียวกัน
- จำกัดผลลัพธ์ตาม `limitDiagnostics` เดิมที่ 20 lines และ 4096 bytes พร้อม redaction
- ถ้า provider ตอบ 429 ให้แสดงว่า rate limit และไม่ retry อัตโนมัติ

เมื่อ event เก่าหลุดจาก snapshot 20 รายการ จะไม่สามารถกดดู log ผ่าน event นั้นในหน้า Monitor ได้ เพราะระบบไม่มีฐานข้อมูลประวัติของตัวเอง

### 3. Refresh และ cache

เปลี่ยน `refreshAfterSeconds` จากค่าคงที่ 15 เป็นค่าที่คำนวณจาก snapshot:

- สถานะปกติทุก provider: 60 วินาที
- มี provider error, service degraded หรือ service failed: 20 วินาที
- ผู้ใช้กด Refresh: bypass snapshot cache หนึ่งครั้ง
- เมื่อ tab ไม่ visible ให้หยุด polling เหมือนเดิม
- ไม่ retry provider อัตโนมัติเมื่อ timeout หรือ rate limit

Snapshot memory cache ใช้ TTL 30 วินาทีเพื่อป้องกัน request ซ้ำระหว่าง server render และ client refresh ใน instance เดียวกัน ส่วน manual refresh ส่ง `?force=1` เพื่ออ่านค่าล่าสุดทันที

### 4. การแสดงผล

ใน Terminal Stream ของ deployment แต่ละรายการจะแสดง:

- เวลา deployment
- provider และชื่อ service/project
- state/severity/stage
- deployment ID
- commit SHA แบบตัดสั้น
- commit message
- branch และ author เมื่อ provider ส่งมา
- ปุ่ม `View deployment log` สำหรับ deployment ที่เปิด diagnostic ได้

ส่วนหัวหน้าแสดง `Last snapshot` และเวลา fetch ของ provider แยกจากเวลา deployment เพื่อไม่ทำให้ผู้ใช้สับสนว่า deployment เกิดขึ้นตอนเปิดหน้า

## ความปลอดภัยและข้อจำกัด

- ทุก snapshot และ diagnostic endpoint ยังคงต้องมี monitor session
- API token อยู่เฉพาะ server environment
- log ผ่าน redaction และ truncation เดิม
- ไม่มี endpoint สำหรับ trigger, retry, cancel หรือแก้ไข deployment
- ไม่เก็บ raw log ใน database
- ควบคุม request ด้วย 20 deployment ต่อ provider, adaptive polling, on-demand diagnostics, cache และไม่มี retry เมื่อ rate limit

## Acceptance criteria

1. สร้าง deployment ใหม่ขณะปิดหน้า Morniter แล้วเปิดภายหลัง เห็น deployment นั้นใน 20 รายการล่าสุด
2. Vercel event แสดง commit message, branch หรือ SHA เมื่อ metadata มีค่า
3. Render event แสดง commit message และ SHA เมื่อ response มีค่า
4. Deployment `READY` และ `LIVE` มีปุ่มเปิด log และเรียก provider diagnostics เฉพาะเมื่อกด
5. เปิดหน้าไว้ 5 นาทีในสถานะปกติไม่เรียก snapshot ถี่กว่า 60 วินาที
6. เมื่อมี provider error หรือ deployment failed polling ลดเป็น 20 วินาที
7. กด Refresh แล้ว bypass cache ได้หนึ่งครั้ง
8. การกดดู log ซ้ำภายใน 60 วินาทีไม่สร้าง provider request ซ้ำจาก server instance เดียวกัน
9. provider ตอบ 429 แล้ว UI แสดง rate limit โดยไม่มี retry loop
10. `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` และ `npm run test:e2e` ผ่าน
