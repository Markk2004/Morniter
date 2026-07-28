# ProjectSTS SRS test categories

## Goal

ให้ Morniter แสดงประเภทการทดสอบและหัวข้อย่อยตาม SRS/BR ของ ProjectSTS เพื่อให้ผู้ใช้เลือกทดสอบเป็นกลุ่มได้ โดยไม่ต้องกรอก shell command เอง

ประเภทที่รองรับมีสามแบบ:

1. automated testing สำหรับ unit, contract, lint, typecheck และ build
2. execution test สำหรับ E2E ที่เปลี่ยนข้อมูลใน Aiven `defaultdb`
3. UAT สำหรับ smoke test แบบ read-only บน deployment ที่กำหนด

## Context

ProjectSTS มีรหัส SRS/BR อยู่ในชื่อ `describe`, `it`, controller และ service comments เช่น `FR-AUTH-001`, `FR-CASE-003`, `BR-006` และ `FR-LOG-002` ชุด E2E ปัจจุบันเป็น mutation-capable และใช้ฐานข้อมูลทดสอบ `defaultdb` จึงไม่ควรถูกเรียกว่า UAT โดยตรง

Morniter มี catalog ของ project/preset และ Local Agent เป็นผู้ resolve command, working directory และ environment จากไฟล์ local ที่ allowlist ไว้แล้ว การเพิ่มประเภทและ SRS group ต้องรักษาขอบเขตนี้ไว้

## User experience

หน้า Test Runner แสดงลำดับการเลือกดังนี้:

1. เลือกประเภท test
2. เลือก SRS/BR group
3. ดูคำอธิบาย, target, database policy และคำสั่งแบบย่อ
4. ยืนยันแล้วส่ง job ผ่าน `projectId` และ `presetId` เท่านั้น

ตัวอย่างรายการ:

```text
Execution test
  FR-CASE-003  ประเมินความรุนแรง
  BR-006       ปิด Student Case
  BR-007       บันทึกการช่วยเหลือ

UAT
  FR-AUTH-001  Login และสิทธิ์ผู้ใช้
  FR-STU-002   ค้นหาและดูข้อมูลนักเรียน
  FR-DBR-002   Dashboard

Automated testing
  Backend unit
  Frontend contract
  Backend lint / build / typecheck
```

ระบบไม่แสดง preset ที่ไม่มี category หรือ SRS group ที่ชัดเจนเป็นรายการ UAT/Execution จะแสดงเป็น maintenance item แทน เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าครอบคลุม requirement แล้ว

## Preset metadata

เพิ่ม metadata ที่ catalog ส่งให้ browser โดยไม่ส่งค่า secret:

- `category`: `automated`, `execution`, หรือ `uat`
- `srsIds`: array ของรหัส `FR-*`, `BR-*`, หรือ `NFR-*`
- `risk`: `safe`, `mutating`, หรือ `read-only`
- `databaseTarget`: `none`, `defaultdb`, หรือ `production` โดย `production` ห้ามใช้กับ mutation preset
- `description` และ `commandPreview`

API สำหรับสร้าง job ยังคงรับเฉพาะ `projectId` และ `presetId` ระบบจะตรวจว่า preset อยู่ใน catalog ของ agent และ category metadata ใช้เพื่อแสดงผลเท่านั้น ไม่ใช้เป็นสิทธิ์แทน allowlist

## Execution test grouping

ProjectSTS จะมี manifest ที่อยู่ใน repository เพื่อ map SRS/BR group ไปยัง Jest file และ test-name pattern ที่ตรวจสอบแล้ว เช่น:

```json
{
  "id": "fr-case-003",
  "category": "execution",
  "srsIds": ["FR-CASE-003", "BR-005"],
  "files": ["src/test/e2e/cases.e2e-spec.ts"],
  "testNamePattern": "PATCH /cases/:id/severity|BR-005",
  "databaseTarget": "defaultdb",
  "risk": "mutating"
}
```

Local Agent จะประกอบ command จาก manifest ที่ allowlist ไว้ ไม่รับ file path หรือ regex จาก browser โดยตรง ทุก execution group ต้องตั้ง `NODE_ENV=test`, `TEST_DATABASE_NAME=defaultdb` และ `DATABASE_URL=${STS_TEST_DATABASE_URL}`

## Automated testing grouping

Automated preset ใช้คำสั่งที่ไม่เขียนข้อมูล production:

- backend unit
- frontend contract/unit
- backend lint, typecheck และ build
- frontend lint, typecheck และ build

กลุ่มเหล่านี้มี `databaseTarget: none` เว้นแต่ test จะประกาศ test database อย่างชัดเจนและผ่าน guard

## UAT grouping

UAT ต้องเป็นชุด read-only ที่รันกับ deployment URL ที่กำหนดใน local agent environment เช่น `STS_UAT_BASE_URL` ห้ามใช้ `student_tracking` และห้ามใช้ preset ที่มีคำสั่ง POST, PATCH, PUT, DELETE หรือคำสั่ง seed/cleanup

ชุดแรกควรครอบคลุม login, การตรวจสิทธิ์, การค้นหานักเรียน, dashboard, reports และการเปิดดู case โดยใช้ browser/API smoke flow ที่ตรวจ response และหน้าจอโดยไม่แก้ข้อมูล

หากยังไม่มี test ที่ตรวจได้ว่า read-only จริง รายการนั้นจะยังไม่ถูกจัดเป็น UAT จนกว่าจะเพิ่ม test และผ่าน review ของ preset manifest

## Safety and failure handling

- Browser ส่งได้แค่ ID ไม่รับ command, path, environment หรือ regex
- Local Agent ปฏิเสธ preset ที่ไม่มีใน local config
- ProjectSTS guard ปฏิเสธ E2E ที่ไม่ใช่ `defaultdb`
- Refresh `defaultdb` เป็นคำสั่ง manual แยกจาก Morniter และต้องใช้ `-Force`
- UAT ที่พบ mutation หรือไม่มี base URL จะ fail ก่อนเริ่ม test
- Catalog ไม่เผยแพร่ค่าของ environment ที่เป็น secret

ผลลัพธ์ job ต้องแสดง category, SRS/BR group, target และ exit status เพื่อให้ผู้ใช้แยก failure ของ test ออกจาก failure ของ infrastructure ได้

## Testing strategy

- unit test สำหรับ catalog metadata, category filtering และ SRS group mapping
- integration test ยืนยัน API รับเฉพาะ `projectId`/`presetId` และปฏิเสธ unknown preset
- component test สำหรับการเลือก category และ group ใน Test Runner
- Local Agent test ยืนยันว่า execution group ขยายเฉพาะ `${STS_TEST_DATABASE_URL}` และ UAT group ไม่ได้รับ database URL
- manual smoke test รันอย่างน้อยหนึ่ง automated group, หนึ่ง execution group และหนึ่ง UAT read-only groupผ่าน Local Agent

## Out of scope

- ให้ผู้ใช้พิมพ์ shell command เอง
- รัน mutation UAT บน `student_tracking`
- สร้าง test ใหม่ให้ครอบคลุม SRS ทุกข้อในรอบเดียว
- เปลี่ยน deployment หรือฐานข้อมูล production

## Acceptance criteria

1. ผู้ใช้เลือก category และ SRS/BR group จากหน้า Test Runner ได้
2. Execution group ที่เลือกต่อ `defaultdb` เท่านั้นและรันผ่าน Local Agent
3. Automated group ไม่แตะ production database
4. UAT group ที่เผยแพร่เป็น read-only และต้องมี deployment base URL
5. Browser request ไม่มี command หรือ secret
6. ผล job ระบุ category, SRS/BR group, target และสถานะการทำงาน
