# Project Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง Next.js full-stack read-only monitor สำหรับสมาชิกกลุ่มโดยไม่มี database และไม่ expose provider credentials

**Architecture:** Next.js App Router ให้ React UI เรียก authenticated route handlers ภายใน project เดียว Provider adapters ดึงข้อมูลฝั่ง server, normalize, redact และรวมเป็น snapshot โดยใช้ memory cache ระยะสั้น

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, Zod, jose, bcryptjs, Vitest, React Testing Library, Playwright, Vercel

## Global Constraints

- Project root คือ `E:\project-monitor`
- ไม่มี database, Redis, queue หรือ WebSocket
- ใช้ shared group password และ stateless HttpOnly session cookie
- ทุก provider integration เป็น read-only
- provider timeout 8 วินาที
- polling interval 15 วินาที
- memory cache TTL 10 วินาที
- session อายุ 8 ชั่วโมง
- ใช้ Vercel project เดียวเป็น frontend และ backend route handlers
- รองรับ PWA install แต่ไม่มี standalone `.exe` ในรุ่นแรก
- ห้าม hardcode project, service หรือ cron job ID ใน source code
- การเปลี่ยน monitored project ทำผ่าน environment variables และ redeploy เท่านั้น
- ห้ามส่ง provider token, environment variables หรือ raw upstream payload ไป browser
- ห้ามเพิ่ม deploy, restart, retry job หรือ configuration mutation
- ห้ามดำเนินการ Git โดยอัตโนมัติ ผู้ใช้จัดการ Git เอง

---

## File map

ไฟล์หลักที่จะสร้าง:

```text
E:\project-monitor
├── .env.example
├── package.json
├── next.config.ts
├── src
│   ├── app
│   │   ├── api
│   │   │   ├── auth
│   │   │   │   ├── login\route.ts
│   │   │   │   └── logout\route.ts
│   │   │   └── monitor
│   │   │       ├── session\route.ts
│   │   │       └── snapshot\route.ts
│   │   ├── login\page.tsx
│   │   ├── monitor\page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   └── monitor
│   │       ├── AutoRefreshControl.tsx
│   │       ├── MonitorDashboard.tsx
│   │       ├── ProviderErrors.tsx
│   │       ├── ServiceCards.tsx
│   │       ├── SourceFilters.tsx
│   │       └── TerminalPanel.tsx
│   ├── lib
│   │   ├── auth
│   │   │   ├── password.ts
│   │   │   └── session.ts
│   │   ├── env\server.ts
│   │   ├── monitor
│   │   │   ├── aggregate.ts
│   │   │   ├── cache.ts
│   │   │   ├── redact.ts
│   │   │   └── types.ts
│   │   └── providers
│   │       ├── aiven.ts
│   │       ├── cronjob.ts
│   │       ├── health.ts
│   │       ├── render.ts
│   │       ├── request.ts
│   │       ├── types.ts
│   │       └── vercel.ts
│   └── proxy.ts
├── scripts\hash-password.mjs
├── tests
│   ├── components
│   ├── integration
│   └── unit
└── e2e\monitor.spec.ts
```

## Implementation order

ให้ทำตามลำดับนี้ เพราะ frontend ต้องใช้สัญญาข้อมูลและ API จาก backend:

1. **Foundation — Task 1-2:** สร้าง Next.js project, test tooling, environment parser และชนิดข้อมูลกลาง
2. **Backend — Task 3-7:** ทำ authentication, redaction, cache, provider adapters, aggregator, API routes, diagnostic command และ optional agent ingestion
3. **Frontend — Task 8:** ทำหน้า login, dashboard, service cards, filters, terminal และ polling controls โดยเรียกเฉพาะ API ภายใน Next.js
4. **Verification — Task 9:** ทดสอบเส้นทางจริงตั้งแต่ login ถึง dashboard และตรวจว่า secret ไม่เข้า browser
5. **Deployment — Task 10:** ตั้งค่า read-only credentials บน Vercel และตรวจ acceptance criteria ใน production

Backend และ frontend อยู่ใน Next.js repository เดียวกัน แต่แยกขอบเขตด้วย `src/lib` และ `src/app/api` สำหรับ server กับ `src/components` และ page components สำหรับ browser ห้าม import provider modules หรือ server environment เข้า client components

## Task 1: Scaffold Next.js and test tooling

**Files:**

- Create: `package.json`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `scripts/hash-password.mjs`

**Interfaces:**

- Produces: project scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `hash-password`

- [ ] **Step 1: Scaffold into a temporary sibling directory**

Run from `E:\`:

```powershell
npx create-next-app@latest project-monitor-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Expected: Next.js project files exist in `E:\project-monitor-scaffold`. The documentation already in `E:\project-monitor` is untouched.

- [ ] **Step 2: Copy the scaffold into the documented project directory**

Copy only the generated application files:

```powershell
Copy-Item -Recurse -Force -LiteralPath 'E:\project-monitor-scaffold\src' -Destination 'E:\project-monitor\src'
Copy-Item -Recurse -Force -LiteralPath 'E:\project-monitor-scaffold\public' -Destination 'E:\project-monitor\public'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\package.json' -Destination 'E:\project-monitor\package.json'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\package-lock.json' -Destination 'E:\project-monitor\package-lock.json'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\tsconfig.json' -Destination 'E:\project-monitor\tsconfig.json'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\next.config.ts' -Destination 'E:\project-monitor\next.config.ts'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\eslint.config.mjs' -Destination 'E:\project-monitor\eslint.config.mjs'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\postcss.config.mjs' -Destination 'E:\project-monitor\postcss.config.mjs'
Copy-Item -Force -LiteralPath 'E:\project-monitor-scaffold\.gitignore' -Destination 'E:\project-monitor\.gitignore'
```

Expected: application files and existing documentation coexist under `E:\project-monitor`.

- [ ] **Step 3: Remove the verified temporary scaffold**

Verify the exact temporary path before removal:

```powershell
$scaffoldPath = (Resolve-Path -LiteralPath 'E:\project-monitor-scaffold').Path
if ($scaffoldPath -ne 'E:\project-monitor-scaffold') {
  throw "Unexpected scaffold path: $scaffoldPath"
}
Remove-Item -Recurse -Force -LiteralPath $scaffoldPath
```

Expected: only `E:\project-monitor-scaffold` is removed.

- [ ] **Step 4: Install runtime and test dependencies**

```powershell
Set-Location 'E:\project-monitor'
npm install zod jose bcryptjs server-only
npm install --save-dev vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Expected: dependencies are recorded in `package.json` and lockfile.

- [ ] **Step 5: Add exact scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "hash-password": "node scripts/hash-password.mjs"
  }
}
```

- [ ] **Step 6: Add `.env.example`**

```dotenv
GROUP_ACCESS_PASSWORD_HASH=
SESSION_SIGNING_SECRET=
MONITOR_DISPLAY_NAME=Project Monitor
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_IDS=
RENDER_API_KEY=
RENDER_SERVICE_IDS=
AIVEN_API_TOKEN=
AIVEN_PROJECT_NAME=
AIVEN_SERVICE_NAMES=
CRONJOB_API_KEY=
CRONJOB_JOB_IDS=
MONITORED_HEALTH_ENDPOINTS=
MONITOR_AGENT_INGEST_TOKEN=
MONITOR_AGENT_PROJECT_ID=
MONITOR_AGENT_BUFFER_SECONDS=60
```

Resource references use `id:label` and are parsed only on the server:

```dotenv
VERCEL_PROJECT_IDS=project_id:frontend,another_project_id:admin
RENDER_SERVICE_IDS=srv_backend:backend,srv_worker:worker
AIVEN_SERVICE_NAMES=kairos-db:database
CRONJOB_JOB_IDS=8158370:news-process
```

The parser must reject an empty ID, a label containing control characters and duplicate IDs within one provider. A provider with no token or no resource references returns a disabled configuration instead of throwing during application startup.

- [ ] **Step 7: Add password hashing script**

```js
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Password must contain at least 12 characters.");
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));
```

- [ ] **Step 8: Configure Vitest**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 9: Verify the scaffold**

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all commands exit `0`; Vitest may report no tests only before Task 2, so add `--passWithNoTests` temporarily or create `tests/unit/scaffold.test.ts` asserting `true`.

## Task 2: Define environment and domain contracts

**Files:**

- Create: `src/lib/env/server.ts`
- Create: `src/lib/monitor/types.ts`
- Test: `tests/unit/env.test.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**

- Produces: `getServerEnv(): ServerEnv`
- Produces: `MonitorSource`, `Severity`, `MonitorEvent`, `ServiceStatus`, `ProviderSnapshot`, `MonitorSnapshot`

- [ ] **Step 1: Write failing environment tests**

```ts
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env/server";

describe("parseServerEnv", () => {
  it("rejects a short session secret", () => {
    expect(() =>
      parseServerEnv({
        GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash",
        SESSION_SIGNING_SECRET: "short",
      }),
    ).toThrow();
  });

  it("splits comma-separated identifiers", () => {
    const env = parseServerEnv({
      GROUP_ACCESS_PASSWORD_HASH: "$2b$12$valid-looking-hash",
      SESSION_SIGNING_SECRET: "x".repeat(48),
      RENDER_SERVICE_IDS: "srv_a:backend,srv_b:worker",
    });
    expect(env.RENDER_SERVICE_IDS).toEqual([
      { id: "srv_a", label: "backend" },
      { id: "srv_b", label: "worker" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
npm run test -- tests/unit/env.test.ts
```

Expected: FAIL because `src/lib/env/server.ts` does not exist.

- [ ] **Step 3: Implement server environment parsing**

Use `server-only` and Zod. Export a pure `parseServerEnv()` for tests and a memoized `getServerEnv()` for runtime. Convert comma-separated values with:

```ts
const csv = z
  .string()
  .optional()
  .transform((value) =>
    value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [],
  );
```

Require `GROUP_ACCESS_PASSWORD_HASH` and a `SESSION_SIGNING_SECRET` with minimum 48 characters. Provider credentials remain optional so one missing provider produces a provider error instead of crashing the whole app.

- [ ] **Step 4: Define exact monitor contracts**

```ts
export type MonitorSource =
  | "vercel"
  | "render"
  | "aiven"
  | "cronjob"
  | "health";

export type Severity = "info" | "warning" | "error";

export type MonitorEvent = {
  id: string;
  source: MonitorSource;
  service: string;
  type: "deployment" | "runtime" | "database" | "cron" | "health";
  severity: Severity;
  status: string;
  message: string;
  occurredAt: string;
  externalUrl?: string;
};

export type ServiceStatus = {
  source: MonitorSource;
  service: string;
  status: "healthy" | "degraded" | "failed" | "unknown";
  checkedAt: string;
};

export type ProviderErrorCode =
  | "configuration_error"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "upstream_error";

export type ProviderSnapshot = {
  source: MonitorSource;
  fetchedAt: string;
  stale: boolean;
  services: ServiceStatus[];
  events: MonitorEvent[];
  error?: { code: ProviderErrorCode; message: string };
};

export type MonitorSnapshot = {
  generatedAt: string;
  refreshAfterSeconds: 15;
  partial: boolean;
  providers: ProviderSnapshot[];
  events: MonitorEvent[];
};
```

- [ ] **Step 5: Run checks**

```powershell
npm run test -- tests/unit/env.test.ts tests/unit/types.test.ts
npm run typecheck
```

Expected: PASS and exit `0`.

## Task 3: Implement stateless group authentication

**Files:**

- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/monitor/session/route.ts`
- Create: `src/proxy.ts`
- Test: `tests/unit/password.test.ts`
- Test: `tests/unit/session.test.ts`
- Test: `tests/integration/auth-routes.test.ts`

**Interfaces:**

- Produces: `verifyGroupPassword(password: string): Promise<boolean>`
- Produces: `createSessionToken(now?: Date): Promise<string>`
- Produces: `verifySessionToken(token: string, now?: Date): Promise<SessionPayload | null>`
- Produces: `requireMonitorSession(): Promise<SessionPayload>`

- [ ] **Step 1: Write password and session tests**

Test these exact behaviors:

```ts
it("accepts the matching bcrypt password", async () => {
  expect(await verifyGroupPassword("correct horse battery staple")).toBe(true);
});

it("rejects a different password", async () => {
  expect(await verifyGroupPassword("wrong password")).toBe(false);
});

it("rejects an expired session token", async () => {
  const token = await createSessionToken(new Date("2026-07-25T00:00:00Z"));
  expect(
    await verifySessionToken(token, new Date("2026-07-26T00:00:00Z")),
  ).toBeNull();
});
```

- [ ] **Step 2: Verify tests fail**

```powershell
npm run test -- tests/unit/password.test.ts tests/unit/session.test.ts
```

Expected: FAIL because auth modules do not exist.

- [ ] **Step 3: Implement password verification**

`verifyGroupPassword()` must reject strings shorter than 1 or longer than 256 characters before calling `bcrypt.compare()`.

- [ ] **Step 4: Implement signed session**

Use `jose` HS256 with issuer `project-monitor`, audience `project-monitor-web`, scope `monitor:read`, issued-at and 8-hour expiry. Cookie name is:

```ts
export const SESSION_COOKIE = "project_monitor_session";
```

- [ ] **Step 5: Implement login route**

Validate body with:

```ts
const LoginSchema = z.object({
  password: z.string().min(1).max(256),
});
```

Return `204` and set the secure cookie on success. Return the same generic `401` response for every invalid password:

```json
{ "error": "Invalid credentials" }
```

Use a small instance-local limiter of five failed attempts per IP per five minutes and document that Vercel Firewall supplies global protection.

- [ ] **Step 6: Implement logout and session routes**

Logout expires the cookie immediately. Session route verifies it and returns only `authenticated` and `expiresAt`.

- [ ] **Step 7: Protect pages and monitor APIs**

In `src/proxy.ts`, redirect unauthenticated page requests under `/monitor` to `/login`. API routes still perform their own verification and return `401`; proxy is not the only security boundary.

- [ ] **Step 8: Run auth checks**

```powershell
npm run test -- tests/unit/password.test.ts tests/unit/session.test.ts tests/integration/auth-routes.test.ts
npm run typecheck
```

Expected: PASS.

## Task 4: Implement redaction, timeout and cache primitives

**Files:**

- Create: `src/lib/monitor/redact.ts`
- Create: `src/lib/monitor/cache.ts`
- Create: `src/lib/providers/request.ts`
- Test: `tests/unit/redact.test.ts`
- Test: `tests/unit/cache.test.ts`
- Test: `tests/unit/provider-request.test.ts`

**Interfaces:**

- Produces: `redactText(input: string): string`
- Produces: `MemoryCache<T>`
- Produces: `fetchJson<T>(input: string, init: RequestInit, schema: ZodType<T>, signal: AbortSignal): Promise<T>`

- [ ] **Step 1: Write redaction tests**

```ts
it.each([
  ["Authorization: Bearer abc123", "Authorization: [REDACTED]"],
  ["postgres://user:pass@host:5432/db", "[REDACTED_DATABASE_URL]"],
  ['{"api_key":"secret-value"}', '{"api_key":"[REDACTED]"}'],
  ["password=hunter2", "password=[REDACTED]"],
])("redacts %s", (input, expected) => {
  expect(redactText(input)).toBe(expected);
});
```

- [ ] **Step 2: Verify primitive tests fail**

```powershell
npm run test -- tests/unit/redact.test.ts tests/unit/cache.test.ts tests/unit/provider-request.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement redaction**

Apply bounded regular expressions for bearer headers, credential URLs and sensitive key-value pairs. Limit input to 20,000 characters before applying patterns to prevent large upstream messages from consuming excessive CPU.

- [ ] **Step 4: Implement 10-second memory cache**

`MemoryCache<T>` exposes:

```ts
get(key: string, now?: number): T | undefined;
set(key: string, value: T, ttlMs?: number, now?: number): void;
clear(): void;
```

Default TTL is `10_000`.

- [ ] **Step 5: Implement safe provider request**

`fetchJson()` must:

- combine caller cancellation with an 8-second timeout
- set `Accept: application/json`
- map `401/403`, `429`, timeout and other non-2xx responses to typed internal errors
- validate JSON with Zod
- never include response body or headers in thrown messages

- [ ] **Step 6: Run primitive tests**

```powershell
npm run test -- tests/unit/redact.test.ts tests/unit/cache.test.ts tests/unit/provider-request.test.ts
npm run typecheck
```

Expected: PASS.

## Task 5: Implement provider adapters

**Files:**

- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/vercel.ts`
- Create: `src/lib/providers/render.ts`
- Create: `src/lib/providers/aiven.ts`
- Create: `src/lib/providers/cronjob.ts`
- Create: `src/lib/providers/health.ts`
- Test: `tests/unit/providers/vercel.test.ts`
- Test: `tests/unit/providers/render.test.ts`
- Test: `tests/unit/providers/aiven.test.ts`
- Test: `tests/unit/providers/cronjob.test.ts`
- Test: `tests/unit/providers/health.test.ts`

**Interfaces:**

- Consumes: `fetchJson`, `redactText`, monitor domain types
- Produces: `MonitorProvider`
- Produces: `createProviders(env: ServerEnv): MonitorProvider[]`

- [ ] **Step 1: Define adapter interface**

```ts
export interface MonitorProvider {
  readonly source: MonitorSource;
  fetchSnapshot(signal: AbortSignal): Promise<ProviderSnapshot>;
}
```

- [ ] **Step 2: Write mocked-fetch tests for every provider**

Each provider test must cover:

- successful normalization
- missing environment configuration
- upstream unauthorized response
- redaction of a sensitive message
- mapping provider timestamps to ISO 8601
- allowlisted external dashboard URL

Use fixture objects inside the test file. Do not store real provider responses or credentials.

- [ ] **Step 3: Implement Vercel adapter**

Read token, team and project IDs from `ServerEnv`. Request deployment data only for configured projects. Normalize deployment state to `healthy`, `degraded`, `failed` or `unknown`.

Do not attempt mutation endpoints. If the current official Vercel API does not expose raw runtime logs through a stable read endpoint, return deployment events only and label the service message accordingly.

- [ ] **Step 4: Implement Render adapter**

Read configured service IDs and fetch service/deploy information with a read-only API key. Normalize deploy failures as severity `error`, active deploys as `info`, and suspended/unavailable services as `warning`.

Only include raw log lines if the official read API returns them. Never scrape the dashboard.

- [ ] **Step 5: Implement Aiven adapter**

Read project and service names. Return service health and database-level events exposed by the official API. Do not request credentials, connection strings, user lists or query contents.

- [ ] **Step 6: Implement cron-job.org adapter**

Read configured job IDs. Normalize latest execution and failure state. Never expose request headers configured on the cron job and never add an execute-now operation.

- [ ] **Step 7: Implement health adapter**

Only request URLs parsed from `MONITORED_HEALTH_ENDPOINTS`. Require HTTPS in production, follow at most one redirect to an HTTPS URL and return status, latency and checked time. Do not accept a URL from request query parameters.

- [ ] **Step 8: Run provider tests**

```powershell
npm run test -- tests/unit/providers
npm run typecheck
```

Expected: all provider tests PASS.

## Task 6: Aggregate providers and expose monitor API

**Files:**

- Create: `src/lib/monitor/aggregate.ts`
- Create: `src/app/api/monitor/snapshot/route.ts`
- Test: `tests/unit/aggregate.test.ts`
- Test: `tests/integration/snapshot-route.test.ts`

**Interfaces:**

- Consumes: `MonitorProvider[]`, `MemoryCache<MonitorSnapshot>`
- Produces: `getMonitorSnapshot(options?): Promise<MonitorSnapshot>`
- Produces: `GET /api/monitor/snapshot`

- [ ] **Step 1: Write aggregator failure tests**

```ts
it("keeps successful providers when one provider fails", async () => {
  const snapshot = await getMonitorSnapshot({
    providers: [successfulProvider, failingProvider],
    cache: new MemoryCache(),
  });

  expect(snapshot.partial).toBe(true);
  expect(snapshot.providers).toHaveLength(2);
  expect(snapshot.events).toHaveLength(1);
});
```

Also test newest-first sorting, cache hit, aborted request and total failure.

- [ ] **Step 2: Verify failure**

```powershell
npm run test -- tests/unit/aggregate.test.ts
```

Expected: FAIL because aggregator does not exist.

- [ ] **Step 3: Implement aggregation**

Call adapters with `Promise.allSettled()`. Convert a rejected adapter into its source-level safe error. Sort events using:

```ts
events.sort(
  (left, right) =>
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
);
```

Limit the combined response to the newest 500 events.

- [ ] **Step 4: Implement authenticated snapshot route**

Require session scope `monitor:read`. Return:

- `200` for complete or partial snapshots
- `401` without valid session
- `503` when every configured provider fails

Set:

```http
Cache-Control: private, no-store
Content-Type: application/json
```

- [ ] **Step 5: Run aggregator and route tests**

```powershell
npm run test -- tests/unit/aggregate.test.ts tests/integration/snapshot-route.test.ts
npm run typecheck
```

Expected: PASS.

## Task 7: Add diagnostic command parser and optional agent ingestion

**Files:**

- Create: `src/lib/monitor/commands.ts`
- Create: `src/lib/monitor/agent-buffer.ts`
- Create: `src/app/api/monitor/command/route.ts`
- Create: `src/app/api/monitor/agent/events/route.ts`
- Create: `src/components/monitor/DiagnosticTerminal.tsx`
- Test: `tests/unit/commands.test.ts`
- Test: `tests/unit/agent-buffer.test.ts`
- Test: `tests/integration/command-route.test.ts`
- Test: `tests/integration/agent-route.test.ts`

**Interfaces:**

- Produces: `parseDiagnosticCommand(command: string): DiagnosticQuery`
- Produces: `executeDiagnosticQuery(query: DiagnosticQuery): Promise<MonitorSnapshot>`
- Produces: `AgentBuffer.append(events: AgentEvent[]): void`
- Produces: `AgentBuffer.read(projectId: string): AgentEvent[]`

- [ ] **Step 1: Write parser tests**

```ts
expect(parseDiagnosticCommand("logs render backend --last 100")).toEqual({
  type: "logs",
  source: "render",
  service: "backend",
  limit: 100,
});
expect(() => parseDiagnosticCommand("npm run migrate")).toThrow();
expect(() => parseDiagnosticCommand("logs render backend --last 1000")).toThrow();
```

Cover `errors`, `deploys`, `health all` and `cron failures`. Reject shell metacharacters, unknown providers, unknown flags and counts above 500.

- [ ] **Step 2: Implement structured query parser**

Return a discriminated union and never return the original command to an adapter. Adapters receive typed fields only.

- [ ] **Step 3: Implement query execution**

Route diagnostic queries to existing provider adapters and the agent buffer. There must be no `child_process`, `eval`, `exec`, `spawn` or shell invocation anywhere in this feature.

- [ ] **Step 4: Write agent ingestion tests**

Test valid batches, maximum batch size of 100, message truncation at 8,000 characters, invalid timestamps, invalid project IDs and redaction of bearer tokens. Test that an invalid agent token returns `401` and a valid batch returns `202`.

- [ ] **Step 5: Implement bounded agent buffer**

Store only redacted events for 60 seconds in an in-memory ring buffer. Drop oldest events when the buffer exceeds 1,000 events. This is explicitly best-effort on Vercel serverless.

- [ ] **Step 6: Implement agent route**

Require `Authorization: Bearer <MONITOR_AGENT_INGEST_TOKEN>`, validate the configured project ID, accept only POST JSON batches and return `202` after redaction. Never return stored messages in the ingestion response.

- [ ] **Step 7: Implement command route and terminal UI contract**

Require monitor session, accept `{ command: string }`, return `400` for invalid grammar and return a safe snapshot for valid queries. Add command history and output rendering to `DiagnosticTerminal`; history remains client-only and must not be persisted.

- [ ] **Step 8: Run diagnostic tests**

```powershell
npm run test -- tests/unit/commands.test.ts tests/unit/agent-buffer.test.ts tests/integration/command-route.test.ts tests/integration/agent-route.test.ts
npm run typecheck
```

Expected: PASS.

## Task 8: Build login and terminal dashboard

**Files:**

- Create: `src/app/login/page.tsx`
- Create: `src/app/monitor/page.tsx`
- Create: `src/components/monitor/MonitorDashboard.tsx`
- Create: `src/components/monitor/ServiceCards.tsx`
- Create: `src/components/monitor/SourceFilters.tsx`
- Create: `src/components/monitor/TerminalPanel.tsx`
- Create: `src/components/monitor/ProviderErrors.tsx`
- Create: `src/components/monitor/AutoRefreshControl.tsx`
- Create: `src/app/manifest.ts`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/sw.js`
- Create: `src/components/PwaRegistration.tsx`
- Test: `tests/components/LoginPage.test.tsx`
- Test: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**

- Consumes: `GET /api/monitor/snapshot`
- Produces: login flow and monitor UI

- [ ] **Step 1: Write component tests**

Cover:

- login submits one password field
- invalid login shows a generic message
- dashboard renders service status
- source filter hides other sources
- severity filter works independently
- pause cancels timer
- hidden document stops refresh
- resume triggers an immediate refresh
- failed provider shows error without removing successful events
- clear button clears only visible client state and next refresh restores events

- [ ] **Step 2: Verify tests fail**

```powershell
npm run test -- tests/components
```

Expected: FAIL because UI components do not exist.

- [ ] **Step 3: Implement login page**

Use a client form that calls `/api/auth/login`, redirects to `/monitor` after `204`, disables submit while pending and never stores the password.

- [ ] **Step 4: Implement server monitor page**

Verify session server-side. Render `MonitorDashboard` without embedding provider data or secrets in the page source.

- [ ] **Step 5: Implement dashboard polling**

Use one effect and one `AbortController`. Schedule the next request only after the previous request settles:

```ts
const REFRESH_MS = 15_000;
```

Do not use `setInterval`; recursive `setTimeout` prevents overlapping requests.

- [ ] **Step 6: Implement terminal**

Render timestamp, source, service, severity label, status and redacted message. Use semantic list markup and `aria-live="polite"` without announcing the entire list on every refresh.

- [ ] **Step 7: Implement filters and status cards**

Filtering occurs client-side on the latest snapshot. Default is all sources and all severities. Display `partial`, `stale` and provider errors explicitly.

- [ ] **Step 8: Run component checks**

```powershell
npm run test -- tests/components
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Add PWA metadata and install behavior**

Create `src/app/manifest.ts` returning a manifest with name `Project Monitor`, short name `Monitor`, start URL `/monitor`, display `standalone`, theme color matching the terminal UI, and 192px and 512px icons. Add the two PNG icons under `public/icons`.

Register `public/sw.js` from a client-only `PwaRegistration` component mounted in the root layout. The service worker may cache static shell and asset requests only. It must not cache `/api/monitor/*`, `/api/auth/*`, HTML containing session state, or provider responses. On logout, navigate to `/login` and clear any app-owned cache.

Add a browser test that checks the manifest link exists and that a snapshot request is still made after a refresh, proving provider data is not served from a stale service-worker cache.

- [ ] **Step 10: Verify PWA behavior**

```powershell
npm run test -- tests/components
npm run build
```

Expected: PASS; manifest is present in the build and no provider token appears in static assets.

## Task 9: Add end-to-end tests and production hardening

**Files:**

- Create: `e2e/monitor.spec.ts`
- Create: `next.config.ts`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md` only if verified provider behavior differs from the design

**Interfaces:**

- Verifies: complete user flow and security headers

- [ ] **Step 1: Configure Playwright**

Start Next.js using test-only environment values and mocked provider fixtures through dependency injection. Do not put live credentials in Playwright config.

- [ ] **Step 2: Write E2E scenarios**

```ts
test("group member can login, view partial data and logout", async ({ page }) => {
  await page.goto("/monitor");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Group password").fill("test-group-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/monitor/);
  await expect(page.getByText("Render")).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login/);
});
```

Add scenarios for invalid password, provider partial failure and session expiry.

- [ ] **Step 3: Add security headers**

Set Content Security Policy, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` disabling unused browser capabilities and frame protection in `next.config.ts`.

Allow outbound provider hosts only in server code. Do not add provider domains to browser `connect-src`; browser connects only to same-origin APIs.

- [ ] **Step 4: Verify no secrets leak**

Run a production build and search generated client assets for test token markers:

```powershell
npm run build
rg "VERCEL_API_TOKEN|RENDER_API_KEY|AIVEN_API_TOKEN|CRONJOB_API_KEY" '.next/static'
```

Expected: build exits `0`; `rg` returns no matches in client assets.

- [ ] **Step 5: Run the complete verification**

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Expected: every command exits `0`.

## Task 10: Configure Vercel and perform production acceptance

**Files:**

- Modify: `.env.example` only if a verified provider requires a newly named variable
- Modify: `README.md` with the final provider setup steps

**Interfaces:**

- Produces: deployed read-only Monitor URL

- [ ] **Step 1: Create least-privilege provider credentials**

Create separate read-only tokens for this monitor. Do not reuse owner tokens used for deployment or account administration.

- [ ] **Step 2: Configure Vercel Production environment**

Set every required authentication variable and only the enabled provider variables. Preview must use test or reduced-scope credentials.

Deploy the Next.js project as one Vercel application. Do not create a separate Render backend for the Monitor MVP because the route handlers already provide the server-side API.

- [ ] **Step 3: Configure Vercel Firewall**

Rate-limit `/api/auth/login` and block abusive request bursts. Do not rely only on the instance-local limiter.

- [ ] **Step 4: Deploy**

Use the user's normal Git and Vercel workflow. No agent should automatically add, commit or push files.

- [ ] **Step 5: Run production acceptance**

Verify:

- `/monitor` redirects to `/login` without session
- wrong password returns a generic error
- correct password opens dashboard
- all enabled providers show status or a specific safe error
- provider dashboard links use approved domains
- pause stops network requests
- logout invalidates the browser cookie
- browser source and network responses contain no provider credentials
- one disabled provider does not break the page
- there are no deploy, restart or execute actions

- [ ] **Step 6: Rotate the test credentials**

After acceptance, replace any credentials used during setup with final least-privilege credentials and redeploy.

## Self-review result

- Spec coverage: authentication, provider isolation, no-database constraint, portable environment configuration, provider logs, diagnostic terminal, optional agent logs, PWA install, partial failure, polling, redaction, testing and one-project Vercel deployment are each mapped to tasks.
- Placeholder scan: no unfinished sections or deferred implementation markers remain.
- Type consistency: adapter, snapshot and event names match `ARCHITECTURE.md`.
- Scope: historical log storage, user accounts and mutation operations remain explicitly excluded.
