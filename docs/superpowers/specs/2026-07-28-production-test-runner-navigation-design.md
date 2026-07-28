# Production Test Runner Navigation Design

## Purpose

Make Monitor suitable for production use as a read-only deployment monitor plus a controlled test runner. Logs remain the default view. Test execution moves to a separate route with preset-only commands, live progress, bounded resource use, recoverable jobs, and a Local Agent protocol that can later be implemented by GitHub or GitLab runners.

## Approved product decisions

- `/monitor` is the default Logs page.
- `/monitor/tests` is the Test Runner page.
- Both routes share one header and navigation bar.
- Test execution requires a separate execution password. A successful unlock lasts 30 minutes and can be locked manually.
- Each Agent may run only one job at a time. A second job cannot be queued while one is queued, claimed, running, or waiting for cancellation.
- Test shortcuts are presets from `test-runner.config.local.json`; the browser cannot create or edit commands.
- Progress uses framework-aware parsing for Jest, Cypress, and Vitest. Unknown output falls back to honest stage-based progress without a fabricated percentage.
- The first production runner remains the current Windows Local Agent. Protocol boundaries must allow a future GitHub or GitLab runner without changing the browser contract.
- Logs are retained for seven days, capped at 1 MiB and 5,000 lines per job.
- The UI is desktop-first and must remain usable without horizontal overflow on smaller screens.

## Route and component architecture

`src/app/monitor/layout.tsx` owns session protection and renders a shared `MonitorShell`. The shell contains the logo, display name, route-aware navigation, contextual status, and logout action.

`src/app/monitor/page.tsx` remains the Logs page. It fetches the provider snapshot and renders a logs-focused component without loading Test Runner APIs.

`src/app/monitor/tests/page.tsx` renders the Test Runner workspace. It does not fetch provider snapshots or run provider polling.

The Test Runner workspace is split by responsibility:

- `TestRunnerWorkspace` coordinates server data, active-job state, and polling.
- `AgentStatusBanner` distinguishes online, lagging, offline, network-slow, and Redis-unavailable conditions.
- `PresetLauncher` renders project selection and preset shortcut cards.
- `RunConfirmation` confirms project, preset, command preview, and timeout without exposing `cwd` or environment values.
- `RunProgress` renders stage, framework counts, percentage when available, and elapsed time.
- `LiveTestTerminal` renders cursor-paged logs with independent auto-scroll.
- `JobHistory` filters recent runs by project and status.

## Job state model

The canonical job states are:

```text
queued
claimed
running
passed
failed
cancel_requested
cancelled
timed_out
agent_lost
```

Terminal states are `passed`, `failed`, `cancelled`, `timed_out`, and `agent_lost`.

The server, not the UI, enforces one active job. Creating a job takes an idempotency key and returns the existing job for a repeated request with the same key. A conflicting request while another job is active returns HTTP 409 with the active job.

Claiming a job creates a lease. While executing, the Agent sends a heartbeat every five seconds. A running Agent becomes `lagging` after 15 seconds without heartbeat. Its active job becomes `agent_lost` after 45 seconds. An idle Agent publishes presence every 30 seconds and becomes offline after 75 seconds.

## Execution and cancellation

The Windows executor must support `npm`, `npx`, Node executables, and direct executable paths without using an unsafe free-form browser command.

Windows `.cmd` files are launched through an explicit platform adapter rather than passing `.cmd` directly to `spawn` with `shell: false`, which currently raises `spawn EINVAL` on Node 24. Arguments are quoted by the adapter, and configured presets remain the only source of executable and arguments.

Cancellation is cooperative at the protocol level and forceful at the process level:

1. The browser requests cancellation.
2. The server changes the job to `cancel_requested`.
3. The Agent observes cancellation during heartbeat.
4. The Agent terminates the process tree.
5. The Agent reports `cancelled`.

Timeout follows the same process-tree termination path and reports `timed_out`. A preset timeout may not exceed 1,800 seconds.

## Progress parsing

The Agent owns progress parsing so browsers do not repeatedly parse large output. Parsers implement one interface and may consume stdout or stderr lines:

```ts
interface ProgressParser {
  consume(stream: TestLogStream, lines: string[]): TestProgress | null;
}
```

`TestProgress` contains framework, completed count, total count, optional percentage, current label, and update time. Jest, Cypress, and Vitest receive dedicated parsers. The fallback parser reports only the current execution stage and elapsed time.

Parsing failure must never fail the test process. Invalid or unknown output is stored as ordinary terminal output.

## Log transport and storage

The Agent batches logs using all of these limits:

- no more than 100 lines per batch;
- no more than 32 KiB per batch;
- flush after 250 ms when a batch is not full;
- no more than 512 KiB pending in the Agent buffer.

Uploads are sequential and backpressured. The Agent does not mark a job complete until pending log uploads finish or reach a bounded retry limit.

Each log entry has a monotonically increasing sequence. Redis writes are idempotent by sequence. Duplicate retries do not create duplicate lines.

The server enforces both 1 MiB and 5,000-line limits. Once either limit is reached, it appends one system truncation line, marks the job truncated, and ignores later log payloads.

The browser reads logs by cursor with a maximum of 200 lines per response. The terminal keeps at most 1,000 rendered lines in the DOM and can request older pages. It does not issue `LRANGE 0 -1`.

Redis operations use pipelines for batch append, expiry, byte-count, and job metadata updates. Job data and logs expire after seven days. The history sorted set removes expired job references during reads and writes.

## Overload and lag protection

- Provider monitoring and Test Runner polling are isolated by route.
- Only one active request of each polling type may exist in the browser.
- Active-job polling uses a two-second interval while visible.
- Idle Test Runner polling backs off to 30–60 seconds.
- Log polling pauses when the browser tab is hidden and resumes from the last sequence.
- Agent heartbeat remains independent from log upload.
- Redis and provider requests use bounded timeouts and return typed availability errors.
- Double-click and network retry cannot create duplicate jobs.
- A bounded Agent buffer truncates output instead of allowing unbounded memory growth.
- The UI reports `Agent lagging`, `Network slow`, `Redis unavailable`, and `Agent offline` separately.

## Security

- Browser job creation accepts only `projectId`, `presetId`, and an idempotency key.
- The monitor read session and execution session remain separate.
- Execution cookies are `HttpOnly`, `Secure` in production, `SameSite=Strict`, path `/`, and expire after 30 minutes.
- Mutating browser routes validate same-origin requests.
- Unlock, Run, Cancel, and Agent endpoints are rate-limited.
- Agent authentication remains server-to-server and is never exposed in browser payloads.
- Preset `cwd`, environment values, and raw Agent configuration are not returned to browsers.
- Secret redaction runs in the Agent before transport and on the server before Redis storage.
- The Local Agent should run as a non-administrator Windows user.

## UI behavior

The shared header contains:

```text
[Logo] Monitor        Logs | Tests        Context actions        Logout
```

The Logs page keeps provider incidents, service cards, filters, and the deployment terminal. Its refresh control does not appear on the Tests page.

The Tests page shows:

1. Agent status, last heartbeat, and execution lock state.
2. Project selector and preset shortcut cards.
3. Run confirmation.
4. Active-job stage rail and framework-aware progress.
5. Live terminal with stdout, stderr, and system tags.
6. Recent history with project and status filters.

Run controls are disabled while locked, offline, lagging beyond the safe threshold, Redis is unavailable, or another job is active. Failure summaries show exit code, failed stage, duration, and the most relevant error line above the terminal.

## Error handling

API responses use stable error codes in addition to readable messages. Required codes include:

```text
EXECUTION_LOCKED
AGENT_OFFLINE
AGENT_LAGGING
ACTIVE_JOB_EXISTS
REDIS_UNAVAILABLE
IDEMPOTENCY_CONFLICT
JOB_NOT_FOUND
LOG_LIMIT_REACHED
INVALID_AGENT_PAYLOAD
```

UI error states include a concrete recovery action. A provider or test-runner outage must not redirect an authenticated user unless their monitor session itself is invalid.

## Verification

Required automated coverage:

- state transitions and terminal-state guards;
- single-active-job and idempotent enqueue;
- lease, heartbeat, lagging, and agent-lost recovery;
- Windows `npm.cmd` execution, timeout, cancel, and process-tree termination;
- sequential log batching, retry, duplicate sequence, byte and line truncation;
- Jest, Cypress, Vitest, and fallback progress parsers;
- route navigation and active navigation state;
- execution unlock expiry and manual lock;
- preset confirmation, active progress, terminal cursor paging, and history filters;
- E2E success, failure, cancellation, timeout, refresh during execution, and recovery after Agent loss.

Production acceptance requires:

- a safe `node --version` smoke preset passes through the deployed Monitor and Local Agent;
- the STS frontend suite reports 258 passing tests and zero failures;
- typecheck, lint, unit tests, production build, and Playwright E2E all pass;
- no secret appears in browser responses, stored logs, or rendered terminal output;
- closing and reopening the Tests route preserves active state and resumes logs without duplication.

## Out of scope

- Arbitrary command input in the browser.
- Editing Agent presets from the web.
- Parallel execution on one Agent.
- Scheduled tests.
- Permanent history beyond seven days.
- Implementing GitHub or GitLab runners in this iteration.
- A fabricated progress percentage for unknown frameworks.
