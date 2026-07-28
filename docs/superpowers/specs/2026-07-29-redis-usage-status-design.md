# redis usage and status design

## goal

เพิ่มการตรวจ Redis ในหน้า Monitor โดยแสดงทั้งจำนวน commands ที่ Project Monitor เรียกใช้เองและสถานะของ Redis database โดยไม่ทำให้หน้า Logs ใช้งานไม่ได้เมื่อ Redis status endpoint ล้มเหลว

## scope

- นับ commands ของแอปตามชนิดคำสั่ง เช่น `GET`, `SET`, `ZADD`, `EVAL`
- แสดงจำนวนรวมของ app commands ในช่วงเวลาที่กำหนด และแยกจำนวนตาม command type
- อ่าน Redis status รวม เช่น total commands processed, memory, uptime และ latency
- แสดงสถานะ `HEALTHY`, `DEGRADED` หรือ `UNAVAILABLE`
- เพิ่ม API และ UI ในระบบเดิม โดยไม่เพิ่ม dependency ใหม่
- ไม่แสดง Redis URL, token, password หรือ raw response ที่อาจมีข้อมูลภายใน

## important distinction

`total_commands_processed` เป็นค่ารวมของ Redis database ทุก client ไม่ใช่เฉพาะ Project Monitor ส่วน app command count เป็นค่าที่ระบบนี้นับเอง จึงต้องแสดงเป็นคนละ metric และไม่รวมเป็นตัวเลขเดียว

Usage quota รายวันหรือรายเดือนจาก Upstash Console ไม่รวมในรอบนี้ เพราะต้องใช้ Management API credential แยกจาก Redis REST URL/token และไม่ควรนำ credential สำหรับจัดการ account มาไว้ในหน้าเว็บ

## architecture

### command instrumentation

เพิ่ม wrapper ใน `src/lib/test-runner/redis.ts` หรือ module ที่รับผิดชอบ Redis client โดยนับเฉพาะ calls ที่เกิดจาก server code ของ Project Monitor ก่อนส่งต่อไปยัง Upstash Redis client

counter ต้องมี interface ที่ชัดเจน:

- `recordRedisCommand(command: string): void`
- `getRedisCommandSnapshot(): RedisCommandSnapshot`
- `resetRedisCommandCounters(): void`

snapshot มี total count, counts by command, window start และ window duration โดยใช้ process memory เท่านั้นในรอบแรก ไม่เขียน counter กลับ Redis เพื่อไม่สร้าง commands เพิ่มและไม่ทำให้ metric นับตัวเองแบบวนซ้ำ

ข้อจำกัดของ process-memory counter ต้องระบุใน UI ว่าเป็น `this server instance` เพราะ Vercel สามารถมีหลาย instance และ reset counter ได้เมื่อ instance ถูกสร้างใหม่

### Redis status endpoint

สร้าง `GET /api/monitor/redis-status` ที่ตรวจ session ด้วย `SESSION_COOKIE` และ `verifySessionToken` เหมือน monitor API อื่น

endpoint จะ:

1. อ่าน app command snapshot จาก counter ใน process
2. วัด latency ของคำสั่ง status ที่ใช้ตรวจ Redis
3. เรียก Redis `INFO` หรือคำสั่ง status ที่รองรับเพื่ออ่าน total commands, memory และ uptime
4. แปลง raw info เป็น response schema ที่จำกัด field
5. คืนสถานะ `HEALTHY` เมื่อ Redis ตอบและ latency อยู่ในเกณฑ์ปกติ, `DEGRADED` เมื่อ Redis ตอบแต่ latency สูงหรือข้อมูลบางส่วนหาย, และ `UNAVAILABLE` เมื่อเชื่อมต่อไม่ได้

response ไม่ส่ง raw Redis INFO กลับ client และไม่รวม environment values

### UI placement

เพิ่ม `RedisStatusPanel` ในหน้า Monitor ใกล้ส่วน service/status summary ก่อน terminal log เพื่อให้ผู้ใช้เห็นสถานะ infrastructure ก่อนอ่านรายละเอียด logs

panel แสดง:

- status badge และคำอธิบายสั้น
- Redis total commands processed
- app commands ในช่วงเวลาปัจจุบัน
- command breakdown แบบรายการสั้น
- memory และ uptime เมื่อ Redis ส่งค่ามา
- timestamp ของการตรวจครั้งล่าสุด
- error message แบบปลอดภัยเมื่อ status unavailable

ใช้ refresh cadence เดียวกับ Monitor snapshot และมี loading state แยกจาก Logs เพื่อไม่บังการใช้งานส่วนอื่น

## error handling

- Redis status failure ต้องตอบ HTTP 200 พร้อม `status: "UNAVAILABLE"` เมื่อผู้ใช้มี session แล้ว เพื่อให้ UI แสดงสถานะได้โดยไม่ทำให้หน้าหลักเป็น error page
- HTTP 401 ใช้เฉพาะกรณี session ไม่ถูกต้อง
- ถ้า `INFO` parse field ไม่ได้ ให้ส่ง field นั้นเป็น `null` และลดสถานะเป็น `DEGRADED`
- ไม่ retry แบบ loop ใน request เดียว และไม่ยิง status request ถี่กว่ารอบ refresh ของ Monitor
- app command counter ต้องทำงานต่อได้แม้ Redis client throw error

## accessibility and responsive behavior

- ใช้ semantic `section` พร้อม heading ที่อธิบายว่าเป็น Redis status
- status badge ต้องไม่พึ่งสีอย่างเดียว ต้องมี text label
- loading และ error state ต้องประกาศด้วย `aria-live="polite"`
- mobile layout เรียง metric เป็นคอลัมน์โดยไม่ทำให้ terminal ถูกดันจนใช้งานยาก

## testing

เพิ่ม tests สำหรับ:

1. command counter รวมคำสั่งและแยกตามชื่อคำสั่งถูกต้อง
2. counter reset และ snapshot window
3. Redis status response แปลงข้อมูล `INFO` เป็น schema ที่ปลอดภัย
4. Redis unavailable คืน `UNAVAILABLE` และไม่ทำให้ route throw
5. session ที่ไม่ถูกต้องคืน 401
6. RedisStatusPanel แสดง healthy, degraded, unavailable และ loading state
7. Monitor page ยัง render Logs ได้เมื่อ Redis status ไม่พร้อม

รัน `npm run test`, `npm run typecheck`, `npm run lint` และ `npm run build`

## constraints

- ไม่เพิ่ม dependency ใหม่
- ไม่แตะ auth cookie หรือ provider APIs เดิม
- ไม่เก็บ app command counter ลง Redis ในรอบแรก
- ไม่อ้างว่า app command count เป็น Upstash quota
- ไม่ใช้ Management API credential ใน client หรือ response
