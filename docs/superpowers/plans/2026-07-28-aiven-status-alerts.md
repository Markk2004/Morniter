# Aiven Status Alerts and Database Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้หน้า Project Monitor แสดง Aiven state ที่ไม่ใช่ `RUNNING`, แจ้งเตือนต่อ incident แบบไม่ซ้ำ และแสดง database target เป็น `student_tracking`

**Architecture:** ให้ server-side Aiven provider normalize state และเติม `databaseName` จาก environment จากนั้นให้ client-side dashboard ตรวจ state transition ระหว่าง snapshot ที่ polling อยู่ เก็บ incident ล่าสุดใน `localStorage` และใช้ browser Notification API เฉพาะหลัง user action โดยยังมี in-app alert เป็น fallback

**Tech Stack:** Next.js 16, TypeScript, React, Zod, Vitest, Testing Library, Tailwind CSS, Browser Notification API, localStorage

## Global Constraints

- ระบบยังเป็น read-only และห้ามเรียก mutation endpoint ของ Aiven หรือ project ที่ถูก monitor
- ห้ามเพิ่ม database, Redis, queue หรือ cron สำหรับ feature นี้
- API token และ response ที่เป็นความลับต้องอยู่ server-side เท่านั้น
- ใช้ `AIVEN_DATABASE_NAME=student_tracking` เป็นค่า database target และห้ามแสดง `defaultdb`
- browser notification ต้องเริ่มจาก user action; ถ้า permission ไม่ได้ ให้ in-app alert ทำงานต่อ
- provider API error ต้องแสดงเป็น provider error และห้ามตีความเป็น `POWEROFF`
- แก้เฉพาะไฟล์ที่อยู่ในรายการของแต่ละ task
- ห้ามรัน `git add`, `git commit` หรือคำสั่ง Git อื่น ๆ; ผู้ใช้จัดการ Git เอง

---

### Task 1: Add database identity to configuration and domain types

**Files:**
- Modify: `src/lib/env/server.ts`
- Modify: `.env.example`
- Modify: `src/lib/monitor/types.ts`
- Test: `tests/unit/env.test.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: existing `parseServerEnv` and `ServiceStatus`/`MonitorEvent` contracts
- Produces: `ServerEnv.AIVEN_DATABASE_NAME: string`, `ServiceStatus.databaseName?: string`, and `MonitorEvent.databaseName?: string`

- [ ] **Step 1: Write the failing environment test**

เพิ่ม test ใน `tests/unit/env.test.ts`:

```ts
it("defaults the Aiven database target to student_tracking", () => {
  const env = parseServerEnv({
    GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
    SESSION_SIGNING_SECRET: "x".repeat(48),
  });

  expect(env.AIVEN_DATABASE_NAME).toBe("student_tracking");
});

it("accepts an explicit Aiven database target", () => {
  const env = parseServerEnv({
    GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash-string-here",
    SESSION_SIGNING_SECRET: "x".repeat(48),
    AIVEN_DATABASE_NAME: "student_tracking",
  });

  expect(env.AIVEN_DATABASE_NAME).toBe("student_tracking");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- tests/unit/env.test.ts`

Expected: FAIL because `AIVEN_DATABASE_NAME` is not in the parsed environment contract.

- [ ] **Step 3: Implement the config and domain fields**

In `src/lib/env/server.ts`, add the config field beside `AIVEN_PROJECT_NAME`:

```ts
AIVEN_DATABASE_NAME: z.string().default("student_tracking"),
```

In `.env.example`, add:

```env
AIVEN_DATABASE_NAME=student_tracking
```

In `src/lib/monitor/types.ts`, add `databaseName?: string` to both `MonitorEvent` and `ServiceStatus`.

- [ ] **Step 4: Add a type contract assertion**

Add this property to the Aiven service fixture in `tests/unit/types.test.ts`:

```ts
databaseName: "student_tracking",
```

and assert:

```ts
expect(snapshot.providers[0].services[0].databaseName).toBe("student_tracking");
```

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- tests/unit/env.test.ts tests/unit/types.test.ts`

Expected: PASS.

### Task 2: Normalize Aiven states and include database target in events

**Files:**
- Modify: `src/lib/providers/aiven.ts`
- Test: `tests/unit/providers/aiven.test.ts`

**Interfaces:**
- Consumes: `ServerEnv.AIVEN_DATABASE_NAME`, Aiven API service payload, existing `ProviderSnapshot`
- Produces: exported `normalizeAivenState(rawState: string)` and Aiven snapshots with database identity and normalized severity

- [ ] **Step 1: Write failing state normalization tests**

Add this table-driven test to `tests/unit/providers/aiven.test.ts`:

```ts
it.each([
  ["RUNNING", "healthy", "info"],
  ["REBUILDING", "degraded", "warning"],
  ["REBALANCING", "degraded", "warning"],
  ["POWEROFF", "failed", "error"],
  ["POWERED_OFF", "failed", "error"],
  ["FAILED", "failed", "error"],
  ["MAINTENANCE", "unknown", "warning"],
] as const)("maps Aiven state %s", (rawState, status, severity) => {
  expect(normalizeAivenState(rawState)).toEqual({
    status,
    severity,
    normalizedState: rawState.replace(/[^A-Z]/gi, "").toUpperCase(),
  });
});
```

Import `normalizeAivenState` from `@/lib/providers/aiven` before running the test.

- [ ] **Step 2: Run the provider test and verify it fails**

Run: `npm run test -- tests/unit/providers/aiven.test.ts`

Expected: FAIL because `normalizeAivenState` is not defined.

- [ ] **Step 3: Implement the normalizer**

Add this exported function in `src/lib/providers/aiven.ts`:

```ts
export function normalizeAivenState(rawState: string): {
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  normalizedState: string;
} {
  const normalizedState = rawState.replace(/[^A-Z]/gi, "").toUpperCase();

  if (normalizedState === "RUNNING") {
    return { status: "healthy", severity: "info", normalizedState };
  }

  if (normalizedState === "REBUILDING" || normalizedState === "REBALANCING") {
    return { status: "degraded", severity: "warning", normalizedState };
  }

  if (normalizedState === "POWEROFF" || normalizedState === "FAILED") {
    return { status: "failed", severity: "error", normalizedState };
  }

  return { status: "unknown", severity: "warning", normalizedState };
}
```

- [ ] **Step 4: Replace inline Aiven mapping and add database data**

In `AivenProvider.fetchSnapshot`, replace the inline `stateUpper`, `status`, and `severity` branch with:

```ts
const state = normalizeAivenState(data.service.state);
```

Add `databaseName: this.env.AIVEN_DATABASE_NAME` to the service object and event object. Change the event message to:

```ts
`Aiven service ${data.service.service_name} (${data.service.service_type}) state is ${data.service.state}; Database target: ${this.env.AIVEN_DATABASE_NAME}`
```

Use `state.normalizedState` in the event id and `state.status`/`state.severity` for the normalized values. Keep the raw Aiven state in the event `status` field so the log still displays the provider value.

- [ ] **Step 5: Extend provider tests**

Set `AIVEN_DATABASE_NAME: "student_tracking"` in `baseEnv`, then add assertions to the existing successful snapshot test:

```ts
expect(snapshot.services[0].databaseName).toBe("student_tracking");
expect(snapshot.events[0].databaseName).toBe("student_tracking");
expect(snapshot.events[0].message).toContain("Database target: student_tracking");
```

Add a `POWEROFF` fixture using the same mocked response shape and assert:

```ts
expect(snapshot.services[0].status).toBe("failed");
expect(snapshot.events[0].severity).toBe("error");
expect(snapshot.events[0].status).toBe("POWEROFF");
```

- [ ] **Step 6: Run provider tests**

Run: `npm run test -- tests/unit/providers/aiven.test.ts`

Expected: PASS, including `RUNNING`, transitional, power-off, failed, and unknown state cases.

### Task 3: Add pure Aiven incident transition logic

**Files:**
- Create: `src/lib/monitor/aiven-incidents.ts`
- Test: `tests/unit/aiven-incidents.test.ts`

**Interfaces:**
- Consumes: `ServiceStatus[]`
- Produces: `AivenIncidentTransition[]`, incident key format `aiven:<service>` and pure transition functions usable by the client component

- [ ] **Step 1: Write failing transition tests**

Create `tests/unit/aiven-incidents.test.ts` with these contracts:

```ts
import { describe, expect, it } from "vitest";
import type { ServiceStatus } from "@/lib/monitor/types";
import { getAivenIncidentTransitions } from "@/lib/monitor/aiven-incidents";

const service = (status: ServiceStatus["status"]): ServiceStatus => ({
  source: "aiven",
  service: "sts-tracking",
  status,
  checkedAt: "2026-07-28T10:00:00Z",
  databaseName: "student_tracking",
});

describe("getAivenIncidentTransitions", () => {
  it("opens one incident when a healthy service becomes unhealthy", () => {
    expect(getAivenIncidentTransitions([service("healthy")], [service("failed")])).toEqual([
      {
        kind: "opened",
        key: "aiven:sts-tracking",
        service: "sts-tracking",
        status: "failed",
        databaseName: "student_tracking",
      },
    ]);
  });

  it("opens an initial incident when the current service is already unhealthy", () => {
    expect(getAivenIncidentTransitions([], [service("failed")])).toEqual([
      {
        kind: "opened",
        key: "aiven:sts-tracking",
        service: "sts-tracking",
        status: "failed",
        databaseName: "student_tracking",
      },
    ]);
  });

  it("does not reopen an incident while the service stays unhealthy", () => {
    expect(getAivenIncidentTransitions([service("failed")], [service("failed")])).toEqual([]);
  });

  it("returns recovery when the service becomes healthy", () => {
    expect(getAivenIncidentTransitions([service("failed")], [service("healthy")])).toEqual([
      {
        kind: "recovered",
        key: "aiven:sts-tracking",
        service: "sts-tracking",
        status: "healthy",
        databaseName: "student_tracking",
      },
    ]);
  });

  it("ignores non-Aiven services", () => {
    const renderService: ServiceStatus = { ...service("failed"), source: "render" };
    expect(getAivenIncidentTransitions([], [renderService])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- tests/unit/aiven-incidents.test.ts`

Expected: FAIL because the incident module does not exist.

- [ ] **Step 3: Implement the pure transition helper**

Create `src/lib/monitor/aiven-incidents.ts`:

```ts
import type { ServiceStatus } from "./types";

export type AivenIncidentTransition = {
  kind: "opened" | "recovered";
  key: string;
  service: string;
  status: ServiceStatus["status"];
  databaseName?: string;
};

const isAivenUnhealthy = (service: ServiceStatus) =>
  service.source === "aiven" && service.status !== "healthy";

export function getAivenIncidentTransitions(
  previousServices: ServiceStatus[],
  currentServices: ServiceStatus[],
): AivenIncidentTransition[] {
  const previous = new Map(
    previousServices
      .filter((service) => service.source === "aiven")
      .map((service) => [service.service, service]),
  );

  return currentServices
    .filter((service) => service.source === "aiven")
    .flatMap((current) => {
      const previousService = previous.get(current.service);
      const key = `aiven:${current.service}`;

      if (isAivenUnhealthy(current) && (!previousService || previousService.status === "healthy")) {
        return [{ kind: "opened", key, service: current.service, status: current.status, databaseName: current.databaseName }];
      }

      if (current.status === "healthy" && previousService && isAivenUnhealthy(previousService)) {
        return [{ kind: "recovered", key, service: current.service, status: current.status, databaseName: current.databaseName }];
      }

      return [];
    });
}
```

- [ ] **Step 4: Run the helper tests**

Run: `npm run test -- tests/unit/aiven-incidents.test.ts`

Expected: PASS.

### Task 4: Integrate in-app and browser notifications into the dashboard

**Files:**
- Create: `src/components/monitor/AivenIncidentAlerts.tsx`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Modify: `src/components/monitor/ServiceCards.tsx`
- Test: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**
- Consumes: `ServiceStatus[]`, `getAivenIncidentTransitions`, `AivenIncidentTransition`
- Produces: visible Aiven incident banner, recovery message, and user-controlled browser notification permission flow

- [ ] **Step 1: Add failing component assertions**

Extend the dashboard fixture with an Aiven service:

```ts
{
  source: "aiven",
  fetchedAt: "2026-07-25T10:00:00Z",
  stale: false,
  services: [{
    source: "aiven",
    service: "sts-tracking",
    status: "failed",
    checkedAt: "2026-07-25T10:00:00Z",
    databaseName: "student_tracking",
  }],
  events: [{
    id: "a-1",
    source: "aiven",
    service: "sts-tracking",
    type: "database",
    severity: "error",
    status: "POWEROFF",
    message: "Database target: student_tracking",
    occurredAt: "2026-07-25T10:00:00Z",
    databaseName: "student_tracking",
  }],
}
```

Add assertions:

```ts
expect(screen.getByText("student_tracking")).toBeInTheDocument();
expect(screen.getByText(/Aiven.*POWEROFF/i)).toBeInTheDocument();
expect(screen.getByRole("button", { name: /enable browser alerts/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm run test -- tests/components/MonitorDashboard.test.tsx`

Expected: FAIL because the database label and alert component do not exist.

- [ ] **Step 3: Implement the alert component**

Create `src/components/monitor/AivenIncidentAlerts.tsx` with these behaviors:

```ts
const STORAGE_KEY = "project-monitor:aiven-incidents";

type Props = { services: ServiceStatus[] };
```

The component must:

1. Keep the previous service list in a ref.
2. Read and write only non-secret incident keys in `localStorage`; use them to suppress repeated browser notifications after refresh while keeping the in-app alert visible for every current unhealthy service.
3. On an `opened` transition, show an in-app error banner and call `new Notification(...)` only when `Notification.permission === "granted"`.
4. On a `recovered` transition, remove the key and show a short recovery message without opening an error notification.
5. Render a unique button named `Enable browser alerts` when the Notification API is available and permission is not granted. Its click handler calls `Notification.requestPermission()`.
6. Render `Browser notifications are unavailable or blocked` when permission is denied or the API is unavailable, while leaving the in-app banner visible.
7. Treat all Aiven statuses other than `healthy` as active incidents.

Do not call `Notification.requestPermission()` from `useEffect` or during initial render.

- [ ] **Step 4: Mount the alert component**

In `MonitorDashboard.tsx`, import the new component and render it after `ProviderErrors`:

```tsx
{activeSnapshot?.providers && <ProviderErrors providers={activeSnapshot.providers} />}
<AivenIncidentAlerts services={allServices} />
```

Ensure `allServices` is derived from `activeSnapshot` before the component is rendered.

- [ ] **Step 5: Show the database target on service cards**

In `ServiceCards.tsx`, add an Aiven-only line below the service name:

```tsx
{svc.source === "aiven" && svc.databaseName && (
  <div className="text-[10px] font-mono text-cyan-300 truncate" title={svc.databaseName}>
    Database target: {svc.databaseName}
  </div>
)}
```

Keep the service name `sts-tracking` visible so the card distinguishes Aiven service identity from database target.

- [ ] **Step 6: Add notification test setup and assertions**

In `tests/components/MonitorDashboard.test.tsx`, reset storage in `beforeEach` and mock the Notification API with a test double whose `permission` starts as `"default"`, `requestPermission` resolves to `"granted"`, and constructor calls are recorded. Test that:

- initial failed Aiven state renders the in-app alert;
- clicking `Enable browser alerts` requests permission;
- a repeated render with the same failed state does not create a second browser notification for the same key;
- a healthy snapshot clears the incident and a later failed snapshot can open a new incident.

- [ ] **Step 7: Run component tests**

Run: `npm run test -- tests/components/MonitorDashboard.test.tsx`

Expected: PASS.

### Task 5: Document deployment configuration and run the full verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: final `AIVEN_DATABASE_NAME` configuration and browser notification behavior
- Produces: deployment checklist for Preview and Production environments

- [ ] **Step 1: Update the environment documentation**

Add this row to the README environment table:

```md
| `AIVEN_DATABASE_NAME` | Database target shown for the configured Aiven service (default: `student_tracking`) |
```

Add a note under Production Deployment:

```md
Set `AIVEN_DATABASE_NAME=student_tracking` in both Preview and Production when testing both Vercel environments. The dashboard label is a configured database target; it is not a schema-level connectivity proof from the Aiven service endpoint.
```

Add a note that browser notifications require the user to click `Enable browser alerts`, and the in-app alert still works when permission is denied.

- [ ] **Step 2: Verify the complete test suite**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 3: Verify static checks**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 4: Verify the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Apply the Vercel configuration manually**

In Vercel Project Settings, add the non-secret value below to both Preview and Production:

```text
AIVEN_DATABASE_NAME=student_tracking
```

Redeploy after saving the variable. Do not paste provider tokens into documentation or browser-visible output.
