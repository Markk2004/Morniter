# cybersecurity login design

## goal

ปรับหน้า `/login` ของ Project Monitor ให้เป็นหน้าเข้าสู่ระบบธีม dark SOC console ที่สื่อถึง secure monitoring โดยคงระบบ group password, การสร้าง tab session marker และการ redirect ไป `/monitor` ไว้เหมือนเดิม

## visual direction

- พื้นหลังหลักใช้สีดำอมเขียว `#07110f` และพื้นผิวรองใช้ `#0c1916`
- สี accent ใช้เขียว phosphor `#9cff57` สำหรับสถานะ, focus, เส้นนำสายตา และปุ่มหลักเท่านั้น
- ข้อความหลักเป็น off-white และข้อความรองเป็น muted green-gray เพื่อให้ contrast อ่านง่าย
- ไม่ใช้ gradient class บน login surface และไม่ใช้ลวดลาย grid สำเร็จรูป
- layout desktop แบ่งเป็นสองฝั่ง: identity/status panel ทางซ้าย และ access form ทางขวา
- layout mobile เรียง status panel ไว้ด้านบน แล้วตามด้วย form ที่มีขอบเขตชัดเจน
- การ์ดและ input ใช้มุมโค้งเล็ก 8 ถึง 12px ไม่ใช้มุมโค้งเกินจำเป็น

## generated artwork

สร้างภาพ raster ใหม่สำหรับฝั่ง status panel ด้วย imagegen โดยเป็น abstract cybersecurity network: เส้น data paths, จุด node, รูปทรง shield เชิงเรขาคณิต และแสง phosphor green บนพื้นมืด ไม่มีคน, ไม่มีอุปกรณ์แพทย์, ไม่มีโลโก้, ไม่มีข้อความ และไม่ลอก composition จากไฟล์ตัวอย่าง healthcare editorial

ไฟล์ปลายทางในโปรเจกต์คือ `public/images/cybersecurity-network.png` ใช้เป็นภาพประกอบแบบไม่เป็นเนื้อหาหลัก และต้องมี `alt` ที่เหมาะสมหรือทำเป็น decorative เมื่อข้อความสถานะอธิบายข้อมูลเดียวกันครบแล้ว

## page structure

`src/app/login/page.tsx` ยังคงเป็น client component เพราะต้องใช้ state และ browser storage

- `main` ครอบทั้ง viewport
- header ฝั่งซ้ายแสดง BrandLogo, ชื่อระบบ `PROJECT MONITOR`, status badge `SECURE CHANNEL / OPERATIONAL`, headline สั้น และข้อความอธิบาย
- status strip แสดง `SESSION SCOPE` เป็น `CURRENT TAB` และ `LAST SYNC` เป็น `LIVE`
- `section` ฝั่งขวาแสดงหัวข้อ `Workspace access`, คำอธิบาย group password และ form เดิม
- password input มีปุ่ม show/hide ที่ตั้งชื่อด้วย `aria-label` และเปลี่ยน `type` ระหว่าง `password` กับ `text`
- submit button ใช้ข้อความ `Access workspace` และแสดง `Authenticating...` ตอน request กำลังทำงาน
- error ใช้ `role="alert"`, สีแดงเข้ม และไม่ลบข้อความอธิบายของ input
- footer note ระบุว่า session จำกัดอยู่ที่ browser tab ปัจจุบัน

## behavior and accessibility

- submit เมื่อไม่มี password หรือกำลังส่งอยู่จะไม่ยิง request
- success status 204 จะตั้ง `TAB_SESSION_STORAGE_KEY`, สร้าง marker ด้วย `createTabSessionMarker()` และ redirect ไป `/monitor`
- failure แสดง error response เดิมจาก API; ถ้า parse ไม่ได้ใช้ `Invalid credentials`; network failure ใช้ `Network error. Please try again.`
- input ยังคงใช้ `autocomplete="current-password"`, `required`, `autoFocus`, `aria-describedby="group-password-help"` และ `aria-invalid` เมื่อมี error
- show/hide password ต้องใช้งานได้ด้วย keyboard และมี focus ring ที่มองเห็นได้
- ปุ่ม submit, toggle และ input ต้องมีสีที่อ่านได้บนพื้นหลังทั้ง desktop และ mobile
- ลด animation เมื่อผู้ใช้ตั้ง `prefers-reduced-motion: reduce`

## testing

คง assertions เดิมใน `tests/components/LoginPage.test.tsx` และเพิ่มกรณีต่อไปนี้:

1. render copy และ status label ของธีมใหม่
2. password visibility toggle เปลี่ยน type และกลับได้
3. pending state ปิดการใช้งานปุ่มและแสดง `Authenticating...`
4. error state ยังคงมี `role="alert"`
5. ไม่มี class ที่มีคำว่า `gradient` บน login surface

ตรวจด้วย `npm run test -- tests/components/LoginPage.test.tsx`, `npm run typecheck` และ `npm run lint`

## scope boundaries

- ไม่แก้ route API, cookie/session logic, monitor dashboard หรือ BrandLogo component
- ไม่เพิ่ม dependency ใหม่
- ไม่ใช้วิดีโอ remote หรือ asset จากไฟล์ตัวอย่าง
- ไม่ทำ backend validation ใหม่ เพราะงานนี้เป็น visual redesign ของหน้า login เดิม
