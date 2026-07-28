# Project Monitor System Architecture

## Overview

Monitor is split into two dedicated operational views sharing a common header & session navigation shell (`/app/monitor/layout.tsx`):

1. **Logs Workspace (`/monitor`)**: Provider-only read-only telemetry dashboard (Render, Vercel, Supabase, Upstash, GitHub, Aiven) displaying real-time metrics, service health cards, and diagnostic error logs.
2. **Production Test Runner Workspace (`/monitor/tests`)**: Isolated, production-safe test runner interface backed by a secure Windows Local Test Agent and Upstash Redis REST queueing.

```
                  ┌─────────────────────────────────────┐
                  │          Shared Header Shell         │
                  │   (/app/monitor/layout.tsx Layout)  │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────┐                           ┌────────────────────────┐
│    Logs Workspace     │                           │  Test Runner Workspace │
│       (/monitor)      │                           │    (/monitor/tests)    │
│  Provider Telemetry   │                           │ Preset Shortcuts & Logs │
└──────────┬────────────┘                           └───────────┬────────────┘
           │                                                    │
           ▼                                                    ▼
┌───────────────────────┐                           ┌────────────────────────┐
│ Snapshot Aggregator   │                           │ Upstash Redis REST Queue│
│ (/api/monitor/*)      │                           │ (/api/test-runner/*)   │
└───────────────────────┘                           └───────────┬────────────┘
                                                                │
                                                                ▼
                                                    ┌────────────────────────┐
                                                    │ Windows Local Agent    │
                                                    │  (cross-spawn / taskkill)│
                                                    └────────────────────────┘
```

## Security & Execution Isolation

- **Separate Execution Session**: Execution actions require a 30-minute step-up JWT session cookie (`project_monitor_execute`) authenticated by `TEST_RUNNER_PASSWORD_HASH`.
- **Command Whitelisting**: Presets are declared locally on the Agent machine in `test-runner.config.local.json`. The browser API payloads contain only `{ projectId, presetId }` and never contain executable paths, raw commands, arguments, or environment variables.
- **Agent Bearer Token**: Agent endpoints require a timing-safe Bearer token match (`TEST_RUNNER_AGENT_TOKEN`).
- **Windows Process Tree Termination**: Executable launches are wrapped with `cross-spawn` (resolving `.cmd` wrappers for `npm`/`npx`), and cancellation/timeouts invoke native process-tree destruction (`taskkill.exe /PID <pid> /T /F`).

## Redis v2 Data Structure & Leases

- `monitor:test-runner:v2:agent:<id>:catalog` - Agent preset catalog (7-day TTL).
- `monitor:test-runner:v2:agent:<id>:presence` - Agent presence heartbeat state (`online`, `lagging`, `offline`).
- `monitor:test-runner:v2:agent:<id>:queue` - FIFO job queue (`LPOP`, max 10 jobs).
- `monitor:test-runner:v2:agent:<id>:active` - Atomic active job lock (`SET NX EX`).
- `monitor:test-runner:v2:job:<id>` - Canonical job state & progress metadata.
- `monitor:test-runner:v2:job:<id>:logs` - Cursor-paged log sorted set scored by line sequence.
- `monitor:test-runner:v2:idempotency:<key>` - Deduplication key mapping `Idempotency-Key` headers to job IDs.
- `monitor:test-runner:v2:history` - Sorted set history of 20 most recent execution jobs.

## Log & Progress Limits

- **Log Upload Batching**: Log entries are batched at most 100 lines, 32 KiB, or 250ms per upload.
- **Pending Memory Cap**: Local agent buffers at most 512 KiB pending logs before emitting a local truncation notice.
- **Server Storage Bounds**: Jobs store at most 5,000 lines or 1 MiB log data.
- **UI Terminal Bounds**: Live test terminal renders at most 1,000 lines with auto-scroll detection.
- **Framework Progress Parsers**: Summary parsers for Jest, Vitest, and Cypress extract test counts and completion percentages; unknown frameworks fall back safely without inventing arbitrary progress percentages.
