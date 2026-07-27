# Aiven Status Alerts and Database Identity Design

**Goal:** แสดงสถานะ Aiven ที่ไม่ใช่ `RUNNING` ให้เห็นชัด แจ้งเตือนเมื่อเกิด incident ใหม่ และแสดงว่าบริการใช้ฐานข้อมูล `student_tracking` แทน `defaultdb`

## Scope

งานนี้ครอบคลุมเฉพาะการอ่านข้อมูล Aiven และการแจ้งเตือนในหน้า monitor ไม่แก้ไขหรือเรียก mutation endpoint ของ Aiven, Vercel, Render หรือ project ที่ถูก monitor

## Architecture

`AivenProvider` จะอ่าน service state จาก Aiven API แล้วแปลงเป็นสถานะกลางของระบบ โดยแนบ `databaseName` จาก `AIVEN_DATABASE_NAME` ซึ่งตั้งค่าเริ่มต้นเป็น `student_tracking` งานนี้จะไม่อ้างว่า API ยืนยัน schema ที่แอปกำลังใช้อยู่ แต่จะแสดงเป็น `Database target` เพื่อไม่สื่อความหมายเกินข้อมูลที่ตรวจสอบได้

`MonitorDashboard` จะเปรียบเทียบ Aiven service status จาก snapshot ที่ polling ทุก 15 วินาที ฝั่ง client จะเก็บสถานะ incident ล่าสุดใน `localStorage` เพื่อป้องกันการแจ้งซ้ำระหว่าง refresh และเปิด browser notification เมื่อผู้ใช้กดอนุญาตแล้ว แถบแจ้งเตือนในหน้าเว็บจะแสดงได้แม้ผู้ใช้ไม่อนุญาต browser notification

## Status mapping

| Aiven state | Monitor status | Severity | Incident |
|---|---|---|---|
| `RUNNING` | `healthy` | `info` | ปิด incident เดิม |
| `REBUILDING`, `REBALANCING` | `degraded` | `warning` | เปิด incident |
| `POWEROFF`, `POWERED_OFF`, `FAILED` | `failed` | `error` | เปิด incident |
| ค่าอื่นหรือ state ที่ไม่รู้จัก | `unknown` | `warning` | เปิด incident แต่ระบุว่า state ไม่รู้จัก |

การ normalize จะตัดตัวคั่นและแปลงเป็นตัวพิมพ์ใหญ่ จึงรองรับทั้ง `POWEROFF` และ `POWERED_OFF` โดยไม่ทำให้ API error ถูกตีความเป็น service state

## Data contract

เพิ่ม optional fields ต่อไปนี้ใน domain types เพื่อไม่กระทบ provider เดิม:

```ts
type ServiceStatus = {
  source: MonitorSource;
  service: string;
  status: "healthy" | "degraded" | "failed" | "unknown";
  checkedAt: string;
  databaseName?: string;
};

type MonitorEvent = {
  // existing fields remain unchanged
  databaseName?: string;
};
```

Aiven event จะมีข้อความที่บอก service, raw state และ `Database target: student_tracking` ส่วน credential และ response ที่มี secret จะยังอยู่ฝั่ง server และผ่าน redaction ตามระบบเดิม

## Notification behavior

- แถบแจ้งเตือนในหน้า monitor แสดงทันทีเมื่อ Aiven service ใดมี status ไม่ใช่ `healthy`
- browser notification ขอ permission ผ่านปุ่ม user action เท่านั้น
- incident key ใช้รูปแบบ `aiven:<service-name>`
- ถ้าเปิดหน้าในขณะที่ service อยู่ในสถานะที่ไม่ใช่ `healthy` ให้แสดง in-app alert ทันที และส่ง browser notification ได้หนึ่งครั้งต่อ incident หากเคยอนุญาตไว้แล้ว
- incident เดิมแจ้งครั้งเดียว แม้ snapshot ใหม่จะยังเป็น state เดิม
- เมื่อสถานะกลับ `RUNNING` จะล้าง incident ที่เก็บไว้
- ถ้าหยุดอีกครั้งหลัง recovery จะเปิด incident ใหม่และแจ้งอีกครั้ง
- ถ้า browser notification ไม่รองรับหรือผู้ใช้ปฏิเสธ permission ระบบยังแสดง in-app alert และ event log
- ถ้า Aiven API timeout, unauthorized หรือ schema validation fail ให้แสดง provider error และไม่เปิด incident จาก service state

## UI

Service card ของ Aiven จะแสดง:

```text
Aiven
student_tracking
status: POWEROFF
```

ข้อความจะใช้ `Database target` หรือ `ฐานข้อมูลที่ตั้งค่า` แทนคำว่า `connected database` เพราะ Aiven service endpoint ไม่ได้ยืนยัน schema connection ของแอปโดยตรง

## Verification

ต้องผ่าน unit tests ของ env parser, Aiven provider และ incident transition logic รวมถึง component tests ของ service card และ notification flow จากนั้นรัน `npm run test`, `npm run typecheck`, `npm run lint` และ `npm run build`
