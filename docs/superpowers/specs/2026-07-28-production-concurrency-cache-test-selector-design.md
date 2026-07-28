# Production Concurrency, Cache, Loading, and Test Selector Design

## Goal

ทำให้ Monitor รองรับผู้ใช้หลายคนเปิดพร้อมกันได้โดยไม่ยิง provider API หรือ test-runner API ซ้ำเกินจำเป็น ป้องกันการสร้าง test job พร้อมกันมากกว่าหนึ่งงานต่อ local agent และเปลี่ยน shortcut cards เป็น Project dropdown + Test dropdown + Run button เดียว

## Scope

งานนี้รวมสี่ส่วนที่ทำงานต่อเนื่องกัน:

1. Atomic single-run lock สำหรับ local agent
2. Cache และ loading policy สำหรับ monitor snapshot และ test logs
3. Adaptive polling และ terminal rendering limit
4. Dropdown selector สำหรับเลือก project และ test preset

ไม่เพิ่มระบบ queue หลายงาน ไม่รัน test ขนาน และไม่เปลี่ยนคำสั่งหรือ source code ของโปรเจกต์ที่ถูก monitor

## Current Problems

- `enqueueJob` ตรวจ active job แล้วเขียน active key ด้วยคนละ Redis commands ผู้ใช้สองคนกดพร้อมกันอาจผ่านการตรวจทั้งคู่
- Queue length check และ queue insert ไม่ atomic
- Monitor snapshot cache อยู่ใน memory ของแต่ละ Vercel instance และไม่มี single-flight refresh
- Test Runner idle polling เรียก catalog และ history ทุก 2 วินาทีต่อ browser tab
- Agent heartbeat ใช้ async interval และอาจซ้อนเมื่อ network request ใช้เวลานานกว่า interval
- Terminal เก็บและ render ได้ถึง 1,000 nodes ทำให้ scroll และ React render หน่วงเมื่อ output เยอะ
- Preset shortcuts แสดงเป็นการ์ดหลายช่อง ใช้พื้นที่มากและเลือก test ยากเมื่อ preset เพิ่มขึ้น

## Approved User Experience

หน้า Tests แสดง control ตามลำดับนี้:

1. Project dropdown
2. Test dropdown
3. Selected test details
4. Run button
5. Confirmation dialog
6. Active job progress
7. Live terminal
8. Job history

Project dropdown เลือก project แรกของ catalog เป็นค่าเริ่มต้น ส่วน Test dropdown เริ่มต้นด้วย `Select a test` และไม่มี preset ถูกเลือกอัตโนมัติ เมื่อเปลี่ยน project ต้องล้าง selected test ทุกครั้ง

หลังเลือก test ให้แสดงข้อมูล:

- Test name
- Command preview
- Category
- Timeout
- Risk
- Database target
- SRS IDs เมื่อมีค่า

ปุ่ม Run เปิดใช้งานเมื่อครบทุกเงื่อนไข:

- Main monitor session ยัง valid
- Execution session unlocked
- Agent state เป็น `online`
- ไม่มี active job ของ agent
- เลือก project และ test แล้ว
- ไม่มี create/cancel request กำลังทำงาน

กด Run แล้วต้องเปิด confirmation dialog ทุกครั้ง Dialog แสดง project, test, command, timeout, risk และ database target ก่อนยืนยัน

## Multi-User Execution Model

หนึ่ง local agent มี active job ได้หนึ่งงานเท่านั้น ผู้ใช้หลายคนสามารถดู progress และ terminal เดียวกันได้ แต่สร้างงานพร้อมกันไม่ได้

Server ต้องใช้ Redis atomic operation สำหรับขั้นตอนต่อไปนี้ใน transaction/script เดียว:

1. ตรวจ idempotency key
2. ตรวจ active job lease
3. ตรวจ queue capacity
4. สร้าง job record
5. ตั้ง active job key พร้อม lease
6. เพิ่ม job เข้า queue และ history

ผลลัพธ์ที่เป็นไปได้:

- `201`: สร้าง job ใหม่
- `200`: idempotency replay คืน job เดิม
- `409 ACTIVE_JOB_EXISTS`: มี active job อยู่ พร้อมข้อมูล job ปัจจุบัน
- `409 QUEUE_FULL`: queue ถึงขีดจำกัด
- `503 AGENT_OFFLINE`: catalog/presence ไม่มีหรือ lease หมด

Active key ต้องมี TTL และถูกต่ออายุจาก agent heartbeat งานจบ, cancelled, timed out หรือ agent lost ต้องลบ active key เฉพาะเมื่อ value ตรงกับ job ID ปัจจุบัน เพื่อไม่ลบ lock ของงานใหม่

หน้า Tests ของทุก browser poll active job จาก shared Upstash state เมื่อมี active job ให้ปิด Project dropdown, Test dropdown และ Run button พร้อมแสดง project, preset, status และเวลาเริ่ม

ระบบไม่แสดง IP หรือข้อมูลส่วนตัวของผู้เริ่มงาน ให้เพิ่ม `requesterLabel: string` ใน `TestJob` โดยสร้างจาก `sha256(SESSION_SIGNING_SECRET + ":" + clientIp).slice(0, 8)` ฝั่ง server แล้วแสดงเป็น `Operator ab12cd34` เท่านั้น

## Cache Policy

### Monitor snapshot

- Fresh TTL: 30 วินาที
- Stale fallback: สูงสุด 5 นาที
- Provider refresh พร้อมกันต่อ server instance: หนึ่ง promise ผ่าน single-flight
- Force refresh: ข้าม fresh cache แต่เข้าร่วม in-flight refresh ที่มีอยู่
- Provider refresh ล้มเหลว: คืน stale snapshot พร้อม `cacheStatus: "stale"` และ `partial: true`
- Stale snapshot เกิน 5 นาที: ส่ง provider error ตามจริง ไม่แสดงข้อมูลเก่าว่าเป็น live

Memory cache เป็น optimization ต่อ Vercel instance ไม่ใช่ source of truth ข้อมูล provider และ job ต้องไม่พึ่ง memory cache เพื่อความถูกต้องข้าม instance

### HTTP and Service Worker

Response ต่อไปนี้ใช้ `Cache-Control: private, no-store`:

- `/api/monitor/*`
- `/api/test-runner/*`
- `/api/auth/*`
- Login และ monitor HTML ที่มี session

Service worker cache เฉพาะ static brand assets:

- `/icons/icon-192.png`
- `/icons/icon-512.png`

Service worker ห้าม cache API, auth, HTML, test logs, provider snapshots หรือ cookies

## Loading and Polling Policy

### Monitor page

- Initial load มี skeleton เฉพาะเมื่อไม่มี server-provided snapshot
- Background refresh ต้องคง service cards และ events เดิมไว้
- Incident/partial snapshot refresh ทุก 20 วินาที
- Healthy snapshot refresh ทุก 60 วินาที
- Network failure retry ที่ 5, 10, 20 และสูงสุด 60 วินาที
- Manual refresh ปิดปุ่มจน request เดิมจบ
- ทุก request ใช้ AbortController และ abort เมื่อ component unmount
- Tab hidden ไม่ refresh; tab visible แล้ว sync หนึ่งครั้ง

สถานะ UI ที่ใช้:

- `LIVE`
- `INCIDENT`
- `REFRESHING`
- `RETRYING`
- `STALE`
- `PAUSED`

### Test Runner

- Active job polling: ทุก 1 วินาที
- Idle presence polling: ทุก 5 วินาที
- Tab hidden: หยุด polling
- Tab visible: poll หนึ่งครั้งทันทีแล้วกลับเข้าสู่รอบปกติ
- Poll request ต้องไม่ซ้อนและต้อง abort เมื่อออกจากหน้า
- History โหลดตอนเปิดหน้า, กด refresh และเมื่อ job เปลี่ยนจาก active เป็น terminal status เท่านั้น

Terminal connection states:

- `idle`
- `connecting`
- `streaming`
- `reconnecting`

Network หลุดต้องคง lines เดิมและแสดง `RECONNECTING` เมื่อเชื่อมต่อกลับให้โหลดต่อจาก `nextSequence` โดยไม่เพิ่ม line ซ้ำ

## Terminal Performance

- Agent batch interval: 250ms
- Agent batch limit: 100 lines หรือ 32 KiB
- Client memory cap: 1,000 lines
- DOM render cap: 300 newest lines
- API page size: สูงสุด 200 lines
- Sequence เป็น unique key สำหรับ deduplication
- Auto-scroll ทำงานเฉพาะเมื่อผู้ใช้อยู่ใกล้ท้าย terminal
- Scroll update ใช้ requestAnimationFrame
- เมื่อซ่อน lines เก่าให้แสดงจำนวน `N older lines hidden`

Agent heartbeat ต้องเปลี่ยนจาก async `setInterval` เป็น non-overlapping recursive timeout หรือมี in-flight guard รอบ heartbeat request

## Component Boundaries

### `PresetLauncher`

รับ catalog, lock state, agent state และ active job ทำหน้าที่เลือก project/test และเปิด confirmation เท่านั้น ไม่เรียก API เอง

State ภายใน:

- `selectedProjectId: string`
- `selectedPresetId: string`
- `confirmPreset: TestPreset | null`

เมื่อ `selectedProjectId` เปลี่ยน ให้ตั้ง `selectedPresetId` เป็น empty string และปิด confirmation

### `RunConfirmation`

รับ selected project และ preset ที่ resolve แล้ว แสดงข้อมูลครบและส่ง `onConfirm(projectId, presetId)` เมื่อผู้ใช้ยืนยัน

### `useTestRunner`

เป็นเจ้าของ API communication, adaptive polling, terminal sequence, active job และ error state ไม่เป็นเจ้าของ dropdown selection

### Server store

เป็น source of truth สำหรับ idempotency, active lock, queue, job lifecycle และ log sequences ทุก mutation ที่เกี่ยวกับ lock ต้อง atomic

## Error Handling

- Agent offline: ปิด selector และแสดง heartbeat ล่าสุด
- Active job: ปิด selector และแสดง active job
- Concurrent create: รับ `409 ACTIVE_JOB_EXISTS` แล้วแทน active job ใน client ด้วย response
- Catalog changed: รับ `404/400 UNKNOWN_PRESET`, ล้าง selected preset และโหลด catalog ใหม่
- Lock lease expired: lifecycle reconciliation เปลี่ยนงานเป็น `agent_lost` และปลด active key แบบ compare-and-delete
- Poll failed: คงข้อมูลเดิมและแสดง reconnecting
- Unauthorized: redirect `/login`
- Execution session expired: ล็อก Run และแสดง Execution Unlock อีกครั้ง
- Log truncated: แสดง system line ระบุ local/server truncation ตามค่าจริง

## Reset and Recovery

`Reset app data` เป็น recovery action แบบยืนยันสองครั้ง ทำตามลำดับ:

1. POST `/api/auth/logout`
2. ลบ Cache Storage keys ที่ขึ้นต้น `project-monitor-`
3. Unregister service worker ของ Monitor origin
4. ลบ local/session storage keys ที่ขึ้นต้น `monitor:` หรือ `project_monitor_`
5. Redirect `/login?reset=1`

การ reset ห้ามลบ Redis jobs, provider history, database, API token, environment variables หรือไฟล์ local agent

## Testing Strategy

### Unit

- Snapshot fresh/stale/expired states
- Single-flight provider refresh
- Atomic lock result mapping
- Compare-and-delete active key
- Adaptive polling delay selection
- Sequence deduplication
- Terminal render cap

### Component

- Dropdown starts unselected
- Project change clears selected test
- Run disabled for every blocked state
- Selected test details render correctly
- Confirmation displays all required fields
- Active job disables both dropdowns
- Terminal renders at most 300 lines
- Existing data remains during refresh/reconnect

### Integration

- Two concurrent enqueue requests create one job
- Idempotency replay returns the same job
- Lease expiry marks `agent_lost`
- API responses use no-store
- Catalog change rejects stale preset selection

### E2E

- Select project, select test, confirm, observe queued/running/terminal status
- Second browser sees active job and cannot run another test
- Hidden/visible tab catches up without duplicate logs
- Offline/online transition shows reconnecting then recovers
- Reset app data returns to login without deleting server history

## Production Acceptance Criteria

- One agent never has more than one active job after concurrent requests
- Provider refresh runs once per server instance for concurrent snapshot requests
- Idle Tests page makes no more than one presence poll per 5 seconds per visible tab
- New terminal lines appear within 2 seconds at p95 on a visible tab
- Terminal DOM contains no more than 300 log line nodes
- API, auth, HTML and logs do not appear in Service Worker Cache Storage
- Existing monitor/test data remains visible during background refresh and transient network failure
- Dropdown UI replaces preset cards and requires explicit project/test selection
- Full unit, integration, E2E, typecheck, lint, agent build and production build pass

## Out of Scope

- Parallel test execution
- Multiple local agents in one workspace
- User accounts or role-based access
- Persistent command history in browser storage
- Editing arbitrary shell commands from the web UI
- Moving target projects between GitHub and GitLab
