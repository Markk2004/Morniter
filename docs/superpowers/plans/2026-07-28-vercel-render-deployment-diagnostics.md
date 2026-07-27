# Vercel and Render Deployment Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แจ้งเตือน Vercel และ Render deployment incidents พร้อม filter และรายละเอียด log จริงที่โหลดเมื่อผู้ใช้กดขยาย

**Architecture:** Provider snapshot ส่ง status และ diagnostic metadata โดยไม่โหลด log ระหว่าง polling ส่วน authenticated diagnostics endpoint จะค้นหา event จาก server snapshot และเรียก provider diagnostics method เฉพาะเมื่อผู้ใช้กดดูรายละเอียด ระบบ incident กลางใช้ service status และ event incident key เพื่อทำ in-app alert, browser notification แบบไม่ซ้ำ และ recovery

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Vitest, Testing Library, Playwright, Vercel REST API, Render REST API, Browser Notification API, localStorage

## Global Constraints

- ระบบต้องเป็น read-only และใช้เฉพาะ provider GET endpoints
- ห้าม trigger, cancel, retry, rollback หรือแก้ไข deployment
- API token ต้องอยู่ server-side เท่านั้น
- log ต้องผ่าน `redactText` ก่อนส่งไป client
- diagnostics จำกัด 20 บรรทัดและ payload รวม 4 KB
- provider errors ต้องไม่ถูกแปลงเป็น deployment incidents
- browser notification ต้องเริ่มจาก user action
- ใช้ `incidentKey` แยก provider, service และ deployment
- ห้ามเพิ่ม cron, webhook, database, Redis หรือ queue
- ห้ามรันคำสั่ง Git ทุกชนิด ผู้ใช้จัดการ Git เอง

---

### Task 1: Add diagnostic and deployment metadata contracts

**Files:**
- Modify: `src/lib/monitor/types.ts`
- Modify: `src/lib/providers/types.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: existing `Severity`, `MonitorEvent`, `MonitorProvider`
- Produces: `DiagnosticStage`, `MonitorDiagnostic`, `MonitorDiagnosticsResult`, `MonitorProvider.fetchDiagnostics`

- [ ] **Step 1: Write the failing type contract test**

Add this fixture and assertions to `tests/unit/types.test.ts`:

```ts
const diagnosticsResult: MonitorDiagnosticsResult = {
  eventId: "vercel-dep_123",
  summary: "Build command exited with code 1",
  lines: [
    {
      id: "log-1",
      stage: "build",
      level: "error",
      message: "Build command exited with code 1",
      occurredAt: "2026-07-28T03:00:00Z",
    },
  ],
  truncated: false,
};

expect(diagnosticsResult.lines[0].stage).toBe("build");
expect(diagnosticsResult.summary).toContain("code 1");
```

Import `MonitorDiagnosticsResult` from `@/lib/monitor/types`.

- [ ] **Step 2: Run the type test and verify it fails**

Run:

```text
npm run test -- tests/unit/types.test.ts
```

Expected: FAIL because `MonitorDiagnosticsResult` does not exist.

- [ ] **Step 3: Add the contracts**

Add these declarations to `src/lib/monitor/types.ts`:

```ts
export type DiagnosticStage =
  | "build"
  | "deploy"
  | "runtime"
  | "database"
  | "health"
  | "cron"
  | "unknown";

export type MonitorDiagnostic = {
  id: string;
  stage: DiagnosticStage;
  level: Severity;
  message: string;
  occurredAt?: string;
};

export type MonitorDiagnosticsResult = {
  eventId: string;
  summary: string;
  lines: MonitorDiagnostic[];
  truncated: boolean;
};
```

Add these fields to `MonitorEvent`:

```ts
stage?: DiagnosticStage;
incidentKey?: string;
deploymentId?: string;
resourceId?: string;
ownerId?: string;
diagnosticAvailable?: boolean;
diagnosticEndTime?: string;
```

- [ ] **Step 4: Extend the provider interface**

Change imports and interface in `src/lib/providers/types.ts`:

```ts
import type {
  MonitorDiagnosticsResult,
  MonitorEvent,
  MonitorSource,
  ProviderSnapshot,
} from "@/lib/monitor/types";

export interface MonitorProvider {
  readonly source: MonitorSource;
  fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot>;
  fetchDiagnostics?(
    event: MonitorEvent,
    signal?: AbortSignal,
  ): Promise<MonitorDiagnosticsResult>;
}
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```text
npm run test -- tests/unit/types.test.ts
npm run typecheck
```

Expected: PASS.

### Task 2: Add shared diagnostic redaction and size limits

**Files:**
- Create: `src/lib/monitor/diagnostic-lines.ts`
- Create: `tests/unit/diagnostic-lines.test.ts`

**Interfaces:**
- Consumes: `MonitorDiagnostic`, existing `redactText`
- Produces: `limitDiagnostics(lines, options?)`

- [ ] **Step 1: Write failing limit tests**

Create `tests/unit/diagnostic-lines.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { limitDiagnostics } from "@/lib/monitor/diagnostic-lines";

describe("limitDiagnostics", () => {
  it("redacts secrets and caps the line count", () => {
    const lines = Array.from({ length: 25 }, (_, index) => ({
      id: `line-${index}`,
      stage: "build" as const,
      level: "error" as const,
      message: index === 0 ? "Authorization: Bearer secret-token" : `line ${index}`,
    }));

    const result = limitDiagnostics(lines);

    expect(result.lines).toHaveLength(20);
    expect(result.lines[0].message).not.toContain("secret-token");
    expect(result.truncated).toBe(true);
  });

  it("caps the redacted payload at 4096 bytes", () => {
    const result = limitDiagnostics([
      {
        id: "large",
        stage: "build",
        level: "error",
        message: "x".repeat(5000),
      },
    ]);

    expect(Buffer.byteLength(result.lines[0].message, "utf8")).toBeLessThanOrEqual(4096);
    expect(result.truncated).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```text
npm run test -- tests/unit/diagnostic-lines.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the limiter**

Create `src/lib/monitor/diagnostic-lines.ts`:

```ts
import type { MonitorDiagnostic } from "./types";
import { redactText } from "./redact";

const DEFAULT_MAX_LINES = 20;
const DEFAULT_MAX_BYTES = 4096;

export function limitDiagnostics(
  input: MonitorDiagnostic[],
  options: { maxLines?: number; maxBytes?: number } = {},
): { lines: MonitorDiagnostic[]; truncated: boolean } {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const output: MonitorDiagnostic[] = [];
  let usedBytes = 0;
  let truncated = input.length > maxLines;

  for (const line of input.slice(0, maxLines)) {
    const redacted = redactText(line.message);
    const availableBytes = maxBytes - usedBytes;
    if (availableBytes <= 0) {
      truncated = true;
      break;
    }

    let message = redacted;
    if (Buffer.byteLength(message, "utf8") > availableBytes) {
      message = Buffer.from(message, "utf8").subarray(0, availableBytes).toString("utf8");
      truncated = true;
    }

    output.push({ ...line, message });
    usedBytes += Buffer.byteLength(message, "utf8");
  }

  return { lines: output, truncated };
}
```

- [ ] **Step 4: Run the focused test**

Run:

```text
npm run test -- tests/unit/diagnostic-lines.test.ts
```

Expected: PASS.

### Task 3: Normalize Vercel states and fetch deployment events on demand

**Files:**
- Modify: `src/lib/providers/vercel.ts`
- Modify: `tests/unit/providers/vercel.test.ts`

**Interfaces:**
- Consumes: `MonitorProvider.fetchDiagnostics`, Vercel deployment list and deployment events
- Produces: exported `normalizeVercelState`, Vercel event diagnostic metadata, Vercel diagnostics result

- [ ] **Step 1: Write failing state mapping tests**

Add to `tests/unit/providers/vercel.test.ts`:

```ts
import { VercelProvider, normalizeVercelState } from "@/lib/providers/vercel";

it.each([
  ["READY", "healthy", "info"],
  ["BUILDING", "degraded", "warning"],
  ["INITIALIZING", "degraded", "warning"],
  ["QUEUED", "degraded", "warning"],
  ["ERROR", "failed", "error"],
  ["CANCELED", "failed", "error"],
  ["UNKNOWN_NEW_STATE", "unknown", "warning"],
] as const)("maps Vercel state %s", (raw, status, severity) => {
  expect(normalizeVercelState(raw)).toMatchObject({ status, severity });
});
```

- [ ] **Step 2: Write the failing diagnostic test**

Add:

```ts
it("fetches and classifies deployment events only on demand", async () => {
  const envWithToken: ServerEnv = {
    ...baseEnv,
    VERCEL_API_TOKEN: "vcl_token_123",
  };

  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [
      {
        type: "stderr",
        created: 1785000001000,
        payload: { text: "Module not found: package-x" },
      },
      {
        type: "exit",
        created: 1785000002000,
        payload: { text: "Command exited with code 1" },
      },
    ],
  });
  vi.stubGlobal("fetch", mockFetch);

  const provider = new VercelProvider(envWithToken);
  const result = await provider.fetchDiagnostics({
    id: "vercel-dep_123",
    source: "vercel",
    service: "frontend",
    type: "deployment",
    severity: "error",
    status: "ERROR",
    message: "Deployment failed",
    occurredAt: "2026-07-28T03:00:00Z",
    resourceId: "prj_1",
    deploymentId: "dep_123",
    diagnosticAvailable: true,
  });

  expect(result.summary).toContain("Module not found");
  expect(result.lines[0]).toMatchObject({
    stage: "build",
    level: "error",
  });
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining("/v3/deployments/dep_123/events"),
    expect.any(Object),
  );
});
```

- [ ] **Step 3: Run the provider test and verify it fails**

Run:

```text
npm run test -- tests/unit/providers/vercel.test.ts
```

Expected: FAIL because the normalizer and diagnostics method do not exist.

- [ ] **Step 4: Add Vercel event schemas and helpers**

Add to `src/lib/providers/vercel.ts`:

```ts
const vercelDeploymentEventSchema = z.object({
  type: z.string(),
  created: z.number(),
  payload: z.record(z.string(), z.unknown()),
});

const vercelDeploymentEventsSchema = z.array(vercelDeploymentEventSchema);

export function normalizeVercelState(rawState: string): {
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  normalizedState: string;
} {
  const normalizedState = rawState.toUpperCase();
  if (normalizedState === "READY") {
    return { status: "healthy", severity: "info", normalizedState };
  }
  if (["BUILDING", "INITIALIZING", "QUEUED"].includes(normalizedState)) {
    return { status: "degraded", severity: "warning", normalizedState };
  }
  if (["ERROR", "CANCELED"].includes(normalizedState)) {
    return { status: "failed", severity: "error", normalizedState };
  }
  return { status: "unknown", severity: "warning", normalizedState };
}

function vercelEventMessage(payload: Record<string, unknown>): string {
  for (const key of ["text", "message", "error"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return JSON.stringify(payload);
}

function vercelEventStage(type: string): DiagnosticStage {
  if (type === "deployment-state") return "deploy";
  if (type.includes("invocation") || type === "middleware") return "runtime";
  return "build";
}
```

- [ ] **Step 5: Replace the inline Vercel status mapping**

For each deployment:

```ts
const normalized = normalizeVercelState(dep.state);

events.push({
  id: `vercel-${dep.uid}`,
  source: this.source,
  service: projectRef.label,
  type: "deployment",
  severity: normalized.severity,
  status: dep.state,
  message: redactText(`Deployment ${dep.name} (${dep.uid}): state is ${dep.state}`),
  occurredAt: new Date(dep.created).toISOString(),
  externalUrl: dep.url ? `https://${dep.url}` : undefined,
  stage: normalized.status === "healthy" ? "deploy" : "build",
  incidentKey: `vercel:${projectRef.label}:${dep.uid}`,
  deploymentId: dep.uid,
  resourceId: projectRef.id,
  diagnosticAvailable: normalized.status !== "healthy",
});
```

Use `normalizeVercelState(data.deployments[0].state).status` for the service card.

- [ ] **Step 6: Implement `fetchDiagnostics`**

Add this method to `VercelProvider`:

```ts
async fetchDiagnostics(
  event: MonitorEvent,
  signal?: AbortSignal,
): Promise<MonitorDiagnosticsResult> {
  if (
    event.source !== "vercel" ||
    !event.deploymentId ||
    !event.resourceId ||
    !this.env.VERCEL_PROJECT_IDS.some((ref) => ref.id === event.resourceId)
  ) {
    throw new ProviderError("upstream_error", "Invalid Vercel diagnostic event");
  }

  const params = new URLSearchParams({
    direction: "backward",
    limit: "20",
    builds: "1",
  });
  if (this.env.VERCEL_TEAM_ID) params.set("teamId", this.env.VERCEL_TEAM_ID);

  const data = await fetchJson(
    `https://api.vercel.com/v3/deployments/${encodeURIComponent(event.deploymentId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${this.env.VERCEL_API_TOKEN}` } },
    vercelDeploymentEventsSchema,
    signal,
  );

  const rawLines: MonitorDiagnostic[] = data.map((item, index) => ({
    id: `vercel-log-${item.created}-${index}`,
    stage: vercelEventStage(item.type),
    level:
      item.type === "fatal" || item.type === "stderr" || item.type === "exit"
        ? "error"
        : "info",
    message: vercelEventMessage(item.payload),
    occurredAt: new Date(item.created).toISOString(),
  }));
  const limited = limitDiagnostics(rawLines);
  const firstError = limited.lines.find((line) => line.level === "error");

  return {
    eventId: event.id,
    summary: firstError?.message ?? `Vercel deployment status is ${event.status}`,
    lines: limited.lines,
    truncated: limited.truncated,
  };
}
```

Import `DiagnosticStage`, `MonitorDiagnostic`, `MonitorDiagnosticsResult` and `limitDiagnostics`.

- [ ] **Step 7: Run Vercel tests**

Run:

```text
npm run test -- tests/unit/providers/vercel.test.ts
```

Expected: PASS.

### Task 4: Normalize Render states and fetch filtered build logs on demand

**Files:**
- Modify: `src/lib/providers/render.ts`
- Modify: `tests/unit/providers/render.test.ts`

**Interfaces:**
- Consumes: Render service `ownerId`, service ID, deploy timestamps, Render `/v1/logs`
- Produces: exported `normalizeRenderState`, Render diagnostic metadata and diagnostics result

- [ ] **Step 1: Write failing state mapping tests**

Add:

```ts
import { RenderProvider, normalizeRenderState } from "@/lib/providers/render";

it.each([
  ["live", "healthy", "info"],
  ["build_succeeded", "healthy", "info"],
  ["building", "degraded", "warning"],
  ["deploying", "degraded", "warning"],
  ["build_failed", "failed", "error"],
  ["deploy_failed", "failed", "error"],
  ["deactivated", "failed", "error"],
  ["future_status", "unknown", "warning"],
] as const)("maps Render state %s", (raw, status, severity) => {
  expect(normalizeRenderState(raw)).toMatchObject({ status, severity });
});
```

- [ ] **Step 2: Write the failing Render log test**

Add:

```ts
it("queries Render build logs for the configured service", async () => {
  const envWithKey: ServerEnv = {
    ...baseEnv,
    RENDER_API_KEY: "rnd_key_123",
  };
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      hasMore: false,
      nextStartTime: "2026-07-28T02:00:00Z",
      nextEndTime: "2026-07-28T03:00:00Z",
      logs: [
        {
          id: "log-1",
          message: "npm run build exited with code 1",
          timestamp: "2026-07-28T03:00:00Z",
          labels: [
            { name: "resource", value: "srv_123" },
            { name: "type", value: "build" },
            { name: "level", value: "error" },
          ],
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", mockFetch);

  const provider = new RenderProvider(envWithKey);
  const result = await provider.fetchDiagnostics({
    id: "render-dep_abc",
    source: "render",
    service: "backend",
    type: "deployment",
    severity: "error",
    status: "build_failed",
    message: "Deploy failed",
    occurredAt: "2026-07-28T03:00:00Z",
    resourceId: "srv_123",
    deploymentId: "dep_abc",
    diagnosticAvailable: true,
    ownerId: "tea_123",
  });

  expect(result.summary).toContain("exited with code 1");
  expect(result.lines[0]).toMatchObject({ stage: "build", level: "error" });
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining("ownerId=tea_123"),
    expect.any(Object),
  );
});
```

The fixture uses the `ownerId?: string` field defined in Task 1.

- [ ] **Step 3: Run the Render provider test and verify it fails**

Run:

```text
npm run test -- tests/unit/providers/render.test.ts
```

Expected: FAIL because the normalizer, owner field and diagnostics method do not exist.

- [ ] **Step 4: Extend Render schemas**

Change the normalized Render service shape so it includes owner ID:

```ts
const renderServiceSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    ownerId: z.string().optional(),
    dashboardUrl: z.string().optional(),
    service: z
      .object({
        id: z.string(),
        name: z.string(),
        ownerId: z.string(),
        dashboardUrl: z.string().optional(),
      })
      .optional(),
  })
  .transform((data) =>
    data.service ?? {
      id: data.id ?? "",
      name: data.name ?? "",
      ownerId: data.ownerId ?? "",
      dashboardUrl: data.dashboardUrl,
    },
  );

const renderLogLabelSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const renderLogsSchema = z.object({
  hasMore: z.boolean(),
  nextStartTime: z.string(),
  nextEndTime: z.string(),
  logs: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      timestamp: z.string(),
      labels: z.array(renderLogLabelSchema),
    }),
  ),
});
```

- [ ] **Step 5: Add the Render normalizer**

```ts
export function normalizeRenderState(rawState: string): {
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  normalizedState: string;
} {
  const normalizedState = rawState.toLowerCase();
  if (["live", "build_succeeded"].includes(normalizedState)) {
    return { status: "healthy", severity: "info", normalizedState };
  }
  if (
    ["created", "queued", "building", "pre_deploy", "deploying", "update_in_progress"]
      .includes(normalizedState)
  ) {
    return { status: "degraded", severity: "warning", normalizedState };
  }
  if (
    ["build_failed", "deploy_failed", "canceled", "cancelled", "suspended", "deactivated"]
      .includes(normalizedState)
  ) {
    return { status: "failed", severity: "error", normalizedState };
  }
  return { status: "unknown", severity: "warning", normalizedState };
}
```

- [ ] **Step 6: Add Render event diagnostic metadata**

Use `normalizeRenderState` for service and event mappings. Build each event with:

```ts
const normalized = normalizeRenderState(dep.status);

events.push({
  id: `render-${dep.id}`,
  source: this.source,
  service: serviceRef.label,
  type: "deployment",
  severity: normalized.severity,
  status: dep.status,
  message: redactText(rawMsg),
  occurredAt: dep.createdAt,
  externalUrl: serviceData.dashboardUrl,
  stage: normalized.status === "healthy" ? "deploy" : "build",
  incidentKey: `render:${serviceRef.label}:${dep.id}`,
  deploymentId: dep.id,
  resourceId: serviceRef.id,
  ownerId: serviceData.ownerId,
  diagnosticAvailable: normalized.status !== "healthy" && Boolean(serviceData.ownerId),
  diagnosticEndTime: dep.finishedAt ?? fetchedAt,
});
```

- [ ] **Step 7: Implement Render diagnostics**

```ts
async fetchDiagnostics(
  event: MonitorEvent,
  signal?: AbortSignal,
): Promise<MonitorDiagnosticsResult> {
  if (
    event.source !== "render" ||
    !event.resourceId ||
    !event.ownerId ||
    !this.env.RENDER_SERVICE_IDS.some((ref) => ref.id === event.resourceId)
  ) {
    throw new ProviderError("upstream_error", "Invalid Render diagnostic event");
  }

  const params = new URLSearchParams({
    ownerId: event.ownerId,
    resource: event.resourceId,
    type: "build",
    startTime: event.occurredAt,
    endTime: event.diagnosticEndTime ?? new Date().toISOString(),
    direction: "backward",
    limit: "20",
  });
  const data = await fetchJson(
    `https://api.render.com/v1/logs?${params}`,
    { headers: { Authorization: `Bearer ${this.env.RENDER_API_KEY}` } },
    renderLogsSchema,
    signal,
    RENDER_REQUEST_TIMEOUT_MS,
  );

  const rawLines: MonitorDiagnostic[] = data.logs.map((log) => {
    const labels = new Map(log.labels.map((label) => [label.name, label.value]));
    const level = labels.get("level");
    return {
      id: log.id,
      stage: labels.get("type") === "build" ? "build" : "runtime",
      level:
        level === "error" || level === "critical" || level === "alert" || level === "emergency"
          ? "error"
          : level === "warning"
            ? "warning"
            : "info",
      message: log.message,
      occurredAt: log.timestamp,
    };
  });
  const limited = limitDiagnostics(rawLines);
  const firstError = limited.lines.find((line) => line.level === "error");

  return {
    eventId: event.id,
    summary: firstError?.message ?? `Render deploy status is ${event.status}`,
    lines: limited.lines,
    truncated: limited.truncated,
  };
}
```

- [ ] **Step 8: Run Render tests**

Run:

```text
npm run test -- tests/unit/providers/render.test.ts
```

Expected: PASS.

### Task 5: Add the authenticated diagnostics lookup endpoint

**Files:**
- Create: `src/lib/monitor/event-diagnostics.ts`
- Create: `src/app/api/monitor/diagnostics/route.ts`
- Create: `tests/unit/event-diagnostics.test.ts`
- Create: `tests/unit/api-diagnostics.test.ts`

**Interfaces:**
- Consumes: event ID, `getMonitorSnapshot`, `createProviders`, provider `fetchDiagnostics`
- Produces: `getEventDiagnostics(eventId, signal?)`, authenticated GET endpoint

- [ ] **Step 1: Write failing service tests**

Create `tests/unit/event-diagnostics.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getEventDiagnostics } from "@/lib/monitor/event-diagnostics";

describe("getEventDiagnostics", () => {
  it("rejects an unknown event id", async () => {
    await expect(
      getEventDiagnostics("missing", undefined, {
        snapshot: {
          generatedAt: "2026-07-28T03:00:00Z",
          refreshAfterSeconds: 15,
          partial: false,
          providers: [],
          events: [],
        },
        providers: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("calls the provider diagnostics method for the matched event", async () => {
    const fetchDiagnostics = vi.fn().mockResolvedValue({
      eventId: "vercel-dep_1",
      summary: "Build failed",
      lines: [],
      truncated: false,
    });
    const event = {
      id: "vercel-dep_1",
      source: "vercel" as const,
      service: "frontend",
      type: "deployment" as const,
      severity: "error" as const,
      status: "ERROR",
      message: "failed",
      occurredAt: "2026-07-28T03:00:00Z",
      diagnosticAvailable: true,
    };

    const result = await getEventDiagnostics("vercel-dep_1", undefined, {
      snapshot: {
        generatedAt: "2026-07-28T03:00:00Z",
        refreshAfterSeconds: 15,
        partial: false,
        providers: [],
        events: [event],
      },
      providers: [{
        source: "vercel",
        fetchSnapshot: vi.fn(),
        fetchDiagnostics,
      }],
    });

    expect(result.summary).toBe("Build failed");
    expect(fetchDiagnostics).toHaveBeenCalledWith(event, undefined);
  });
});
```

- [ ] **Step 2: Implement the lookup service**

Create `src/lib/monitor/event-diagnostics.ts`:

```ts
import "server-only";
import { getMonitorSnapshot } from "./aggregate";
import { getServerEnv } from "@/lib/env/server";
import { createProviders, type MonitorProvider } from "@/lib/providers/types";
import type { MonitorDiagnosticsResult, MonitorSnapshot } from "./types";

export class DiagnosticLookupError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getEventDiagnostics(
  eventId: string,
  signal?: AbortSignal,
  overrides?: { snapshot: MonitorSnapshot; providers: MonitorProvider[] },
): Promise<MonitorDiagnosticsResult> {
  const snapshot = overrides?.snapshot ?? await getMonitorSnapshot({ signal });
  const event = snapshot.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new DiagnosticLookupError(404, "Monitor event not found");
  if (!event.diagnosticAvailable) {
    throw new DiagnosticLookupError(400, "Diagnostics are unavailable for this event");
  }

  const providers = overrides?.providers ?? createProviders(getServerEnv());
  const provider = providers.find((candidate) => candidate.source === event.source);
  if (!provider?.fetchDiagnostics) {
    throw new DiagnosticLookupError(400, "Provider diagnostics are unavailable");
  }
  return provider.fetchDiagnostics(event, signal);
}
```

- [ ] **Step 3: Write the route tests**

Create `tests/unit/api-diagnostics.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "project_monitor_session",
  verifySessionToken: vi.fn(async (token: string) =>
    token === "valid" ? { scope: "monitor:read" } : null,
  ),
}));

vi.mock("@/lib/monitor/event-diagnostics", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/monitor/event-diagnostics")
  >("@/lib/monitor/event-diagnostics");
  return {
    ...actual,
    getEventDiagnostics: vi.fn(async (eventId: string) => ({
      eventId,
      summary: "Build failed",
      lines: [],
      truncated: false,
    })),
  };
});

import { GET } from "@/app/api/monitor/diagnostics/route";

const request = (url: string, authenticated = true) =>
  new NextRequest(url, {
    headers: authenticated
      ? { cookie: "project_monitor_session=valid" }
      : undefined,
  });

describe("GET /api/monitor/diagnostics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a valid session", async () => {
    const response = await GET(request(
      "http://localhost/api/monitor/diagnostics?eventId=vercel-dep_1",
      false,
    ));
    expect(response.status).toBe(401);
  });

  it("requires eventId", async () => {
    const response = await GET(request(
      "http://localhost/api/monitor/diagnostics",
    ));
    expect(response.status).toBe(400);
  });

  it("returns private diagnostics", async () => {
    const response = await GET(request(
      "http://localhost/api/monitor/diagnostics?eventId=vercel-dep_1",
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      eventId: "vercel-dep_1",
      summary: "Build failed",
    });
  });
});
```

- [ ] **Step 4: Implement the route**

Create `src/app/api/monitor/diagnostics/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import {
  DiagnosticLookupError,
  getEventDiagnostics,
} from "@/lib/monitor/event-diagnostics";
import { ProviderError } from "@/lib/providers/request";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !await verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    const result = await getEventDiagnostics(eventId, req.signal);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof DiagnosticLookupError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ProviderError) {
      const status =
        error.code === "rate_limited" ? 429 :
        error.code === "timeout" ? 504 :
        502;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Unable to load diagnostics" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run service and route tests**

Run:

```text
npm run test -- tests/unit/event-diagnostics.test.ts tests/unit/api-diagnostics.test.ts
```

Expected: PASS.

### Task 6: Replace the Aiven-only alert with shared provider incidents

**Files:**
- Create: `src/lib/monitor/incidents.ts`
- Create: `src/components/monitor/ProviderIncidentAlerts.tsx`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Modify: `src/lib/providers/aiven.ts`
- Delete: `src/lib/monitor/aiven-incidents.ts`
- Delete: `src/components/monitor/AivenIncidentAlerts.tsx`
- Replace test: `tests/unit/aiven-incidents.test.ts` with `tests/unit/incidents.test.ts`
- Modify: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**
- Consumes: `ServiceStatus[]`, `MonitorEvent[]`, `incidentKey`
- Produces: `deriveActiveIncidents`, shared alert banner and browser notification behavior

- [ ] **Step 1: Write failing shared incident tests**

Create `tests/unit/incidents.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveActiveIncidents } from "@/lib/monitor/incidents";

const failedService = {
  source: "vercel" as const,
  service: "frontend",
  status: "failed" as const,
  checkedAt: "2026-07-28T03:00:00Z",
};

it("uses the deployment incident key from the latest error event", () => {
  const incidents = deriveActiveIncidents([failedService], [{
    id: "vercel-dep_1",
    source: "vercel",
    service: "frontend",
    type: "deployment",
    severity: "error",
    status: "ERROR",
    message: "Build failed",
    occurredAt: "2026-07-28T03:00:00Z",
    stage: "build",
    incidentKey: "vercel:frontend:dep_1",
  }]);

  expect(incidents[0]).toMatchObject({
    key: "vercel:frontend:dep_1",
    source: "vercel",
    status: "failed",
    stage: "build",
  });
});

it("does not create incidents for healthy services", () => {
  expect(deriveActiveIncidents([{ ...failedService, status: "healthy" }], [])).toEqual([]);
});
```

- [ ] **Step 2: Implement incident derivation**

Create `src/lib/monitor/incidents.ts`:

```ts
import type {
  DiagnosticStage,
  MonitorEvent,
  MonitorSource,
  ServiceStatus,
} from "./types";

export type ActiveMonitorIncident = {
  key: string;
  source: Extract<MonitorSource, "aiven" | "vercel" | "render">;
  service: string;
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  stage: DiagnosticStage;
  summary: string;
  externalUrl?: string;
};

const alertSources = new Set(["aiven", "vercel", "render"]);

export function deriveActiveIncidents(
  services: ServiceStatus[],
  events: MonitorEvent[],
): ActiveMonitorIncident[] {
  return services
    .filter((service) => alertSources.has(service.source) && service.status !== "healthy")
    .map((service) => {
      const event = events.find(
        (candidate) =>
          candidate.source === service.source &&
          candidate.service === service.service &&
          candidate.severity !== "info",
      );
      return {
        key: event?.incidentKey ?? `${service.source}:${service.service}:${service.status}`,
        source: service.source as ActiveMonitorIncident["source"],
        service: service.service,
        status: service.status,
        severity: event?.severity ?? "warning",
        stage: event?.stage ?? "unknown",
        summary: event?.message ?? `${service.service} status is ${service.status}`,
        externalUrl: event?.externalUrl,
      };
    });
}
```

- [ ] **Step 3: Add Aiven incident metadata**

Add to the Aiven event in `src/lib/providers/aiven.ts`:

```ts
stage: "database",
incidentKey: `aiven:${serviceRef.label}`,
diagnosticAvailable: false,
```

- [ ] **Step 4: Implement the shared alert component**

Create `src/components/monitor/ProviderIncidentAlerts.tsx`.

Required props:

```ts
type Props = {
  services: ServiceStatus[];
  events: MonitorEvent[];
};
```

Use this state and notification flow:

```ts
const STORAGE_KEY = "project-monitor:notified-incidents:v1";
const activeIncidents = deriveActiveIncidents(services, events);
const previousHealthRef = useRef(
  new Map(services.map((service) => [
    `${service.source}:${service.service}`,
    service.status,
  ])),
);
const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported",
);
const [recoveries, setRecoveries] = useState<string[]>([]);

const notifyMissingIncidents = useCallback(() => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notified = new Set<string>(
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
  );
  for (const incident of activeIncidents) {
    if (notified.has(incident.key)) continue;
    new Notification(`${incident.source.toUpperCase()} incident: ${incident.service}`, {
      body: `${incident.status.toUpperCase()} · ${incident.stage.toUpperCase()} · ${incident.summary}`,
      icon: "/icons/icon-192.png",
    });
    notified.add(incident.key);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...notified]));
}, [activeIncidents]);

useEffect(() => {
  notifyMissingIncidents();

  const previous = previousHealthRef.current;
  const recovered = services.filter((service) => {
    const key = `${service.source}:${service.service}`;
    return previous.get(key) !== "healthy" && service.status === "healthy";
  });
  previousHealthRef.current = new Map(
    services.map((service) => [
      `${service.source}:${service.service}`,
      service.status,
    ]),
  );
  if (recovered.length === 0) return;

  const labels = recovered.map(
    (service) => `${service.source.toUpperCase()} ${service.service}`,
  );
  setRecoveries(labels);
  const notified = new Set<string>(
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
  );
  for (const service of recovered) {
    const prefix = `${service.source}:${service.service}:`;
    for (const key of notified) {
      if (key.startsWith(prefix) || key === prefix.slice(0, -1)) notified.delete(key);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...notified]));
  const timer = window.setTimeout(() => setRecoveries([]), 8_000);
  return () => window.clearTimeout(timer);
}, [services, notifyMissingIncidents]);

const enableNotifications = async () => {
  if (!("Notification" in window)) return;
  const nextPermission = await Notification.requestPermission();
  setPermission(nextPermission);
  if (nextPermission === "granted") notifyMissingIncidents();
};
```

Render:

```tsx
<div className="space-y-2">
  {recoveries.map((label) => (
    <div key={label} role="status" className="rounded border border-emerald-800 p-3">
      RECOVERED · {label}
    </div>
  ))}

  {activeIncidents.map((incident) => (
    <div key={incident.key} role="alert" className="rounded border border-rose-800 p-3">
      <div>
        {incident.source.toUpperCase()} incident · {incident.service} ·{" "}
        {incident.status.toUpperCase()} · {incident.stage.toUpperCase()}
      </div>
      <div>{incident.summary}</div>
      {incident.externalUrl && (
        <a href={incident.externalUrl} target="_blank" rel="noopener noreferrer">
          View provider
        </a>
      )}
    </div>
  ))}

  {permission === "default" && (
    <button type="button" onClick={enableNotifications}>
      Enable browser alerts
    </button>
  )}
  {(permission === "denied" || permission === "unsupported") && (
    <span>Browser notifications are unavailable or blocked</span>
  )}
</div>
```

- [ ] **Step 5: Mount the shared component**

In `MonitorDashboard.tsx` replace:

```tsx
<AivenIncidentAlerts services={allServices} />
```

with:

```tsx
<ProviderIncidentAlerts services={allServices} events={rawEvents} />
```

- [ ] **Step 6: Extend component tests**

Add Vercel `ERROR` and Render `build_failed` fixtures with distinct `incidentKey` values. Assert:

```ts
expect(screen.getByText(/VERCEL incident/i)).toBeInTheDocument();
expect(screen.getByText(/RENDER incident/i)).toBeInTheDocument();
expect(screen.getByText(/build failed/i)).toBeInTheDocument();
```

Click `Enable browser alerts`, rerender with the same snapshot and assert the Notification constructor was called once per active incident, not again on the repeated snapshot.

- [ ] **Step 7: Run incident and component tests**

Run:

```text
npm run test -- tests/unit/incidents.test.ts tests/components/MonitorDashboard.test.tsx
```

Expected: PASS.

### Task 7: Add status and stage filters

**Files:**
- Modify: `src/components/monitor/SourceFilters.tsx`
- Modify: `src/components/monitor/MonitorDashboard.tsx`
- Modify: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**
- Consumes: current snapshot events
- Produces: raw status and diagnostic stage filters combined with source and severity

- [ ] **Step 1: Write failing filter assertions**

Add to the dashboard component test:

```ts
fireEvent.click(screen.getByTestId("filter-status-build_failed"));
expect(screen.getByText(/Render build failed/i)).toBeInTheDocument();
expect(screen.queryByText(/Vercel build failed/i)).not.toBeInTheDocument();

fireEvent.click(screen.getByTestId("filter-status-all"));
fireEvent.click(screen.getByTestId("filter-stage-build"));
expect(screen.getByText(/Render build failed/i)).toBeInTheDocument();
```

- [ ] **Step 2: Add dashboard filter state**

In `MonitorDashboard.tsx`:

```ts
const [selectedStatus, setSelectedStatus] = useState<string | "all">("all");
const [selectedStage, setSelectedStage] = useState<DiagnosticStage | "all">("all");

const availableStatuses = Array.from(
  new Set(rawEvents.map((event) => event.status)),
).sort();

const filteredEvents = rawEvents.filter((event) => {
  if (selectedSource !== "all" && event.source !== selectedSource) return false;
  if (selectedSeverity !== "all" && event.severity !== selectedSeverity) return false;
  if (selectedStatus !== "all" && event.status !== selectedStatus) return false;
  if (selectedStage !== "all" && event.stage !== selectedStage) return false;
  return true;
});
```

- [ ] **Step 3: Extend SourceFilters props and controls**

Add props:

```ts
selectedStatus: string | "all";
selectedStage: DiagnosticStage | "all";
availableStatuses: string[];
availableStages: DiagnosticStage[];
onSelectStatus: (status: string | "all") => void;
onSelectStage: (stage: DiagnosticStage | "all") => void;
```

Render status and stage buttons with these test IDs:

```tsx
data-testid={`filter-status-${status}`}
data-testid={`filter-stage-${stage}`}
```

Always render `All`, then dynamic values from the current events.

- [ ] **Step 4: Pass the new filter props**

In `MonitorDashboard.tsx`:

```tsx
<SourceFilters
  selectedSource={selectedSource}
  selectedSeverity={selectedSeverity}
  selectedStatus={selectedStatus}
  selectedStage={selectedStage}
  availableStatuses={availableStatuses}
  availableStages={Array.from(
    new Set(rawEvents.map((event) => event.stage).filter(Boolean)),
  ) as DiagnosticStage[]}
  onSelectSource={setSelectedSource}
  onSelectSeverity={setSelectedSeverity}
  onSelectStatus={setSelectedStatus}
  onSelectStage={setSelectedStage}
/>
```

- [ ] **Step 5: Run component tests**

Run:

```text
npm run test -- tests/components/MonitorDashboard.test.tsx
```

Expected: PASS.

### Task 8: Add expandable diagnostic log details to Terminal

**Files:**
- Create: `src/components/monitor/EventDiagnosticDetails.tsx`
- Modify: `src/components/monitor/TerminalPanel.tsx`
- Create: `tests/components/EventDiagnosticDetails.test.tsx`
- Modify: `tests/components/MonitorDashboard.test.tsx`

**Interfaces:**
- Consumes: `eventId`, `/api/monitor/diagnostics`
- Produces: accessible expand/collapse control, loading, error and log states

- [ ] **Step 1: Write the failing component test**

Create `tests/components/EventDiagnosticDetails.test.tsx`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EventDiagnosticDetails from "@/components/monitor/EventDiagnosticDetails";

afterEach(() => vi.unstubAllGlobals());

it("loads diagnostic lines when the user expands the event", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      eventId: "render-dep_1",
      summary: "npm run build exited with code 1",
      truncated: false,
      lines: [{
        id: "log-1",
        stage: "build",
        level: "error",
        message: "npm run build exited with code 1",
        occurredAt: "2026-07-28T03:00:00Z",
      }],
    }),
  }));

  render(<EventDiagnosticDetails eventId="render-dep_1" />);
  fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));

  await waitFor(() => {
    expect(screen.getByText(/exited with code 1/i)).toBeInTheDocument();
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/monitor/diagnostics?eventId=render-dep_1",
    expect.objectContaining({ cache: "no-store" }),
  );
});
```

- [ ] **Step 2: Implement the expandable component**

Create `src/components/monitor/EventDiagnosticDetails.tsx`:

```tsx
"use client";

import { useState } from "react";
import LocalTime from "@/components/LocalTime";
import type { MonitorDiagnosticsResult } from "@/lib/monitor/types";

type Props = { eventId: string };

export default function EventDiagnosticDetails({ eventId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MonitorDiagnosticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (result || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/monitor/diagnostics?eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("diagnostics request failed");
      setResult(await response.json() as MonitorDiagnosticsResult);
    } catch {
      setError("Unable to load diagnostic logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <button type="button" onClick={toggle} aria-expanded={expanded}>
        {expanded ? "Hide diagnostic details" : "View diagnostic details"}
      </button>

      {expanded && (
        <div className="mt-2 rounded border border-slate-800 p-3">
          {loading && <div>Loading diagnostic logs…</div>}
          {error && <div role="alert">{error}</div>}
          {result && (
            <>
              <div>{result.summary}</div>
              <ul>
                {result.lines.map((line) => (
                  <li key={line.id}>
                    {line.occurredAt && <LocalTime value={line.occurredAt} />}{" "}
                    [{line.level}] [{line.stage}] {line.message}
                  </li>
                ))}
              </ul>
              {result.truncated && <div>Log output was truncated</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount diagnostics in TerminalPanel**

Under the event message:

```tsx
{evt.diagnosticAvailable && (
  <EventDiagnosticDetails eventId={evt.id} />
)}
```

Add a visible stage tag:

```tsx
{evt.stage && (
  <span className="px-1.5 py-0.5 rounded border border-violet-800 bg-violet-950 text-violet-300 text-[10px] uppercase">
    {evt.stage}
  </span>
)}
```

Display deployment ID beside the event message when available:

```tsx
{evt.deploymentId && (
  <div className="text-[10px] text-slate-500">
    Deployment: {evt.deploymentId}
  </div>
)}
```

- [ ] **Step 4: Add error-state and collapse tests**

Add these assertions to `tests/components/EventDiagnosticDetails.test.tsx`:

```ts
it("shows a generic load error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
  render(<EventDiagnosticDetails eventId="render-dep_1" />);
  fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load diagnostic logs",
  );
});

it("collapses without refetching loaded diagnostics", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      eventId: "render-dep_1",
      summary: "Build failed",
      lines: [],
      truncated: true,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<EventDiagnosticDetails eventId="render-dep_1" />);

  fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));
  expect(await screen.findByText("Log output was truncated")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /hide diagnostic details/i }));
  fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 5: Run Terminal component tests**

Run:

```text
npm run test -- tests/components/EventDiagnosticDetails.test.tsx tests/components/MonitorDashboard.test.tsx
```

Expected: PASS.

### Task 9: Document behavior and run complete verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: completed provider diagnostics and UI behavior
- Produces: deployment notes and verified production build

- [ ] **Step 1: Document provider diagnostics**

Add to README:

```md
### Deployment diagnostics

Vercel and Render deployment status is included in the 15-second monitor snapshot.
Build logs are fetched only when an authenticated user expands diagnostic details.
The response is redacted and limited to 20 lines or 4 KB.

- Vercel diagnostics use deployment events for non-READY deployments.
- Render diagnostics use the configured service ID and the owner ID returned by the service API.
- Provider tokens remain server-side.
- The monitor never retries, cancels, rolls back, or triggers a deployment.
```

No new environment variable is required. Keep `.env.example` unchanged except for a comment explaining that Render owner ID is discovered from the service response:

```env
# Render owner/workspace ID is resolved from the configured service.
```

- [ ] **Step 2: Run all tests**

Run:

```text
npm run test
```

Expected: all unit and component tests pass.

- [ ] **Step 3: Run E2E**

Run:

```text
npm run test:e2e
```

Expected: all Playwright tests pass.

- [ ] **Step 4: Run static checks**

Run:

```text
npm run typecheck
npm run lint
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Build production output**

Run:

```text
npm run build
```

Expected: Next.js production build completes and includes `/api/monitor/diagnostics`.

- [ ] **Step 6: Manual production verification after the user deploys**

Verify:

1. healthy Vercel and Render services show no incident banner
2. non-ready deployment shows a banner and status tag
3. clicking diagnostic details loads log lines
4. a repeated poll does not duplicate the browser notification
5. returning to `READY` or `live` shows recovery
6. source, severity, status and stage filters combine correctly
7. no token appears in snapshot or diagnostics responses
