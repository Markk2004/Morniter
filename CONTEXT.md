# Project Monitor Context

## ที่มา

กลุ่มผู้พัฒนาต้องสลับเข้า Vercel, Render, Aiven และ cron-job.org เพื่อดูว่า deployment หรือ scheduled job มีปัญหาหรือไม่ การแชร์บัญชี provider โดยตรงเสี่ยงเกินไป เพราะผู้ใช้จะเห็น token, environment variables และคำสั่งที่เปลี่ยน production ได้

Project Monitor จึงเป็นหน้าต่าง read-only สำหรับดูข้อมูลที่จำเป็น โดย backend ของ Next.js เป็นผู้เรียก provider APIs แทน browser

## การตัดสินใจที่ยืนยันแล้ว

- สร้างเป็น project ใหม่ที่ `E:\project-monitor`
- ต้องนำไป deploy กับ project อื่นได้ด้วยการเปลี่ยน environment variables เท่านั้น
- ไม่แก้หรือฝังอยู่ใน `E:\inv\Invester`
- ใช้ Next.js เป็นทั้ง frontend และ backend
- deploy บน Vercel
- ติดตั้งใช้งานผ่าน PWA ได้
- ไม่มี database ใหม่
- สมาชิกกลุ่มใช้รหัสผ่านกลาง
- provider credentials อยู่ใน environment variables
- ทุกการเชื่อมต่อ provider เป็น read-only
- UI เป็น terminal ขนาดกลางและมีหน้าสรุปสถานะ
- มี Diagnostic Terminal แบบ read-only ไม่ใช่ shell
- รองรับ optional agent สำหรับส่ง stdout/stderr จาก project ที่รัน `npm run dev` หรือ `npm run start:dev`

## ผู้ใช้

ผู้ใช้คือสมาชิกใน project group ที่ได้รับรหัสผ่านกลาง ไม่มีระบบสมัครสมาชิก ไม่มี role หลายระดับ และไม่มีหน้า admin ในรุ่นแรก

เมื่อรหัสกลางรั่ว เจ้าของระบบต้องเปลี่ยน `GROUP_ACCESS_PASSWORD_HASH` และ `SESSION_SIGNING_SECRET` เพื่อยกเลิก session เดิมทั้งหมด

## ข้อมูลที่ต้องการเห็น

- Vercel deployment status และ deployment history
- Render deploy status, service status และ log ที่ API อนุญาตให้อ่าน
- Aiven service status และ metrics หรือ event ที่ API อนุญาตให้อ่าน
- cron-job.org execution status และประวัติ job
- project health endpoints
- เวลา source ถูกเรียกครั้งล่าสุด
- สถานะ cached, stale หรือ unavailable

## ข้อจำกัดของระบบที่ไม่มี database

- ไม่เก็บประวัติ log เอง
- ไม่ค้นหาข้อมูลที่ provider ลบไปแล้ว
- ไม่ทำ audit รายบุคคล เพราะทุกคนใช้บัญชีกลาง
- cache ใน memory อาจหายเมื่อ Vercel function เปลี่ยน instance
- rate limit ใน memory เป็น best-effort เท่านั้น การป้องกันระดับ global ต้องตั้งใน Vercel Firewall
- API ของแต่ละ provider ให้ชนิดและช่วงเวลาข้อมูลไม่เท่ากัน

## สิ่งที่ไม่ทำ

- ไม่สั่ง deploy หรือ redeploy
- ไม่ restart service
- ไม่แก้ environment variables
- ไม่สั่ง scheduled job
- ไม่แสดง database query หรือข้อมูลผู้ใช้
- ไม่ทำระบบสมัครสมาชิก
- ไม่มี standalone `.exe` ในรุ่นแรก
- ไม่มีคำสั่ง arbitrary shell หรือคำสั่งที่เปลี่ยน production
- ไม่เพิ่ม WebSocket
- ไม่เพิ่ม Redis, Kafka, queue หรือ log warehouse
- ไม่สร้าง mobile application

## เกณฑ์สำเร็จ

- สมาชิกที่ไม่มี session ถูกส่งไปหน้า login
- login ด้วยรหัสกลางแล้วเปิด dashboard ได้
- provider token ไม่ปรากฏใน HTML, JavaScript bundle หรือ API response
- provider หนึ่งล่มไม่ทำให้ dashboard ทั้งหน้าล่ม
- terminal refresh ทุก 15 วินาทีโดยไม่มี request loop
- ผู้ใช้ pause และ resume refresh ได้
- ข้อความที่มี token, password, authorization header หรือ database URL ถูกปิดบัง
- ทุก event แสดง source และ timestamp
- ไม่มี HTTP method หรือ UI action ที่เปลี่ยน production

## ความเสี่ยงที่ต้องติดตาม

- provider เปลี่ยน API contract
- agent log ส่งต่อเนื่องไปยัง Vercel serverless แล้วตกหล่นเพราะ instance เปลี่ยน
- token ถูกตั้ง scope กว้างเกิน read-only
- shared password ถูกส่งต่อออกนอกกลุ่ม
- raw provider message มี secret ฝังอยู่ในข้อความ
- polling ถี่เกินไปจนชน provider rate limit
- serverless instance restart ทำให้ cache หายและเรียก provider มากขึ้น
