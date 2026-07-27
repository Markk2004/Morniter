# CLAUDE.md

## Project

Project Monitor เป็น Next.js full-stack read-only dashboard สำหรับสมาชิกกลุ่ม ใช้ดู deployment, service health และ provider events จาก Vercel, Render, Aiven และ cron-job.org

โปรเจกต์อยู่ที่ `E:\project-monitor` และไม่ขึ้นกับ source code ใน `E:\inv\Invester` หรือ `E:\inv\investerBack`

## Read first

ก่อนแก้โค้ดให้อ่านตามลำดับ:

1. `CONTEXT.md`
2. `ARCHITECTURE.md`
3. `docs/superpowers/specs/2026-07-25-project-monitor-design.md`
4. `docs/superpowers/plans/2026-07-25-project-monitor-implementation.md`

## Hard constraints

- ใช้ Next.js App Router และ TypeScript
- frontend และ backend route handlers อยู่ repository เดียว
- ห้ามเพิ่ม database, Redis, queue หรือ WebSocket
- ห้ามทำ deploy, restart, retry job หรือ configuration mutation
- provider integrations ต้องเป็น read-only
- provider tokens ต้องอยู่ฝั่ง server
- ห้าม expose environment variables หรือ raw provider payload
- ทุก provider message ต้องผ่าน redaction
- provider หนึ่งล่มต้องไม่ทำให้ provider อื่นหาย
- polling interval คือ 15 วินาที
- provider timeout คือ 8 วินาที
- memory cache TTL คือ 10 วินาที
- session อายุ 8 ชั่วโมง
- ห้ามเพิ่มระบบสมัครสมาชิกหรือ role management
- ห้ามเก็บ raw log ลงไฟล์หรือ console

## Coding rules

- ใช้ server component เป็นค่าเริ่มต้น
- ใส่ `"use client"` เฉพาะ component ที่ใช้ state, effect หรือ browser API
- validate environment และ upstream response ด้วย Zod
- network call ทุกจุดต้องรับ `AbortSignal`
- ใช้ `Promise.allSettled()` สำหรับ provider aggregation
- ใช้ discriminated values จาก `src/lib/monitor/types.ts`
- component หนึ่งไฟล์รับผิดชอบหน้าที่เดียว
- API response ใช้ camelCase และเวลาเป็น ISO 8601 UTC
- ข้อความ error ที่ส่ง browser ต้องไม่รวม token, header หรือ raw response

## Testing rules

- เขียน failing test ก่อน implementation
- provider tests ต้อง mock `fetch`
- redaction tests ต้องมี database URL, bearer token และ JSON secret
- UI polling tests ต้องใช้ fake timers
- browser acceptance tests ต้องตรวจ login, logout, pause และ partial failure
- ห้ามใช้ production credentials ใน test

## Commands after scaffolding

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Environment

ใช้ `.env.example` เป็นรายการชื่อ variable เท่านั้น ห้ามใส่ค่าจริงใน repository

เมื่อเพิ่ม provider variable ต้องแก้พร้อมกัน:

- `.env.example`
- `src/lib/env/server.ts`
- `README.md`
- test ของ environment schema

## Definition of done

- lint, typecheck, unit tests, component tests, E2E และ production build ผ่าน
- ไม่มี secret ใน client bundle หรือ API response fixtures
- dashboard แสดง partial failure ได้
- request หยุดเมื่อ tab ถูกซ่อนหรือผู้ใช้กด pause
- เอกสารตรงกับ behavior ที่ implement จริง

