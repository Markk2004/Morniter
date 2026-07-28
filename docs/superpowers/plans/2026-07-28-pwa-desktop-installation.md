# Desktop PWA Installation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ Morniter ที่ deploy บน Vercel ติดตั้งเป็น PWA บน desktop ผ่าน Chrome และ Edge ได้จริง โดยเปิดเป็นหน้าต่างแยก, ใช้ logo ที่ถูกต้อง และไม่ติดปัญหา service worker หรือ cache เก่า

**Architecture:** Vercel ให้บริการหน้าเว็บผ่าน HTTPS และ static PWA assets จาก `public/` ส่วน browser ตรวจ `manifest.webmanifest`, service worker และ icon ก่อนแสดงปุ่ม Install การ login ยังคงทำงานตามเดิม โดย PWA เปิดที่ `/monitor` แล้ว redirect ไป `/login` เมื่อยังไม่มี session

**Tech Stack:** Next.js App Router, TypeScript, Web App Manifest, Service Worker, Chrome/Edge desktop, Vercel

## Global Constraints

- PWA ต้องทำงานผ่าน HTTPS ของ Vercel และต้องไม่ลดความปลอดภัยของ session cookie
- ห้ามให้ service worker cache API, login page หรือข้อมูล monitor ที่อาจเก่า
- ห้ามนำ API token, password หรือ session cookie ลงใน manifest, service worker หรือ static asset
- ใช้ logo แมวชุดเดียวกันสำหรับ browser icon, PWA icon และ Apple icon
- การทดสอบต้องแยก static installability ออกจากการทดสอบ login และ provider API
- งาน Git เป็นของผู้ใช้ แผนนี้ไม่มีคำสั่ง `git add`, `git commit`, `git push` หรือการเปลี่ยน branch อัตโนมัติ

---

## Task 1: ตรวจ asset และ metadata ที่ใช้สำหรับการติดตั้ง

ไฟล์ที่เกี่ยวข้อง:

- `src/app/manifest.ts`
- `src/app/layout.tsx`
- `public/icons/icon-180.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `src/app/favicon.ico`

### ขั้นที่ 1.1 ตรวจค่าที่ browser ต้องใช้

- [ ] ตรวจว่า `/manifest.webmanifest` ถูกสร้างจาก `src/app/manifest.ts`
- [ ] ตรวจว่า manifest มี `name`, `short_name`, `id`, `start_url`, `display: "standalone"`, `background_color`, `theme_color` และ icon อย่างน้อยขนาด 192x192 กับ 512x512
- [ ] ให้ `start_url` เป็น `/monitor` และตรวจว่าเมื่อไม่มี session สามารถ redirect ไป `/login` ได้โดยไม่เกิด loop
- [ ] ตรวจว่า icon ทุก path เริ่มด้วย `/` และโหลดได้จาก production domain โดยไม่พึ่งไฟล์ในเครื่อง
- [ ] ตรวจว่า `layout.tsx` ประกาศ browser icon และ Apple icon จากไฟล์ logo เดียวกัน
- [ ] ตรวจว่า `favicon.ico` เป็น ICO ที่มี logo จริง ไม่ใช่ default icon ของ Next.js

### ขั้นที่ 1.2 ป้องกันการถูกเขียนทับระหว่าง build

- [ ] ตรวจ `scripts/generate-icons.mjs` ไม่เขียนทับ icon ที่มีอยู่แล้ว
- [ ] ให้การสร้าง fallback ทำงานเฉพาะเมื่อ asset หายจริง
- [ ] ให้ favicon ถูกสร้างจาก `icon-192.png` ที่เป็น logo ปัจจุบัน
- [ ] เพิ่มหรือคง test แบบตรวจ signature, ขนาดไฟล์ และความมีอยู่ของ asset โดยไม่ตรวจ pixel แบบเปราะบาง

จุดผ่านงาน: ไฟล์ manifest และ icon อยู่ใน production build ครบ และไม่มี build step ใดเปลี่ยน logo แมวเป็น placeholder

## Task 2: ตรวจ service worker และ cache สำหรับ PWA

ไฟล์ที่เกี่ยวข้อง:

- `public/sw.js`
- `src/components/PwaRegistration.tsx`

### ขั้นที่ 2.1 ตรวจ lifecycle

- [ ] ตรวจว่า service worker register ที่ `/sw.js` และ scope ครอบคลุมหน้าแอป
- [ ] ตรวจว่า cache name มี version ที่เปลี่ยนได้เมื่อ static asset สำคัญเปลี่ยน
- [ ] ตรวจว่า `install` และ `activate` ใช้ `skipWaiting` กับ `clients.claim` อย่างถูกต้อง
- [ ] ตรวจว่า cache เก่าถูกลบเมื่อ version เปลี่ยน
- [ ] ตรวจว่า fetch handler ไม่ intercept `/api/`, `/monitor`, `/login` หรือ request ที่ไม่ใช่ GET
- [ ] ตรวจว่า static asset ใช้ network-first หรือ fallback ที่ไม่ทำให้ API data กลายเป็นข้อมูลเก่า

### ขั้นที่ 2.2 เพิ่ม regression test

- [ ] เพิ่ม test ตรวจว่า cache version เปลี่ยนเมื่อ icon หรือ service worker เปลี่ยน
- [ ] เพิ่ม test ตรวจว่า request ไป `/api/monitor/snapshot` ไม่ถูก cache
- [ ] เพิ่ม test ตรวจว่า service worker ไม่ทำให้หน้า login ใช้ HTML เก่าหลัง deploy

จุดผ่านงาน: เปิด PWA หลัง deploy ใหม่แล้วได้ asset และหน้าเวอร์ชันใหม่โดยไม่ต้องลบ cache ด้วยมือทุกครั้ง

## Task 3: ตรวจ installability บน Chrome และ Edge

ไฟล์ที่เกี่ยวข้อง:

- เพิ่ม `e2e/pwa-installability.spec.ts` ถ้าโครงสร้าง E2E รองรับการตรวจ static responses
- `playwright.config.*`
- `README.md`

### ขั้นที่ 3.1 เขียน automated smoke test

- [ ] เปิด production URL ด้วย HTTPS
- [ ] ตรวจ `GET /manifest.webmanifest` ได้ status 200 และ `content-type` เป็น manifest ที่อ่านได้
- [ ] ตรวจ icon 192, icon 512, favicon และ `/sw.js` ได้ status 200
- [ ] ตรวจ manifest ไม่มี URL แบบ `localhost` หรือ path ของเครื่องนักพัฒนา
- [ ] ตรวจหน้า `/monitor` และ `/login` ไม่ได้ถูก static cache ผิดวิธี
- [ ] ตรวจว่า app name และ start URL ตรงกับค่าที่ผู้ใช้เห็นตอนติดตั้ง

รัน:

```powershell
npx playwright test e2e/pwa-installability.spec.ts
```

### ขั้นที่ 3.2 ตรวจด้วย browser จริง

- [ ] เปิด `https://morniter.vercel.app` ใน Chrome desktop
- [ ] เปิด DevTools > Application > Manifest และตรวจว่าไม่มี installability error
- [ ] ตรวจ Application > Service Workers ว่า `/sw.js` มีสถานะ activated และ scope เป็น domain ของ Morniter
- [ ] กดไอคอน Install ใน address bar หรือเมนู Chrome > Save and share > Install page as app
- [ ] เปิดแอปจาก Start Menu/Desktop และตรวจว่าเปิดเป็นหน้าต่าง standalone ไม่แสดง browser tab bar
- [ ] ทำขั้นตอนเดียวกันใน Microsoft Edge
- [ ] ตรวจว่าไอคอนบน shortcut และ taskbar เป็น logo แมว ไม่ใช่ตัว M หรือไอคอนเก่า
- [ ] ถอนติดตั้งแล้วติดตั้งใหม่หนึ่งรอบ เพื่อยืนยันว่า icon และ manifest รุ่นล่าสุดถูกโหลดจริง

จุดผ่านงาน: Chrome และ Edge แสดงตัวเลือก Install, ติดตั้งสำเร็จ, เปิดเป็นหน้าต่างแยก และใช้ logo ล่าสุด

## Task 4: ตรวจการใช้งานหลังติดตั้งและ deployment gate

### ขั้นที่ 4.1 ตรวจ flow ของผู้ใช้

- [ ] เปิด PWA ขณะยังไม่มี session และยืนยันว่าไปหน้า `/login`
- [ ] login แล้วตรวจว่าไป `/monitor` ได้
- [ ] กด refresh ใน PWA แล้ว session ยังทำงานตามอายุ cookie
- [ ] logout แล้วตรวจว่าไม่สามารถเปิดข้อมูล monitor จาก history โดยไม่ login ใหม่
- [ ] เปิดหน้า Tests จาก navigation แล้วตรวจว่า PWA ไม่แสดง layout ผิดจาก desktop window
- [ ] ตรวจว่า provider error เช่น Vercel 404 แสดงใน UI แต่ไม่ทำให้ PWA shell หรือ service worker พัง

### ขั้นที่ 4.2 ตรวจ production deployment

- [ ] รัน `npm run typecheck`
- [ ] รัน `npm run build`
- [ ] รัน `npm run test:e2e`
- [ ] ตรวจ production assets หลัง deploy ใหม่อีกครั้ง
- [ ] ตรวจว่า deployment ที่เปิดใช้งานเป็น deployment ล่าสุด ไม่ใช่ preview เก่า
- [ ] หลัง deploy เปลี่ยน cache version แล้วให้เปิดหน้าเว็บหนึ่งครั้งเพื่อให้ service worker รุ่นใหม่ activate
- [ ] บันทึกวิธีติดตั้งสำหรับผู้ใช้ใน `README.md` โดยระบุขั้นตอน Chrome และ Edge แบบสั้น ๆ

จุดผ่านงาน: production deploy ใหม่ติดตั้งได้, asset ถูกต้อง, login และ monitor ใช้งานได้ และไม่มี regression จาก service worker

## Task 5: ลดอาการ terminal หน่วงและเพิ่มขั้นตอน reset cache/session

ไฟล์ที่เกี่ยวข้อง:

- `src/components/test-runner/useTestRunner.ts`
- `src/components/test-runner/LiveTestTerminal.tsx`
- `src/components/test-runner/TestRunnerWorkspace.tsx`
- `agent/src/log-batcher.ts`
- `src/app/api/test-runner/jobs/route.ts`
- `src/app/api/test-runner/jobs/[jobId]/route.ts`
- `src/app/api/test-runner/jobs/[jobId]/logs/route.ts`
- `src/app/api/auth/logout/route.ts`
- `public/sw.js`
- `src/components/PwaRegistration.tsx`

### ขั้นที่ 5.1 แยกสาเหตุของ terminal lag

- [ ] วัดเวลาตั้งแต่ agent ส่ง log จน terminal แสดงผล โดยใช้ sequence และ timestamp ที่มีอยู่ ไม่ใช้เวลาจากการ render อย่างเดียว
- [ ] ตรวจว่า polling ไม่ยิงซ้อนกันเมื่อ request ก่อนหน้ายังไม่เสร็จ และยกเลิก request เมื่อออกจากหน้า
- [ ] ตรวจว่า API job/log ใช้ `Cache-Control: no-store` และ client ใช้ `cache: "no-store"` เพื่อไม่อ่าน log จาก browser cache
- [ ] คงการ batch log ฝั่ง agent ที่ 250ms และขนาดไม่เกิน 100 lines หรือ 32 KiB ต่อ batch เพื่อไม่ยิง Upstash และ API ถี่เกินไป
- [ ] เพิ่ม backoff เมื่อ job ไม่ได้ running หรือเมื่อหน้าไม่ active โดยไม่หยุดการตรวจสถานะ job ที่กำลังทำงาน

### ขั้นที่ 5.2 ลดงาน render ของ terminal

- [ ] รวม log ที่เข้ามาในช่วงสั้น ๆ แล้ว update React state เป็นชุดเดียว ไม่เรียก `setState` ทุกบรรทัด
- [ ] จำกัดจำนวนบรรทัดที่ render ใน DOM ให้เหมาะกับหน้าต่าง terminal และคงปุ่มโหลด log เก่าจาก sequence เดิม
- [ ] รักษา auto-scroll เฉพาะเมื่อผู้ใช้อยู่ท้าย terminal ถ้าผู้ใช้เลื่อนขึ้นต้องไม่บังคับ scroll กลับลงมา
- [ ] ใช้ `requestAnimationFrame` หรือกลไกเทียบเท่าเพื่อไม่อ่านและเขียน `scrollHeight` ถี่เกินไป
- [ ] แสดงจำนวนบรรทัดที่ถูกตัดออกจากหน้าจอแยกจากจำนวนบรรทัดทั้งหมด เพื่อไม่ทำให้ผู้ใช้เข้าใจว่า log หาย
- [ ] เพิ่ม test ที่ส่ง log จำนวนมากและยืนยันว่า DOM ไม่โตไม่จำกัด, auto-scroll ทำงานถูก และไม่มี request ซ้อน

### ขั้นที่ 5.3 เพิ่มการล้างข้อมูลแบบปลอดภัย

- [ ] เพิ่ม action ชื่อ `Reset app data` ในจุดช่วยเหลือหรือหน้าตั้งค่าที่มีอยู่ โดยต้องยืนยันก่อนทำงาน
- [ ] action ต้องเรียก `/api/auth/logout` ก่อน เพื่อให้ server ลบ HttpOnly session cookie ได้จริง
- [ ] หลัง logout ให้ unregister service worker ของ origin นี้, ลบเฉพาะ Cache Storage ของ origin นี้, ล้าง `localStorage` และ `sessionStorage` ของแอป แล้วพากลับ `/login`
- [ ] ห้ามพยายามลบ HttpOnly cookie ด้วย JavaScript และห้ามล้าง cookie ของ domain อื่น
- [ ] เพิ่ม test ว่า reset ไม่แตะ API token, ไม่แตะไฟล์เครื่อง และไม่ล้าง storage ข้าม origin
- [ ] เพิ่มคู่มือ manual recovery สำหรับ Chrome/Edge: DevTools > Application > Storage > Clear site data, Service Workers > Unregister แล้ว login ใหม่

จุดผ่านงาน: terminal แสดง log ต่อเนื่องโดยไม่ค้างเมื่อ output เยอะ, network ไม่มี request ซ้อนหรือ cache response, และผู้ใช้กู้หน้า PWA ที่ค้างด้วยการ reset เฉพาะ Morniter ได้

## Self-review ก่อนเริ่ม implementation

- [ ] ทุก task ระบุไฟล์หรือหน้าที่ตรวจได้จริง
- [ ] ไม่มีขั้นตอนที่ต้องใช้ secret ใน client หรือ static asset
- [ ] ไม่ใช้การเพิ่ม timeout หรือการล้าง cache เป็นวิธีซ่อนปัญหา installability
- [ ] แยกปัญหา icon เก่า, service worker เก่า, manifest ผิด และ deployment เก่าออกจากกัน
- [ ] แยก terminal lag จาก provider/API latency, browser cache, service worker cache และ session cookie ให้ตรวจได้คนละสาเหตุ
- [ ] ไม่ใช้การล้าง cookie ทั้ง browser หรือการลดจำนวน log ที่เก็บบน server เพื่อซ่อนอาการ terminal lag
- [ ] แผนนี้ต่อยอดจาก PWA files ที่มีอยู่แล้ว ไม่สร้างระบบติดตั้งใหม่โดยไม่จำเป็น
- [ ] ผู้ใช้ต้อง push และ deploy เองตามข้อกำหนดของ workspace

## Handoff

ให้เริ่มทำตามลำดับ Task 1 ถึง Task 5 โดยเริ่มจากตรวจ static assets และ manifest ก่อน จากนั้นแก้ service worker, terminal performance และจึงติดตั้งจริงบน Chrome/Edge
