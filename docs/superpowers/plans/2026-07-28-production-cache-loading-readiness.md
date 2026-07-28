# Production Cache and Loading Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ Monitor แสดงข้อมูลและ log ได้ลื่นบน production โดยข้อมูลไม่ค้างจาก cache, ไม่มี request ซ้อน, terminal ไม่หน่วงเมื่อ log เยอะ และผู้ใช้กู้แอปจาก cache/session เสียได้โดยไม่แตะข้อมูลบน server

**Architecture:** ใช้ stale-while-revalidate เฉพาะ snapshot ฝั่ง server พร้อม single-flight เพื่อรวม provider requests ที่เกิดพร้อมกัน ส่วน API, HTML, auth และ test logs ใช้ `private, no-store` เสมอ ฝั่ง client ใช้ adaptive polling, AbortController, loading ที่ไม่ล้างข้อมูลเดิม และจำกัดจำนวน DOM nodes ของ terminal ขณะที่ service worker cache เฉพาะ static brand assets

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Playwright, Service Worker, Upstash Redis, Vercel

## Global Constraints

- ห้าม cache API response, HTML page, auth response, cookie หรือ test log ใน Service Worker หรือ browser HTTP cache
- Snapshot cache สดได้ 30 วินาที และใช้ stale fallback ได้ไม่เกิน 5 นาทีเมื่อ provider ล้มเหลว
- ในหนึ่ง server instance ต้องมี provider refresh พร้อมกันไม่เกินหนึ่งชุด
- Terminal เก็บใน React state ไม่เกิน 1,000 lines และ render ใน DOM ไม่เกิน 300 lines
- Poll job ทุก 1 วินาทีเฉพาะตอน job active, ทุก 5 วินาทีตอน idle และหยุด poll เมื่อ tab hidden
- ห้ามเพิ่ม dependency สำหรับ virtualization, cache หรือ polling
- `Reset app data` ล้างเฉพาะข้อมูล browser ของ Monitor และห้ามลบ job, provider log, database หรือ environment variables
- งาน Git เป็นของผู้ใช้ ทุก task จบด้วย user-managed Git checkpoint และไม่มีคำสั่ง Git ในแผนนี้

---

## File Map

- Create `src/lib/http/fetch-no-store.ts`: wrapper สำหรับ browser fetch ที่บังคับ `cache: "no-store"` และรับ AbortSignal
- Create `src/lib/monitor/snapshot-coordinator.ts`: fresh/stale cache และ single-flight refresh ของ monitor snapshot
- Create `src/components/monitor/MonitorLoadingState.tsx`: skeleton และข้อความ loading/error ที่ไม่แทนข้อมูลเดิมตอน background refresh
- Create `src/components/settings/ResetAppDataButton.tsx`: logout และล้าง browser data เฉพาะ Monitor
- Create `tests/unit/monitor/snapshot-coordinator.test.ts`: ทดสอบ fresh, stale, expiry และ request deduplication
- Create `tests/unit/http/fetch-no-store.test.ts`: ทดสอบ fetch options
- Create `tests/components/MonitorLoadingState.test.tsx`: ทดสอบ initial loading และ background refresh
- Create `tests/components/ResetAppDataButton.test.tsx`: ทดสอบขอบเขตข้อมูลที่ถูกล้าง
- Create `e2e/cache-loading.spec.ts`: production-like smoke test เรื่อง headers, loading และ stale asset
- Modify `src/lib/monitor/types.ts`: เพิ่ม `cacheStatus: "fresh" | "stale"` ใน `MonitorSnapshot`
- Modify `src/lib/monitor/aggregate.ts`: ใช้ snapshot coordinator และ stale fallback
- Modify `src/app/api/monitor/snapshot/route.ts`: ส่ง cache status และ no-store headers ทุก response
- Modify `src/components/monitor/MonitorLogsPage.tsx`: abortable refresh, retry backoff และ loading UI
- Modify `src/components/monitor/AutoRefreshControl.tsx`: แสดง refreshing, stale และ retry state
- Modify `src/components/test-runner/useTestRunner.ts`: adaptive polling, no-store fetch, dedupe sequence และ cleanup
- Modify `src/components/test-runner/LiveTestTerminal.tsx`: render cap 300 และ requestAnimationFrame auto-scroll
- Modify `src/components/test-runner/TestRunnerWorkspace.tsx`: แสดง terminal loading/reconnecting state
- Modify `src/components/monitor/MonitorShell.tsx`: วาง Reset app data ในเมนูผู้ใช้
- Modify `src/components/PwaRegistration.tsx`: ตรวจ service worker update โดยไม่ reload loop
- Modify `public/sw.js`: cache เฉพาะ static assets และใช้ cache version ใหม่
- Modify `README.md`: วิธี reset cache/session และ production verification

---

### Task 1: Enforce No-Store for Browser Data Requests

**Files:**
- Create: `src/lib/http/fetch-no-store.ts`
- Modify: `src/components/monitor/MonitorLogsPage.tsx`
- Modify: `src/components/test-runner/useTestRunner.ts`
- Test: `tests/unit/http/fetch-no-store.test.ts`

**Interfaces:**
- Produces: `fetchNoStore(input: RequestInfo | URL, init?: RequestInit): Promise<Response>`
- Consumes: native `fetch` and optional `AbortSignal` in `RequestInit`

- [ ] **Step 1: Write the failing fetch wrapper test**

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNoStore } from "@/lib/http/fetch-no-store";

describe("fetchNoStore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forces same-origin credentials and no-store cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchNoStore("/api/monitor/snapshot", { signal: new AbortController().signal });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitor/snapshot",
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npx vitest run tests/unit/http/fetch-no-store.test.ts`

Expected: FAIL because `src/lib/http/fetch-no-store.ts` does not exist

- [ ] **Step 3: Implement the wrapper**

```ts
export function fetchNoStore(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
}
```

- [ ] **Step 4: Replace browser API fetch calls in monitor and test runner**

Import `fetchNoStore` and replace GET requests for snapshot, lock, catalog, jobs and job details. Keep POST requests explicit but add `cache: "no-store"` to their `RequestInit`.

```ts
const response = await fetchNoStore(url, { signal: controller.signal });
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/unit/http/fetch-no-store.test.ts tests/components/TestRunnerWorkspace.test.tsx`

Expected: PASS with no cached browser API requests

- [ ] **Step 6: User-managed Git checkpoint**

Review only `src/lib/http/fetch-no-store.ts`, the two consumers and their tests before the user commits manually.

### Task 2: Add Fresh/Stale Snapshot Cache with Single-Flight Refresh

**Files:**
- Create: `src/lib/monitor/snapshot-coordinator.ts`
- Modify: `src/lib/monitor/types.ts`
- Modify: `src/lib/monitor/aggregate.ts`
- Modify: `src/app/api/monitor/snapshot/route.ts`
- Test: `tests/unit/monitor/snapshot-coordinator.test.ts`
- Test: `tests/integration/snapshot-route.test.ts`

**Interfaces:**
- Produces: `SnapshotCoordinator<T>` with `read(now)`, `write(value, now)`, `run(loader, force, now)` and `clear()`
- Produces: `MonitorSnapshot.cacheStatus: "fresh" | "stale"`
- Consumes: provider loader returning `Promise<MonitorSnapshot>`

- [ ] **Step 1: Write cache state and single-flight tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { SnapshotCoordinator } from "@/lib/monitor/snapshot-coordinator";

describe("SnapshotCoordinator", () => {
  it("returns fresh for 30 seconds and stale for at most 5 minutes", () => {
    const cache = new SnapshotCoordinator<string>(30_000, 300_000);
    cache.write("snapshot", 1_000);
    expect(cache.read(30_999)).toEqual({ value: "snapshot", state: "fresh" });
    expect(cache.read(31_000)).toEqual({ value: "snapshot", state: "stale" });
    expect(cache.read(301_000)).toBeNull();
  });

  it("joins concurrent refresh calls", async () => {
    const cache = new SnapshotCoordinator<string>(30_000, 300_000);
    const loader = vi.fn(async () => "new snapshot");
    const [first, second] = await Promise.all([
      cache.run(loader, true, 1_000),
      cache.run(loader, true, 1_000),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toBe("new snapshot");
    expect(second).toBe("new snapshot");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run tests/unit/monitor/snapshot-coordinator.test.ts`

Expected: FAIL because `SnapshotCoordinator` is not implemented

- [ ] **Step 3: Implement the coordinator**

```ts
interface SnapshotEntry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
}

export class SnapshotCoordinator<T> {
  private entry: SnapshotEntry<T> | null = null;
  private inFlight: Promise<T> | null = null;

  constructor(
    private readonly freshTtlMs: number,
    private readonly staleTtlMs: number,
  ) {}

  read(now = Date.now()): { value: T; state: "fresh" | "stale" } | null {
    if (!this.entry || now >= this.entry.staleUntil) return null;
    return {
      value: this.entry.value,
      state: now < this.entry.freshUntil ? "fresh" : "stale",
    };
  }

  write(value: T, now = Date.now()): void {
    this.entry = {
      value,
      freshUntil: now + this.freshTtlMs,
      staleUntil: now + this.staleTtlMs,
    };
  }

  async run(loader: () => Promise<T>, force = false, now = Date.now()): Promise<T> {
    const cached = this.read(now);
    if (!force && cached?.state === "fresh") return cached.value;
    if (this.inFlight) return this.inFlight;
    this.inFlight = loader().then((value) => {
      this.write(value);
      return value;
    }).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  clear(): void {
    this.entry = null;
    this.inFlight = null;
  }
}
```

- [ ] **Step 4: Route aggregate calls through the coordinator**

Move the existing provider `Promise.allSettled` block into `loadMonitorSnapshot`. In `getMonitorSnapshot`, return fresh cache immediately, join an in-flight refresh, and return stale fallback only when refresh throws.

```ts
const snapshotCoordinator = new SnapshotCoordinator<MonitorSnapshot>(30_000, 300_000);

export async function getMonitorSnapshot(options: AggregateOptions = {}) {
  const cached = snapshotCoordinator.read();
  try {
    const snapshot = await snapshotCoordinator.run(
      () => loadMonitorSnapshot(options),
      options.forceRefresh === true,
    );
    return { ...snapshot, cacheStatus: "fresh" as const };
  } catch (error) {
    if (cached) {
      return {
        ...cached.value,
        partial: true,
        cacheStatus: "stale" as const,
        providers: cached.value.providers.map((provider) => ({ ...provider, stale: true })),
      };
    }
    throw error;
  }
}
```

- [ ] **Step 5: Assert no-store headers and stale response shape**

Extend `tests/integration/snapshot-route.test.ts` to assert:

```ts
expect(response.headers.get("Cache-Control")).toBe("private, no-store");
expect(body.cacheStatus).toMatch(/fresh|stale/);
```

- [ ] **Step 6: Run monitor tests**

Run: `npx vitest run tests/unit/monitor tests/integration/snapshot-route.test.ts`

Expected: PASS; concurrent refresh invokes providers once and stale data expires after 5 minutes

- [ ] **Step 7: User-managed Git checkpoint**

Review the coordinator, aggregate changes, type change and route tests before the user commits manually.

### Task 3: Make Monitor Loading Non-Blocking and Recoverable

**Files:**
- Create: `src/components/monitor/MonitorLoadingState.tsx`
- Modify: `src/components/monitor/MonitorLogsPage.tsx`
- Modify: `src/components/monitor/AutoRefreshControl.tsx`
- Test: `tests/components/MonitorLoadingState.test.tsx`
- Test: `tests/components/MonitorLogsPage.test.tsx`

**Interfaces:**
- Produces: `MonitorLoadingState({ mode, message })`
- Produces monitor states: `initial`, `ready`, `refreshing`, `retrying`, `stale`
- Consumes: `MonitorSnapshot.cacheStatus`

- [ ] **Step 1: Write loading state tests**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MonitorLoadingState from "@/components/monitor/MonitorLoadingState";

describe("MonitorLoadingState", () => {
  it("renders a status skeleton for the first load", () => {
    render(<MonitorLoadingState mode="initial" message="Loading provider status" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading provider status");
  });

  it("announces retry without replacing existing content", () => {
    render(<MonitorLoadingState mode="retrying" message="Retrying in 10 seconds" />);
    expect(screen.getByRole("status")).toHaveTextContent("Retrying in 10 seconds");
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/components/MonitorLoadingState.test.tsx`

Expected: FAIL because the component does not exist

- [ ] **Step 3: Implement loading UI**

Use `role="status"`, `aria-live="polite"`, three fixed skeleton rows for `initial`, and a compact status banner for `refreshing`, `retrying` and `stale`. Do not hide `ServiceCards` or `TerminalPanel` during background refresh.

- [ ] **Step 4: Replace interval scheduling with abortable timeout scheduling**

Add `AbortController`, `consecutiveFailuresRef`, and exact retry delays `[5, 10, 20, 60]` seconds. Abort on unmount and before starting a manual refresh.

```ts
const retryDelaysSeconds = [5, 10, 20, 60] as const;
const abortRef = useRef<AbortController | null>(null);

const controller = new AbortController();
abortRef.current?.abort();
abortRef.current = controller;
const response = await fetchNoStore(url, { signal: controller.signal });
```

On success reset failure count to zero. On abort do not show an error. On network failure keep the existing snapshot and schedule the indexed retry delay.

- [ ] **Step 5: Update refresh control copy**

`AutoRefreshControl` must show exactly one of `LIVE`, `INCIDENT`, `REFRESHING`, `RETRYING`, `STALE`, `PAUSED`. Disable only the manual refresh button while the same refresh is active.

- [ ] **Step 6: Run component tests**

Run: `npx vitest run tests/components/MonitorLoadingState.test.tsx tests/components/MonitorLogsPage.test.tsx tests/components/AutoRefreshControl.test.tsx`

Expected: PASS; background refresh leaves current events visible and retry countdown is announced

- [ ] **Step 7: User-managed Git checkpoint**

Review loading UI, retry state and request cancellation before the user commits manually.

### Task 4: Reduce Test Terminal Latency Without Increasing Load

**Files:**
- Modify: `src/components/test-runner/useTestRunner.ts`
- Modify: `src/components/test-runner/LiveTestTerminal.tsx`
- Modify: `src/components/test-runner/TestRunnerWorkspace.tsx`
- Test: `tests/components/LiveTestTerminal.test.tsx`
- Test: `tests/components/TestRunnerWorkspace.test.tsx`

**Interfaces:**
- Produces: `terminalState: "idle" | "connecting" | "streaming" | "reconnecting"`
- Produces: `hiddenLineCount: number`
- Consumes: sequence-based job log API with maximum page size 200

- [ ] **Step 1: Write high-volume terminal tests**

```tsx
it("renders at most 300 newest lines", () => {
  const lines = Array.from({ length: 1_000 }, (_, sequence) => ({
    sequence,
    stream: "stdout" as const,
    message: `line ${sequence}`,
    occurredAt: new Date(sequence).toISOString(),
  }));
  render(<LiveTestTerminal lines={lines} />);
  expect(screen.getAllByTestId("terminal-line")).toHaveLength(300);
  expect(screen.getByText("700 older lines hidden")).toBeInTheDocument();
});
```

Add a second test that dispatches scroll away from the bottom and asserts new lines do not force `scrollTop` to `scrollHeight`.

- [ ] **Step 2: Run and verify the render-cap failure**

Run: `npx vitest run tests/components/LiveTestTerminal.test.tsx`

Expected: FAIL because the current component renders up to 1,000 nodes

- [ ] **Step 3: Implement terminal render cap and rAF scroll**

```ts
const MAX_RENDERED_LINES = 300;
const hiddenLineCount = Math.max(0, lines.length - MAX_RENDERED_LINES);
const visibleLines = lines.slice(-MAX_RENDERED_LINES);

useEffect(() => {
  if (!autoScroll || !containerRef.current) return;
  const frame = requestAnimationFrame(() => {
    const node = containerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  });
  return () => cancelAnimationFrame(frame);
}, [lines.length, autoScroll]);
```

- [ ] **Step 4: Replace fixed interval with adaptive non-overlapping timeout**

Use 1,000ms while `isActiveStatus(job.status)`, 5,000ms when idle, and do not schedule while `document.visibilityState !== "visible"`. Use one AbortController per poll and abort on cleanup.

Deduplicate incoming lines before state update:

```ts
setTerminalLines((previous) => {
  const known = new Set(previous.map((line) => line.sequence));
  const appended = incoming.filter((line) => !known.has(line.sequence));
  return [...previous, ...appended].slice(-1_000);
});
```

Fetch history only on initial load, manual refresh and job transition from active to terminal status.

- [ ] **Step 5: Add reconnecting state**

After one failed poll set `terminalState` to `reconnecting`; keep existing lines visible. Clear it on the next successful response. After HTTP 401 redirect to `/login`.

- [ ] **Step 6: Run terminal and workspace tests**

Run: `npx vitest run tests/components/LiveTestTerminal.test.tsx tests/components/TestRunnerWorkspace.test.tsx`

Expected: PASS; maximum 300 DOM lines, no duplicate sequences and no overlapping poll

- [ ] **Step 7: User-managed Git checkpoint**

Review polling frequency, cleanup, line dedupe and DOM cap before the user commits manually.

### Task 5: Add Safe Reset App Data

**Files:**
- Create: `src/components/settings/ResetAppDataButton.tsx`
- Modify: `src/components/monitor/MonitorShell.tsx`
- Modify: `src/app/api/auth/logout/route.ts`
- Test: `tests/components/ResetAppDataButton.test.tsx`
- Test: `tests/integration/auth-routes.test.ts`

**Interfaces:**
- Produces: `resetMonitorBrowserData(): Promise<void>`
- Consumes: `/api/auth/logout`, Cache Storage, service worker registrations, prefixed local/session storage

- [ ] **Step 1: Write the reset boundary test**

```tsx
it("logs out and clears only Monitor browser data", async () => {
  localStorage.setItem("monitor:filters", "all");
  localStorage.setItem("other-app", "keep");
  sessionStorage.setItem("project_monitor_tab_session", "active");

  render(<ResetAppDataButton />);
  await userEvent.click(screen.getByRole("button", { name: "Reset app data" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirm reset" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "/api/auth/logout",
    expect.objectContaining({ method: "POST" }),
  ));
  expect(localStorage.getItem("monitor:filters")).toBeNull();
  expect(localStorage.getItem("other-app")).toBe("keep");
  expect(sessionStorage.getItem("project_monitor_tab_session")).toBeNull();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/components/ResetAppDataButton.test.tsx`

Expected: FAIL because the reset component does not exist

- [ ] **Step 3: Implement scoped reset**

The first click reveals confirmation text. The second click performs operations in this order:

```ts
await fetch("/api/auth/logout", {
  method: "POST",
  cache: "no-store",
  credentials: "same-origin",
});

for (const key of await caches.keys()) {
  if (key.startsWith("project-monitor-")) await caches.delete(key);
}

for (const registration of await navigator.serviceWorker.getRegistrations()) {
  if (registration.scope === `${window.location.origin}/`) {
    await registration.unregister();
  }
}

for (const storage of [localStorage, sessionStorage]) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("monitor:") || key?.startsWith("project_monitor_")) {
      storage.removeItem(key);
    }
  }
}

window.location.replace("/login?reset=1");
```

- [ ] **Step 4: Verify logout clears the HttpOnly session cookie**

Keep the existing route behavior with `maxAge: 0`, `httpOnly: true`, production `secure: true`, `sameSite: "lax"`, and `path: "/"`. Extend the integration test to assert all five properties.

- [ ] **Step 5: Run reset and auth tests**

Run: `npx vitest run tests/components/ResetAppDataButton.test.tsx tests/integration/auth-routes.test.ts`

Expected: PASS; unrelated storage survives and the server cookie is removed

- [ ] **Step 6: User-managed Git checkpoint**

Review reset scope, confirmation and logout cookie behavior before the user commits manually.

### Task 6: Harden Service Worker Updates

**Files:**
- Modify: `public/sw.js`
- Modify: `src/components/PwaRegistration.tsx`
- Test: `tests/components/PwaRegistration.test.tsx`
- Test: `e2e/cache-loading.spec.ts`

**Interfaces:**
- Produces static cache `project-monitor-static-v3`
- Consumes only `/icons/icon-192.png` and `/icons/icon-512.png`

- [ ] **Step 1: Write service worker registration tests**

Assert that the component registers `/sw.js`, calls `registration.update()` once per page load, and does not call `window.location.reload()` more than once on `controllerchange`.

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/components/PwaRegistration.test.tsx`

Expected: FAIL because the current registration never calls `update()`

- [ ] **Step 3: Bump and restrict the static cache**

Set `CACHE_NAME` to `project-monitor-static-v3`. Keep API, `/monitor`, `/login` and non-GET requests outside `respondWith`. In the remaining fetch handler, call `caches.match` only for URLs listed in `STATIC_ASSETS`; all other requests use normal browser networking.

- [ ] **Step 4: Add safe update handling**

Use a module-level `hasReloadedForControllerChange` boolean. Register the worker, call `registration.update()`, and reload once only when a new worker takes control.

- [ ] **Step 5: Add E2E cache assertions**

In `e2e/cache-loading.spec.ts`, assert:

```ts
const apiResponse = await request.get("/api/monitor/snapshot");
expect(apiResponse.headers()["cache-control"]).toContain("no-store");

const serviceWorker = await request.get("/sw.js");
expect(await serviceWorker.text()).not.toContain('caches.open("api');
```

Use the existing authenticated E2E setup for the snapshot request.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/components/PwaRegistration.test.tsx`

Run: `npx playwright test e2e/cache-loading.spec.ts`

Expected: PASS; API is no-store and service worker caches only static icons

- [ ] **Step 7: User-managed Git checkpoint**

Review worker scope, update loop protection and E2E headers before the user commits manually.

### Task 7: Production Verification and Documentation

**Files:**
- Modify: `README.md`
- Verify: `docs/superpowers/plans/2026-07-28-pwa-desktop-installation.md`

**Interfaces:**
- Consumes all behavior from Tasks 1-6
- Produces a repeatable production checklist

- [ ] **Step 1: Document operating targets**

Add these exact acceptance targets to `README.md`:

- Cached monitor content remains visible during refresh and provider failure
- No more than one monitor refresh and one job poll may be in flight per browser tab
- New test log lines appear within 2 seconds at p95 while the tab is visible
- Terminal renders no more than 300 log line nodes and retains no more than 1,000 lines in memory
- API, auth, HTML and test logs never appear in Cache Storage
- Stale snapshot fallback expires after 5 minutes
- Reset app data never deletes server-side jobs, logs or provider data

- [ ] **Step 2: Run the complete release gate**

Run in order:

```powershell
npm run test
npm run lint
npm run typecheck
npm run test-agent:build
npm run build
npm run test:e2e
```

Expected: all commands exit 0; lint has 0 errors and remove the five current unused-variable warnings before release

- [ ] **Step 3: Verify production response headers after deploy**

Check `/api/monitor/snapshot`, `/api/test-runner/jobs`, `/api/test-runner/jobs/{jobId}`, `/api/auth/login`, `/monitor` and `/sw.js`. API/auth must be `private, no-store`; HTML must not be stored by the service worker; `/sw.js` must serve the v3 cache name.

- [ ] **Step 4: Verify loading and terminal behavior on desktop PWA**

Install from Chrome or Edge, run a preset producing at least 1,000 lines, background the app for 30 seconds, return to it and confirm one catch-up poll with no duplicate lines. Disconnect network, confirm existing content remains with `STALE` or `RECONNECTING`, reconnect and confirm recovery without manual reload.

- [ ] **Step 5: Verify reset behavior**

Use `Reset app data`, confirm redirect to `/login?reset=1`, confirm the next login re-registers service worker v3, and confirm provider/job history remains available from the server.

- [ ] **Step 6: User-managed Git checkpoint**

The user reviews release output and production smoke-test evidence before committing or deploying manually.

## Self-Review

- [ ] Spec coverage: cache freshness, stale fallback, request deduplication, loading states, terminal latency, reset flow, service worker update and production verification each map to a task
- [ ] Placeholder scan: no task contains deferred implementation language or an undefined function
- [ ] Type consistency: `cacheStatus`, `terminalState`, `fetchNoStore` and `SnapshotCoordinator` use the same signatures in producers, consumers and tests
- [ ] Cache boundary: only snapshot data has a server-side fresh/stale cache; API HTTP responses, auth, HTML and logs remain no-store
- [ ] Resource boundary: polling and rendering limits satisfy Upstash/Vercel safety requirements without adding dependencies
- [ ] Security boundary: reset calls server logout for HttpOnly cookie and clears only same-origin prefixed browser data
- [ ] Workspace rule: implementation includes no automatic Git operation

## Execution Handoff

Plan complete and ready for either subagent-driven execution or inline execution. The recommended order is Task 1 through Task 7 because later tasks consume the cache and loading interfaces defined earlier.
