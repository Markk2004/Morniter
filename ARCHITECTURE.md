# Project Monitor System Architecture

## Overview

Monitor is split into two dedicated operational views sharing a common header & session navigation shell (`/app/monitor/layout.tsx`):

1. **Logs Workspace (`/monitor`)**: Provider-only read-only telemetry dashboard (Render, Vercel, Supabase, Upstash, GitHub, Aiven) displaying real-time metrics, service health cards, and diagnostic error logs.
2. **Playwright Automation Workspace (`/monitor/tests`)**: Interactive browser automation workspace backed by a secure Windows Local Test Agent and Upstash Redis REST queueing, evolving from a preset-driven test runner into a full-featured Playwright development and execution environment.

```
                  ┌─────────────────────────────────────┐
                  │          Shared Header Shell         │
                  │   (/app/monitor/layout.tsx Layout)  │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────┐                           ┌────────────────────────────┐
│    Logs Workspace     │                           │ Playwright Auto Workspace  │
│       (/monitor)      │                           │      (/monitor/tests)      │
│  Provider Telemetry   │                           │ Code, Browsers, Live Logs  │
└──────────┬────────────┘                           └───────────┬────────────────┘
           │                                                    │
           ▼                                                    ▼
┌───────────────────────┐                           ┌────────────────────────────┐
│ Snapshot Aggregator   │                           │ Upstash Redis REST Queue   │
│ (/api/monitor/*)      │                           │ (/api/test-runner/*)       │
└───────────────────────┘                           └───────────┬────────────────┘
                                                                │
                                                                ▼
                                                    ┌────────────────────────────┐
                                                    │ Windows Local Agent        │
                                                    │ (spawn / taskkill / trace) │
                                                    └───────────┬────────────────┘
                                                                │
                                                                ▼
                                                    ┌────────────────────────────┐
                                                    │ Isolated Playwright Process│
                                                    │ Chromium / Firefox / WebKit│
                                                    └────────────────────────────┘
```

---

## Playwright Automation Architecture

### 1. Architectural Goal

Transition `/monitor/tests` from a preset-driven runner into an interactive **Playwright Automation Workspace** that allows developers to:
- Select target browsers (**Chromium**, **Firefox**, **WebKit**) via checklist.
- Switch between **Headless** (CI/background speed) and **Headed** (visual debugging on Agent machine) execution modes.
- Scan and select existing project Playwright tests (`.spec.ts`) and functions.
- Write, format, and execute ad-hoc Playwright scripts inside a Code Workspace without evaluating code on the Next.js server.
- Stream live terminal output with multi-pass redaction, trace capture, screenshots, videos, and HTML reports.
- Maintain strict execution unlocking, agent token verification, Redis queues, and process isolation.

```
┌────────────────────────────────────────────────────────────┐
│                    Browser Client                          │
│                 /monitor/tests                             │
├────────────────────────────────────────────────────────────┤
│ Execution Unlock                                           │
│ Agent Presence                                             │
│ Project Selector                                           │
│ Test / Function Explorer                                   │
│ Browser Selector (Chromium / Firefox / WebKit)             │
│ Code Workspace (Monaco/CodeMirror Editor)                  │
│ Execution Toolbar                                          │
│ Browser Status                                             │
│ Live Terminal                                              │
│ Artifact Panel (Traces, Screenshots, Videos, Reports)      │
│ History                                                    │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTPS (Strict Zod Validation)
                            ▼
┌────────────────────────────────────────────────────────────┐
│                     Next.js Server                         │
├────────────────────────────────────────────────────────────┤
│ Session Auth (monitor:read)                                │
│ Execution Step-Up (monitor:execute JWT cookie, 15m TTL)    │
│ Request Validation (Strict Schema, Payload Bounds)         │
│ Catalog Proxy                                              │
│ Job Creation (Idempotent Enqueue)                          │
│ Job Read/Cancel                                            │
│ Artifact Authorization Proxy                               │
└───────────────────────────┬────────────────────────────────┘
                            │ REST API
                            ▼
┌────────────────────────────────────────────────────────────┐
│                    Upstash Redis                           │
├────────────────────────────────────────────────────────────┤
│ agent presence (Heartbeat TTL 75s)                         │
│ catalog (Playwright & Preset catalog)                      │
│ FIFO queue (Max 10 jobs)                                   │
│ active lease (SET NX EX)                                   │
│ job state & progress metadata                              │
│ logs (Cursor-paged Sorted Set)                             │
│ job history (Recent 20 executions)                         │
│ idempotency mapping                                        │
│ artifact metadata records                                  │
└───────────────────────────┬────────────────────────────────┘
                            │ Poll / Claim (Bearer Token)
                            ▼
┌────────────────────────────────────────────────────────────┐
│                 Windows Local Agent                        │
├────────────────────────────────────────────────────────────┤
│ Agent Authentication (Timing-Safe Bearer Token)            │
│ Project Registry (Local Config Authority)                  │
│ Test Catalog Scanner (AST / Spec Discovery)                │
│ Function Scanner                                           │
│ Workspace Builder (%LOCALAPPDATA%\Morniter\runs\<jobId>)   │
│ Playwright Command Builder (Fixed Binaries / Allowlist)    │
│ Process Executor (cross-spawn, shell: false)               │
│ Log Batcher + Redactor                                     │
│ Result Parser (Custom JSON Reporter)                       │
│ Artifact Manager (Trace, Screenshot, Video, HTML)          │
│ Cleanup Manager (Stale Directory & Retention Purge)        │
└───────────────────────────┬────────────────────────────────┘
                            │ spawn (shell: false, childEnv)
                            ▼
┌────────────────────────────────────────────────────────────┐
│               Isolated Playwright Process                  │
│                                                            │
│  Chromium          Firefox          WebKit                 │
│      │                 │                │                  │
│      └─────────────────┴────────────────┘                  │
│                     Test Flow                              │
│                                                            │
│ Trace / Screenshot / Video / HTML Report                   │
└────────────────────────────────────────────────────────────┘
```

---

## Trust Boundaries & Security Model

The system enforces 4 strict trust boundaries to guarantee zero unauthorized remote code execution on both the Next.js server and Agent host:

```
[Browser Client]
       │
       │  Boundary A: Untrusted HTTP Input
       ▼
[Next.js Server]
       │
       │  Boundary B: Authorized Queue & State
       ▼
[Upstash Redis]
       │
       │  Boundary C: Authenticated Agent Polling
       ▼
[Windows Local Agent]
       │
       │  Boundary D: Sandboxed OS Execution Boundary
       ▼
[Playwright Child Process]
```

### Boundary A — Browser ↔ Next.js
- **Untrusted Input**: All browser payloads are strictly validated using Zod schemas (`projectId`, `testIds`, `browsers`, `mode`, `source`, `code`).
- **Forbidden Parameters**: The browser is strictly forbidden from providing executable binaries, raw shell strings, working directories (`cwd`), agent tokens, or environment overrides.

### Boundary B — Next.js ↔ Redis
- Next.js acts as the creator of canonical job records.
- Redis acts as a decoupled transport and state store. Redis is **not** the authority of the project filesystem.

### Boundary C — Redis ↔ Agent
- The Windows Local Agent authenticates via timing-safe comparison of `TEST_RUNNER_AGENT_TOKEN`.
- **Principle**: *Never trust a job solely because it arrived from Redis*. The Agent revalidates project IDs, browser enums, spec paths, and size limits before preparing execution workspaces.

### Boundary D — Agent ↔ Child Process
- The test execution environment is an isolated process boundary.
- **Environment Isolation**: Child test processes **never** inherit server secrets:
  - `SESSION_SIGNING_SECRET`
  - `GROUP_ACCESS_PASSWORD_HASH`
  - `TEST_RUNNER_PASSWORD_HASH`
  - `TEST_RUNNER_AGENT_TOKEN`
  - `UPSTASH_REDIS_REST_TOKEN`
  - Provider tokens (Vercel, Render, Aiven, cron-job.org)
- Only allowlisted test environment variables (`PATH`, `NODE_ENV=test`, `PLAYWRIGHT_BROWSERS_PATH`, `STS_UAT_*`) are passed.

---

## Execution Isolation & Code Workspace Security

1. **No Server-Side Evaluation**:
   - `eval()`, `new Function()`, and in-memory compilation inside the Next.js process are strictly forbidden.
   - User-authored workspace code is transferred as plain text data, verified for size limits (e.g. max 64 KB), and written to an isolated temporary workspace directory on the Agent.
2. **Dedicated Temporary Workspace**:
   - Workspace runs execute inside `%LOCALAPPDATA%\Morniter\runs\<jobId>\workspace.spec.ts`.
   - Ad-hoc scripts are **never** written into the project's permanent source tree.
3. **Fixed Command Construction**:
   - Playwright commands are constructed deterministically by the Agent:
     ```ts
     const executable = resolveLocalPlaywrightExecutable(project);
     const args = [
       "playwright",
       "test",
       resolvedSpecPath,
       ...browserArgs, // e.g. --project=chromium --project=firefox
     ];
     if (job.mode === "headed") {
       args.push("--headed");
     }
     ```
4. **Process-Tree Termination**:
   - Cancel requests and execution timeouts (default max 900s) trigger native Windows process-tree destruction (`taskkill.exe /PID <pid> /T /F`).

---

## Job State Machine

```
   queued
     │
     ▼
  claimed
     │
     ▼
 preparing
     │
     ▼
  running
     ├─────────────┬──────────────┐
     ▼             ▼              ▼
   passed        failed    cancel_requested
                                  │
                                  ▼
                              cancelled

  running
     │
     ▼
 timed_out
```

- Invalid state transitions (e.g., `passed -> running` or `cancelled -> passed`) are rejected by the state store.

---

## Redis Data Structure (v2 / v3)

- `monitor:test-runner:v2:agent:<id>:presence` - Agent heartbeat state (`online`, `lagging`, `offline`, capabilities).
- `monitor:test-runner:v2:agent:<id>:catalog` - Project test & preset catalog (7-day TTL).
- `monitor:test-runner:v2:agent:<id>:queue` - FIFO job queue (`LPOP`, max 10 jobs).
- `monitor:test-runner:v2:agent:<id>:active` - Atomic active job lock lease (`SET NX EX 60`).
- `monitor:test-runner:v2:job:<id>` - Canonical job state & progress metadata.
- `monitor:test-runner:v2:job:<id>:logs` - Cursor-paged log sorted set scored by sequence number.
- `monitor:test-runner:v2:job:<id>:artifacts` - Artifact metadata list (traces, screenshots, videos, reports).
- `monitor:test-runner:v2:idempotency:<key>` - Deduplication key mapping `Idempotency-Key` headers to job IDs.
- `monitor:test-runner:v2:history` - Sorted set history of 20 most recent execution jobs.

---

## Multi-Browser & Artifact Capture Model

### Browser Selection
- Supports independent or multi-selection of **Chromium**, **Firefox**, and **WebKit**.
- Agent capabilities check on startup detects which browser binaries are locally installed.

### Headed vs Headless Modes
- **Headless**: Default mode for automated background verification and CI/regression testing.
- **Headed**: Spawns real browser windows on the connected Local Agent desktop for visual inspection of automation flows.

### Artifacts Pipeline
- **Trace Files**: Playwright `.zip` traces captured on failure or on-demand.
- **Screenshots**: Auto-captured on test assertion failure.
- **Videos**: Recorded web session video files for debugging failed flows.
- **HTML Reports**: Standalone Playwright HTML reports.
- Artifacts are stored locally on the Agent (`%LOCALAPPDATA%\Morniter\artifacts\<jobId>\`) and exposed to authorized users via authenticated Next.js proxy endpoints with size limits, MIME verification, and automatic retention cleanup.

---

## Production Invariants & Guardrails

1. **Browser Never Selects Executable**: Binaries are resolved solely by the Local Agent configuration.
2. **Browser Never Selects Absolute Working Directory**: Path traversal (`../`) is blocked by stable test ID resolution.
3. **Browser Never Receives Agent or Provider Tokens**: Secrets remain on server or local agent environment only.
4. **Child Process Never Inherits Server Secrets**: Isolated execution environment without sensitive credentials.
5. **Workspace Code Never Runs in Server Process**: Executed strictly as isolated child processes on the Local Agent machine.
6. **Multi-Pass Redaction**: Sensitive patterns (Bearer tokens, database connection strings, secret JSON keys) are redacted in both the Agent and Next.js layers before storage in Redis or delivery to the UI.
7. **Strict Bounded Resources**: 1 concurrent job per agent, queue cap of 10, log limits of 5,000 lines / 1 MiB, terminal view capped at 1,000 lines.

