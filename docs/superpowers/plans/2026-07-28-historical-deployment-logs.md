# Historical Deployment Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the repository's task execution workflow to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ Monitor โหลด deployment และ commit ที่เกิดขึ้นตอนปิดหน้าได้ พร้อมเปิดดู log จริงแบบ on-demand และลด polling ที่ไม่จำเป็น

**Architecture:** Provider snapshot จะดึง deployment metadata ย้อนหลัง 20 รายการต่อ project/service และแปลง Git metadata เข้า `MonitorEvent` ทุกครั้งที่ snapshot ถูกสร้าง ส่วน diagnostic log จะถูกเรียกเมื่อผู้ใช้กดขยายเท่านั้น โดยมี server-side cache และ in-flight dedupe ตาม event ID. Client จะใช้ refresh interval แบบ adaptive: 60 วินาทีเมื่อปกติ และ 20 วินาทีเมื่อมีปัญหา

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, React, Vitest, Testing Library, Playwright, provider REST APIs

## Global Constraints

- ห้ามแก้ไข, trigger, retry, cancel หรือ rollback project ที่ถูก Monitor
- ห้ามโหลด raw provider logs ระหว่าง snapshot polling
- ประวัติ snapshot ใช้ 20 deployment ต่อ provider และไม่เพิ่ม database
- normal polling ต้องไม่ถี่กว่า 60 วินาที
- incident polling ใช้ 20 วินาที
- manual refresh bypass cache ได้หนึ่งครั้ง
- diagnostic response ต้องผ่าน redaction และจำกัด 20 lines/4096 bytes
- API token อ่านฝั่ง server เท่านั้น
- ห้ามใช้ `VERCEL_API_TOKEN` หรือ secret ใด ๆ ใน client bundle

---

### Task 1: ขยาย event contract และนโยบาย refresh

**Files:**
- Modify: `src/lib/monitor/types.ts`
- Create: `src/lib/monitor/refresh-policy.ts`
- Test: `tests/unit/types.test.ts`
- Test: `tests/unit/refresh-policy.test.ts`

**Interfaces:**
- `MonitorEvent` เพิ่ม `commitSha`, `commitMessage`, `branch`, `commitAuthor`, `deploymentTarget` แบบ optional
- `MonitorSnapshot.refreshAfterSeconds` เปลี่ยนจาก literal `15` เป็น `number`
- สร้าง `getRefreshAfterSeconds(snapshot: Pick<MonitorSnapshot, "partial" | "providers">): number` ซึ่งคืน `20` เมื่อมี provider error, service degraded/failed หรือ snapshot partial และคืน `60` เมื่อปกติ

- [ ] **Step 1: เขียน failing tests สำหรับ metadata และ refresh policy**

```ts
it("returns 60 seconds for a healthy snapshot", () => {
  expect(getRefreshAfterSeconds({ partial: false, providers: healthyProviders })).toBe(60);
});

it("returns 20 seconds when a provider or service is unhealthy", () => {
  expect(getRefreshAfterSeconds({ partial: true, providers: failedProviders })).toBe(20);
});
```

- [ ] **Step 2: รัน `npx vitest run tests/unit/refresh-policy.test.ts tests/unit/types.test.ts` และยืนยันว่า fail เพราะยังไม่มี policy และ field ใหม่**

- [ ] **Step 3: เพิ่ม field optional และ implement `getRefreshAfterSeconds`** โดยตรวจ `provider.error`, `service.status !== "healthy"` และ `partial`

- [ ] **Step 4: รัน test เดิมและยืนยันว่า pass**

- [ ] **Step 5: รัน `npm run typecheck` เพื่อยืนยันว่า snapshot fixture ที่ใช้ค่า 15 ยังถูกอัปเดตเป็นค่าตัวเลขที่ถูกต้อง**

### Task 2: เพิ่ม Git metadata และประวัติ Vercel 20 รายการ

**Files:**
- Modify: `src/lib/providers/vercel.ts`
- Modify: `tests/unit/providers/vercel.test.ts`

**Interfaces:**
- เพิ่ม constant `DEPLOYMENT_HISTORY_LIMIT = 20`
- เพิ่ม helper ภายใน `extractVercelGitMetadata(meta)` ที่คืน `{ commitSha?, commitMessage?, branch?, commitAuthor? }`
- `fetchSnapshot` ต้องส่ง `limit=20` และเติม metadata ในทุก Vercel deployment event
- `diagnosticAvailable` ต้องเป็น `true` สำหรับ Vercel deployment event ที่มี `deploymentId` และ `resourceId` ไม่ขึ้นกับ state

- [ ] **Step 1: เพิ่ม failing provider test**

```ts
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining("/v6/deployments?projectId=prj_123&limit=20"),
  expect.anything(),
);
expect(snapshot.events[0]).toMatchObject({
  commitSha: "abc123456789",
  commitMessage: "Merge branch main",
  branch: "main",
  diagnosticAvailable: true,
});
```

- [ ] **Step 2: รัน `npx vitest run tests/unit/providers/vercel.test.ts` และยืนยันว่า fail**

- [ ] **Step 3: เพิ่ม helper อ่าน key ตามลำดับ `github*` และ `gitlab*` แล้วใช้ fallback เฉพาะค่าที่เป็น string ไม่ว่าง**

- [ ] **Step 4: เปลี่ยน URL limit เป็น 20, สร้างข้อความ event ที่มี commit message เมื่อมีค่า และเปิด diagnostics ให้ deployment สำเร็จด้วย**

- [ ] **Step 5: รัน `npx vitest run tests/unit/providers/vercel.test.ts` และยืนยันว่า pass**

### Task 3: เพิ่ม Git metadata และประวัติ Render 20 รายการ

**Files:**
- Modify: `src/lib/providers/render.ts`
- Modify: `tests/unit/providers/render.test.ts`

**Interfaces:**
- ใช้ `DEPLOYMENT_HISTORY_LIMIT = 20` ร่วมกับ provider policy หรือ constant ที่สื่อความหมายเดียวกัน
- เติม `commitSha` จาก `deploy.commit.id` และ `commitMessage` จาก `deploy.commit.message`
- `diagnosticAvailable` เป็น true เมื่อ event มีข้อมูลที่ Render diagnostics ต้องใช้ ได้แก่ service resource และ owner ID ไม่ว่า deployment สำเร็จหรือล้มเหลว

- [ ] **Step 1: เพิ่ม failing test ว่า deploy request ใช้ `limit=20` และ event สำเร็จมี commit fields กับ diagnostic button**

```ts
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining("/deploys?limit=20"),
  expect.anything(),
  expect.anything(),
  expect.anything(),
  expect.anything(),
);
expect(snapshot.events[0]).toMatchObject({
  commitSha: "commit-123",
  commitMessage: "Merge branch main",
  diagnosticAvailable: true,
});
```

- [ ] **Step 2: รัน `npx vitest run tests/unit/providers/render.test.ts` และยืนยันว่า fail**

- [ ] **Step 3: เปลี่ยน limit, เติม commit metadata และเปิด diagnostics สำหรับทุก deploy ที่มี owner ID**

- [ ] **Step 4: รัน test เดิมและยืนยันว่า pass รวมถึง timeout behavior เดิม**

### Task 4: ปรับ snapshot cache, force refresh และ adaptive interval

**Files:**
- Modify: `src/lib/monitor/cache.ts` ถ้าต้องการ method สำหรับล้าง key เดียว
- Modify: `src/lib/monitor/aggregate.ts`
- Modify: `src/app/api/monitor/snapshot/route.ts`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Modify: `src/components/monitor/AutoRefreshControl.tsx`
- Test: `tests/unit/aggregate.test.ts`
- Test: `tests/integration/snapshot-route.test.ts`
- Modify: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**
- เปลี่ยน `AggregateOptions` เป็น `{ forceRefresh?: boolean }` เพิ่มจาก options เดิม
- `getMonitorSnapshot({ forceRefresh: true })` ข้าม cache แล้วเขียน snapshot ใหม่ด้วย TTL 30 วินาที
- snapshot ใช้ `getRefreshAfterSeconds` กำหนดค่า `refreshAfterSeconds`
- snapshot route อ่าน query `force=1` และส่ง `forceRefresh: true`
- manual refresh เรียก `/api/monitor/snapshot?force=1`
- scheduler ของ dashboard ใช้ `activeSnapshot?.refreshAfterSeconds ?? 60` แทน `15_000` ที่ hardcode
- `AutoRefreshControl` รับ `refreshAfterSeconds: number` และแสดง `LIVE (60s)` หรือ `INCIDENT (20s)` ตามค่า snapshot

- [ ] **Step 1: เพิ่ม test ว่า cache hit ไม่เรียก provider ซ้ำ, force refresh เรียก provider ใหม่ และ snapshot healthy ได้ 60 วินาที**

```ts
const first = await getMonitorSnapshot({ providers, cache });
const second = await getMonitorSnapshot({ providers, cache });
expect(fetchSnapshot).toHaveBeenCalledTimes(1);

await getMonitorSnapshot({ providers, cache, forceRefresh: true });
expect(fetchSnapshot).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: เพิ่ม integration test ว่า `GET /api/monitor/snapshot?force=1` ส่ง force option และ response มี `refreshAfterSeconds` เป็น 60/20 ตาม snapshot**

- [ ] **Step 3: ปรับ aggregate cache TTL เป็น 30 วินาทีและคำนวณ refresh policy หลังรวม provider results เสร็จ**

- [ ] **Step 4: ปรับ dashboard scheduler ให้ตั้ง timeout จาก snapshot policy และไม่ schedule ซ้ำระหว่าง `isRefreshing`**

- [ ] **Step 5: เปลี่ยนข้อความ AutoRefresh จาก `LIVE (15s)` เป็น `LIVE (60s)` หรือ `INCIDENT (20s)` ตาม prop `refreshAfterSeconds`**

- [ ] **Step 6: รัน `npx vitest run tests/unit/aggregate.test.ts tests/integration/snapshot-route.test.ts tests/components/MonitorDashboard.test.tsx` และยืนยันว่า pass**

### Task 5: เปิดดู log ของ deployment สำเร็จและ cache diagnostic request

**Files:**
- Modify: `src/lib/monitor/event-diagnostics.ts`
- Modify: `src/components/monitor/EventDiagnosticDetails.tsx`
- Modify: `src/components/monitor/TerminalPanel.tsx`
- Modify: `tests/unit/event-diagnostics.test.ts`
- Modify: `tests/unit/api-diagnostics.test.ts`
- Modify: `tests/components/EventDiagnosticDetails.test.tsx`

**Interfaces:**
- `getEventDiagnostics` ต้อง cache ผลลัพธ์ด้วย key `${event.source}:${event.id}` เป็นเวลา 60 วินาที
- ใช้ `Map<string, Promise<MonitorDiagnosticsResult>>` สำหรับ in-flight dedupe และลบ promise ใน `finally`
- export `clearDiagnosticCache()` สำหรับ unit test เพื่อไม่ให้ผลจาก test ก่อนหน้าปนกัน
- event ที่ `diagnosticAvailable` เป็น true สามารถเรียก diagnostics ได้ทั้ง READY/LIVE และ failed states
- `EventDiagnosticDetails` รับ props `{ eventId: string; eventType?: MonitorEvent["type"] }` และเปลี่ยน label เป็น `View deployment log` เมื่อ `eventType === "deployment"` ส่วน event อื่นใช้ `View diagnostic details`

- [ ] **Step 1: เพิ่ม test ว่า diagnostic lookup สองครั้งของ event เดียวกันเรียก provider ครั้งเดียวภายใน TTL**

```ts
const first = await getEventDiagnostics("vercel-dep_1", undefined, overrides);
const second = await getEventDiagnostics("vercel-dep_1", undefined, overrides);
expect(fetchDiagnostics).toHaveBeenCalledTimes(1);
expect(second).toEqual(first);
```

- [ ] **Step 2: เพิ่ม test ว่า event READY ที่ `diagnosticAvailable: true` เรียก provider ได้**

- [ ] **Step 3: เพิ่ม cache และ in-flight map ฝั่ง server โดยไม่เก็บ token หรือ raw log ไว้ใน client storage**

- [ ] **Step 4: ส่ง event type เข้า component และปรับ label/ข้อความ loading/error ให้แยก deployment log จาก diagnostic อื่น**

- [ ] **Step 5: map status 429 ให้ UI แสดง `Provider rate limit reached. Try again later.` และไม่ retry อัตโนมัติ**

- [ ] **Step 6: รัน `npx vitest run tests/unit/event-diagnostics.test.ts tests/unit/api-diagnostics.test.ts tests/components/EventDiagnosticDetails.test.tsx` และยืนยันว่า pass**

### Task 6: แสดง commit metadata และเวลาประวัติใน Terminal

**Files:**
- Modify: `src/components/monitor/TerminalPanel.tsx`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Modify: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**
- TerminalPanel แสดง commit row เมื่อมี `commitSha`, `commitMessage`, `branch` หรือ `commitAuthor`
- ใช้ `LocalTime` กับ `occurredAt` เป็นเวลา deployment และแสดง snapshot fetch time แยกที่ `AutoRefreshControl`
- deployment row ต้องมีปุ่ม log แม้ severity เป็น info

- [ ] **Step 1: เพิ่ม component test สำหรับ event ที่เกิดก่อนเปิดหน้า**

```ts
expect(screen.getByText(/Merge branch 'main'/i)).toBeInTheDocument();
expect(screen.getByText(/main/i)).toBeInTheDocument();
expect(screen.getByRole("button", { name: /view deployment log/i })).toBeInTheDocument();
```

- [ ] **Step 2: แสดง commit message แบบ wrap ได้, SHA แบบไม่ตัดข้อมูลสำคัญ และ branch/author แบบ optional**

- [ ] **Step 3: ยืนยันว่า source/severity/status/stage filters ยังคงกรอง event ย้อนหลังได้**

- [ ] **Step 4: รัน `npx vitest run tests/components/MonitorDashboard.test.tsx` และยืนยันว่า pass**

### Task 7: ทดสอบ behavior เมื่อปิด Monitor แล้วกลับมาเปิด

**Files:**
- Modify: `e2e/monitor.spec.ts`
- Create: `e2e/historical-deployments.spec.ts`
- Modify: `playwright.config.ts` เฉพาะเมื่อจำเป็นต่อ fixture ที่มีอยู่

**Interfaces:**
- ใช้ authenticated monitor page และ mock provider snapshot ที่มี deployment timestamp เก่ากว่า `generatedAt`
- ห้ามเรียก provider จริงใน E2E

- [ ] **Step 1: สร้าง E2E fixture ให้ snapshot มี deployment `6h ago` และ commit message จาก Git push**

- [ ] **Step 2: เพิ่ม test ว่าเปิดหน้าแล้วเห็น deployment เก่า, READY state, commit message และปุ่ม deployment log**

- [ ] **Step 3: เพิ่ม test ว่า snapshot ปกติไม่ยิง request ใหม่ก่อนครบ 60 วินาที และ manual Refresh ส่ง `force=1`**

- [ ] **Step 4: เพิ่ม test ว่า incident snapshot เปลี่ยน interval เป็น 20 วินาที**

- [ ] **Step 5: รัน `npm run test:e2e` และยืนยันว่า pass**

### Task 8: ตรวจ production configuration และ build

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md` ถ้ามีคำอธิบาย polling เดิม
- Test: all existing tests

- [ ] **Step 1: อัปเดตเอกสารว่า `VERCEL_PROJECT_IDS` และ `RENDER_SERVICE_IDS` โหลด history 20 รายการ และ refresh policy เป็น 60/20 วินาที**

- [ ] **Step 2: ระบุว่า Vercel Production ต้องใช้ token/team/project ของ `ststracking` ชุดเดียวกัน และต้อง redeploy หลังเปลี่ยน environment variables**

- [ ] **Step 3: รัน `npm run test` และคาดหวังให้ unit/integration tests ผ่านทั้งหมด**

- [ ] **Step 4: รัน `npm run typecheck` และคาดหวัง exit code 0**

- [ ] **Step 5: รัน `npm run lint` และคาดหวัง exit code 0**

- [ ] **Step 6: รัน `npm run build` และคาดหวัง production build สำเร็จ**

- [ ] **Step 7: รัน `npm run test:e2e` และคาดหวัง E2E ผ่าน**

## Verification checklist

- [ ] ปิดหน้า Monitor แล้วสร้าง deployment ใหม่ใน Vercel จาก Git push
- [ ] เปิดหน้า Monitor หลัง deployment เสร็จและตรวจว่ารายการใหม่อยู่ใน history
- [ ] ตรวจ commit message, branch, SHA และเวลา deployment
- [ ] เปิด log ของ READY deployment แล้วตรวจว่าเรียก diagnostics ตอนกดเท่านั้น
- [ ] เปิด log เดิมซ้ำภายใน 60 วินาทีและตรวจว่าไม่ยิง provider ซ้ำจาก instance เดียวกัน
- [ ] ตรวจว่า normal mode แสดง `LIVE (60s)` และ incident mode แสดง `INCIDENT (20s)`
- [ ] ตรวจว่า 429 ไม่ทำให้เกิด retry loop
- [ ] ตรวจว่าไม่มี token หรือ raw secret ปรากฏใน UI, test output หรือ client bundle
