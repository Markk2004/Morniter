# redis usage and status implementation plan

> **For agentic workers:** Execute this plan inline in the current workspace. Do not run git add or git commit.

**Goal:** Add a Redis status panel that reports Upstash database health and the Project Monitor process's own Redis command usage without interrupting the Logs page.

**Architecture:** Wrap the existing server-side Upstash Redis client with a typed proxy that records method calls in process memory. Add a session-protected status route that calls Upstash REST `INFO` directly so the health probe is not counted as app usage, then render a client-side panel in `MonitorLogsPage` on the same refresh cadence as the monitor snapshot.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, `@upstash/redis`, Vitest, Testing Library.

## Global Constraints

- `total_commands_processed` is a database-wide Redis metric, not an app-only quota.
- App command counts are process-memory metrics for the current server instance.
- Redis status failures must not replace or block the Logs content.
- Do not expose Redis URL, token, password, raw `INFO` output, or environment values.
- Do not add dependencies, change auth cookies, or use Upstash Management API credentials in the browser.
- Do not run git commands.

### Task 1: Add the app command counter and Redis proxy

**Files:**
- Create: `src/lib/test-runner/redis-command-counter.ts`
- Modify: `src/lib/test-runner/redis.ts`
- Test: `tests/unit/test-runner/redis-command-counter.test.ts`

**Interfaces:**
- Produces `recordRedisCommand(command: string): void`, `getRedisCommandSnapshot(): RedisCommandSnapshot`, `resetRedisCommandCounters(): void`, and `RedisCommandSnapshot`.
- `getRunnerRedis()` continues to return a `Redis`-compatible object to existing store and rate-limit callers.

- [ ] **Step 1: Write the counter test**

Cover total count, uppercase command buckets, unknown command names, reset behavior, and a snapshot containing `windowStartedAt`, `windowDurationSeconds`, `total`, and `byCommand`.

- [ ] **Step 2: Run the counter test and verify it fails**

Run `npm run test -- tests/unit/test-runner/redis-command-counter.test.ts`.

Expected: FAIL because the counter module does not exist yet.

- [ ] **Step 3: Implement the process-memory counter**

Use a module-level `Map<string, number>` and a window start timestamp. `recordRedisCommand` normalizes the name with `toUpperCase()`, `getRedisCommandSnapshot` returns a new serializable object, and `resetRedisCommandCounters` clears counts and starts a new window.

- [ ] **Step 4: Wrap Redis method calls without changing existing callers**

In `getRunnerRedis`, create the Redis instance once, then return a `Proxy<Redis>` that records a command when a callable Redis method is invoked and forwards the original receiver and arguments with `Reflect.apply`. Cache the proxy so callers receive the same object on later calls. Do not count methods used by the status route because that route uses direct REST `INFO` requests.

- [ ] **Step 5: Run counter and existing Redis-related tests**

Run `npm run test -- tests/unit/test-runner/redis-command-counter.test.ts tests/unit/test-runner/store.test.ts tests/unit/test-runner/active-lease.test.ts`.

Expected: PASS.

### Task 2: Add a safe Redis status route

**Files:**
- Create: `src/lib/test-runner/redis-status.ts`
- Create: `src/app/api/monitor/redis-status/route.ts`
- Test: `tests/unit/test-runner/redis-status.test.ts`
- Test: `tests/integration/redis-status-route.test.ts`

**Interfaces:**
- Produces `RedisStatusResponse`, `readRedisStatus()`, and `GET /api/monitor/redis-status`.
- Consumes `getServerEnv`, `getRedisCommandSnapshot`, `SESSION_COOKIE`, and `verifySessionToken`.

- [ ] **Step 1: Define the response and parser tests**

Test parsing Redis `INFO` text containing `total_commands_processed`, `used_memory`, and `uptime_in_seconds`; missing fields must become `null` and downgrade status to `DEGRADED`. Test latency at or below 500ms as healthy, above 500ms as degraded, and a rejected fetch as unavailable.

- [ ] **Step 2: Implement direct REST `INFO` reading**

POST `JSON.stringify(["INFO"])` to `UPSTASH_REDIS_REST_URL` with the bearer token from server env. Measure elapsed time with `performance.now()`. Parse only the three approved fields and return the app command snapshot separately. Never include the raw result in the response or error text.

- [ ] **Step 3: Add session protection and safe HTTP responses**

Use the same session guard pattern as `src/app/api/monitor/snapshot/route.ts`. Return 401 for missing/invalid sessions. For a valid session, return status 200 with `status: "UNAVAILABLE"` when Redis is unreachable so the Logs page can continue rendering.

- [ ] **Step 4: Run route tests**

Run `npm run test -- tests/unit/test-runner/redis-status.test.ts tests/integration/redis-status-route.test.ts`.

Expected: PASS.

### Task 3: Render the Redis status panel in Logs

**Files:**
- Create: `src/components/monitor/RedisStatusPanel.tsx`
- Modify: `src/components/monitor/MonitorLogsPage.tsx`
- Test: `tests/components/RedisStatusPanel.test.tsx`

**Interfaces:**
- `RedisStatusPanel` accepts `{ data: RedisStatusResponse | null; isLoading: boolean }`.
- `MonitorLogsPage` fetches `/api/monitor/redis-status` independently from the existing snapshot request.

- [ ] **Step 1: Write the panel tests**

Cover loading state, healthy metrics, degraded status, unavailable error copy, command breakdown, and accessible status text.

- [ ] **Step 2: Implement the panel**

Render a semantic `section` with a heading, text status badge, database-wide total commands, app command total, command breakdown, memory, total keys, latency, and last checked time. Use `aria-live="polite"` for loading/error content and do not rely on color alone.

- [ ] **Step 3: Fetch status on the existing monitor refresh lifecycle**

Add `redisStatus`, `isRedisStatusLoading`, and `fetchRedisStatus` state to `MonitorLogsPage`. Fetch on initial render and whenever `activeSnapshot?.generatedAt` changes. A failed fetch should set an unavailable response locally and must not clear `snapshot` or prevent `TerminalPanel` from rendering.

- [ ] **Step 4: Run component tests**

Run `npm run test -- tests/components/RedisStatusPanel.test.tsx tests/components/MonitorShell.test.tsx`.

Expected: PASS.

### Task 4: Verify the complete change

**Files:**
- No additional files.

- [ ] **Step 1: Run all tests**

Run `npm run test`.

Expected: all existing and new tests pass.

- [ ] **Step 2: Run static checks**

Run `npm run typecheck` and `npm run lint`.

Expected: both commands exit with code 0.

- [ ] **Step 3: Run the production build**

Run `npm run build`.

Expected: Next.js compiles and prerenders without errors.
