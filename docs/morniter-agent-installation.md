# Morniter Local Agent บน Windows

Morniter PWA เป็นหน้าควบคุม ส่วน Local Agent ต้องติดตั้งบนเครื่องที่มี source code และ Playwright ของโปรเจกต์ที่จะทดสอบ

## ติดตั้ง

1. ดาวน์โหลด `Morniter-Agent-Setup-<version>.exe` จาก release ที่ทีมอนุมัติ และตรวจ checksum ก่อนเปิดไฟล์
2. ติดตั้งแบบ per-user ได้โดยไม่ต้องใช้ Administrator
3. เปิด Morniter → Settings → Agents แล้วกดสร้าง Pairing Code
4. เปิด Local Agent ใส่ Morniter URL, Agent ID และ Pairing Code
5. เลือก workspace ของโปรเจกต์ เช่น `ProjectSTS` และ test root ที่มีไฟล์ `*.spec.ts` หรือ `*.test.ts`
6. ตรวจ System Check แล้วเริ่ม Agent รอจนสถานะเป็น Online

Pairing Code ใช้ได้ครั้งเดียว หมดอายุใน 10 นาที และ credential ของเครื่องถูกเก็บด้วย Windows secure storage ห้ามนำ token หลักจาก Vercel ไปใส่ในเครื่องสมาชิกทีม

## ใช้งาน

ติดตั้ง PWA แยกจาก Agent ได้จากเมนู Install ใน Chrome หรือ Edge บนหน้า Morniter ที่ deploy แล้ว จากนั้นไปหน้า Tests เลือกโปรเจกต์และ test ที่ต้องการ แล้วกด Run

ไม่ควรเปิด `npm run test-agent` ซ้ำด้วย Agent ID เดียวกับตัวติดตั้ง เพราะจะทำให้มี worker สองตัวแย่งงานกัน

## ถอนการติดตั้ง

ถอนจาก Windows Settings → Apps → Installed apps → Morniter Local Agent โปรแกรมจะหยุด Agent และลบไฟล์โปรแกรมกับ startup entry โดยไม่แตะ repository, `node_modules`, Playwright tests หรือ browser profile ของโปรเจกต์

การถอนการติดตั้งจะไม่ลบ settings และ logs โดยอัตโนมัติ เพื่อให้ติดตั้งใหม่ได้ง่าย หากต้องการล้างข้อมูล Agent ให้ใช้คำสั่ง Reset app data ในหน้าตั้งค่า แล้วจับคู่เครื่องใหม่
