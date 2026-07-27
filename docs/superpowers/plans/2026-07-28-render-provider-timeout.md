# Render Provider Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลด false failure ของ Render provider เมื่อ Render API ตอบช้ากว่า timeout กลาง โดยยังคงให้หน้า monitor ตอบกลับในเวลาที่คาดเดาได้

**Architecture:** คง `fetchJson` เป็น request primitive เดิม แต่ให้รองรับข้อความ timeout ตามค่าจริงที่ส่งเข้าไป Render provider จะใช้ timeout เฉพาะ 15 วินาทีและเรียก endpoint service details กับ deploys แบบขนานต่อ service เพื่อลดเวลารวมของ request โดยไม่เพิ่ม retry ในรอบนี้

**Tech Stack:** Next.js App Router, TypeScript, native `fetch`, Zod, Vitest

## Global Constraints

- แก้เฉพาะ Project Monitor ใน `E:\project-monitor`
- ใช้ GET กับ Render API เท่านั้น ห้ามเพิ่ม deploy, restart หรือ mutation request
- เก็บ API key ฝั่ง server ผ่าน `server-only` และห้ามส่ง secret ไป client
- คง default timeout ของ provider อื่นไว้ที่ 8 วินาที
- Render request timeout ใหม่ต้องเป็น 15,000 มิลลิวินาที
- ห้ามเพิ่ม dependency ใหม่
- ห้ามรัน `git add` หรือ `git commit`; ผู้ใช้จัดการ Git เอง

---

## Current diagnosis and file map

- `src/lib/providers/request.ts` มี default timeout 8 วินาที และข้อความ error เขียนตายตัวว่า `8s` แม้ caller จะส่ง timeout อื่น
- `src/lib/providers/render.ts` เรียก `GET /v1/services/:id` ก่อน แล้วจึงเรียก `GET /v1/services/:id/deploys?limit=10` ทำให้สอง request ต่อกัน
- `tests/unit/provider-request.test.ts` ยังไม่มี test สำหรับ custom timeout หรือ timeout message
- `tests/unit/providers/render.test.ts` ตรวจ normalization แล้ว แต่ยังไม่ตรวจว่า request ของ Render ถูกเริ่มพร้อมกัน

## Task 1: Make timeout errors reflect the configured duration

**Files:**
- Modify: `src/lib/providers/request.ts`
- Test: `tests/unit/provider-request.test.ts`

**Interfaces:**
- Preserve `fetchJson<T>(url, init, schema, callerSignal?, timeoutMs?)` signature.
- Preserve `ProviderError` code `timeout`.
- Change only the timeout message to use the actual `timeoutMs` value.

- [ ] **Step 1: Write the failing test**

Add a test that supplies a 15ms timeout, keeps the mocked request pending until its signal aborts, and expects the error message to contain `15ms`:

```ts
it("uses the configured timeout in timeout errors", async () => {
  vi.useFakeTimers();
  const mockSchema = z.object({ ok: z.boolean() });
  const mockFetch = vi.fn((_url: string, init?: RequestInit) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
  );
  vi.stubGlobal("fetch", mockFetch);

  const request = fetchJson(
    "https://api.example.com/test",
    {},
    mockSchema,
    undefined,
    15,
  );
  const assertion = expect(request).rejects.toSatisfy(
    (err: unknown) =>
      err instanceof ProviderError &&
      err.code === "timeout" &&
      err.message === "Provider request timed out after 15ms",
  );

  await vi.advanceTimersByTimeAsync(15);
  await assertion;

  vi.useRealTimers();
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- tests/unit/provider-request.test.ts`

Expected: FAIL because `fetchJson` currently reports `Provider request timed out after 8s`.

- [ ] **Step 3: Implement the minimal fix**

In the `AbortError` branch of `src/lib/providers/request.ts`, format whole-second values as seconds and sub-second values as milliseconds:

```ts
const timeoutLabel = timeoutMs % 1000 === 0
  ? `${timeoutMs / 1000}s`
  : `${timeoutMs}ms`;

throw new ProviderError(
  "timeout",
  `Provider request timed out after ${timeoutLabel}`,
);
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test -- tests/unit/provider-request.test.ts`

Expected: all tests in that file pass.

## Task 2: Make Render requests tolerant and concurrent

**Files:**
- Modify: `src/lib/providers/render.ts`
- Test: `tests/unit/providers/render.test.ts`

**Interfaces:**
- Preserve `RenderProvider.fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot>`.
- Preserve existing service and event normalization.
- Continue passing the caller `AbortSignal` to both upstream requests.

- [ ] **Step 1: Write the failing concurrency test**

Add a test that keeps the service-details request pending, immediately returns deploy data for the deploy request, and asserts both URLs have started before the service-details request is released:

```ts
it("starts service details and deploy requests concurrently", async () => {
  const envWithKey: ServerEnv = {
    ...baseEnv,
    RENDER_API_KEY: "rnd_key_123",
  };
  const startedUrls: string[] = [];
  let releaseService!: (value: unknown) => void;
  const serviceResponse = new Promise((resolve) => {
    releaseService = resolve;
  });

  const mockFetch = vi.fn((url: string) => {
    startedUrls.push(url);
    if (url.includes("/deploys")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [],
      });
    }
    return serviceResponse.then(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "srv_123",
        name: "backend",
        dashboardUrl: "https://dashboard.render.com/web/srv_123",
      }),
    }));
  });
  vi.stubGlobal("fetch", mockFetch);

  const provider = new RenderProvider(envWithKey);
  const snapshotPromise = provider.fetchSnapshot();
  await Promise.resolve();

  expect(startedUrls).toEqual([
    "https://api.render.com/v1/services/srv_123",
    "https://api.render.com/v1/services/srv_123/deploys?limit=10",
  ]);

  releaseService(undefined);
  await expect(snapshotPromise).resolves.toMatchObject({
    services: [{ service: "backend", status: "unknown" }],
  });

  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- tests/unit/providers/render.test.ts`

Expected: FAIL because the current provider does not start the deploy request until service details has completed.

- [ ] **Step 3: Implement the Render-specific timeout and concurrency**

Add the constant near the Render schemas:

```ts
const RENDER_REQUEST_TIMEOUT_MS = 15_000;
```

Replace the two sequential `await fetchJson(...)` calls with one `Promise.all` that passes the timeout as the fifth argument:

```ts
const [serviceData, deploysData] = await Promise.all([
  fetchJson(
    `https://api.render.com/v1/services/${encodeURIComponent(serviceRef.id)}`,
    { headers },
    renderServiceSchema,
    signal,
    RENDER_REQUEST_TIMEOUT_MS,
  ),
  fetchJson(
    `https://api.render.com/v1/services/${encodeURIComponent(serviceRef.id)}/deploys?limit=10`,
    { headers },
    renderDeploysResponseSchema,
    signal,
    RENDER_REQUEST_TIMEOUT_MS,
  ),
]);
```

Do not add a retry in this task. The monitor refreshes every 15 seconds, and a retry would increase latency and API traffic when the upstream is already slow.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npm run test -- tests/unit/provider-request.test.ts tests/unit/providers/render.test.ts`

Expected: all request and Render provider tests pass.

## Task 3: Update the implementation notes and verify the whole app

**Files:**
- Modify: `docs/superpowers/plans/2026-07-25-project-monitor-implementation.md:17`
- Modify: `docs/superpowers/specs/2026-07-25-project-monitor-design.md:60`

**Interfaces:**
- Documentation must state that the generic default remains 8 seconds and Render overrides it to 15 seconds.

- [ ] **Step 1: Update the two timeout notes**

Change the generic design/plan wording from `provider timeout 8 วินาที` to:

```text
provider timeout default 8 วินาที; Render API requests use a 15-second provider-specific timeout
```

- [ ] **Step 2: Run the complete verification suite**

Run:

```text
npm run test
npm run typecheck
npm run lint
npm run build
```

Expected:

- Vitest passes all tests.
- TypeScript exits with code 0.
- ESLint exits with code 0.
- Next.js production build completes and includes `/api/monitor/snapshot`.

- [ ] **Step 3: Verify the live local snapshot**

With the local server running and authenticated, refresh `http://localhost:3000/monitor` several times. Confirm that:

- Render no longer fails merely because the API takes between 8 and 15 seconds.
- Render service status and deploy events still normalize as before.
- A genuine response timeout displays `Provider request timed out after 15s` only after the Render-specific limit is exceeded.
- Vercel, Aiven, and Health results remain unchanged.

No Git operations are included; the user will review and commit the resulting changes manually.
