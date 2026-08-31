# Playwright Production Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden the Playwright runner so a team member can select real ProjectSTS tests, run them through the Windows Local Agent, inspect logs, recover from failures, and use the deployed Morniter application safely.

**Architecture:** Keep the legacy preset runner under `/api/test-runner` and the Playwright runner under `/api/playwright-runner`. The Local Agent remains the only process that reads ProjectSTS files and executes Playwright; Morniter stores bounded jobs, logs, presence, and a deduplicated source catalog in Upstash Redis. Production verification uses the same checked source revision and environment contract as local verification.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Upstash Redis, Node.js Windows Local Agent, Playwright, Vitest, Testing Library, Vercel, and ProjectSTS frontend.

## Global Constraints

- Do not run `git add`, `git commit`, `git push`, `git reset`, `git checkout`, or any other Git mutation; the workspace owner handles Git.
- Do not modify ProjectSTS business logic, production data, or the `student_tracking` database.
- ProjectSTS Playwright tests run from `E:\ProjectSTS\frontend` with `testRoot` equal to `e2e`.
- The configured Playwright project ID is `sts-playwright`; the legacy preset project ID `sts` is not the Playwright catalog project.
- Execution Lock and Monitor Login use the same `GROUP_ACCESS_PASSWORD_HASH`.
- Browser payloads contain only validated project and test IDs; commands, paths, and environment values come from the Local Agent allowlist.
- Never publish absolute filesystem paths, provider tokens, password hashes, database URLs, authorization headers, or raw secrets to the browser or terminal logs.
- Keep catalog source bounded and deduplicated by relative file path; do not upload a complete catalog on every idle poll.
- Do not add a cron job, WebSocket, database, arbitrary shell command, or provider mutation action.

---

## Task 0: Restore realtime terminal log delivery before all other work

> **Mandatory release blocker:** Complete and verify this task before starting Tasks 1–5. Do not deploy or mark a real-job smoke test complete while a finished job can contain zero persisted terminal lines.

**Why this comes first:** The browser currently shows only the client-side submission line while a real failed `sts-playwright` job can finish with `logCount: 0`. The Redis read path works when logs are posted, so the first fix must make Agent delivery acknowledged, retryable, and observable before testing the rest of the production workflow.

**Files:**

- Modify: `E:\project-monitor\agent\src\log-batcher.ts`
- Modify: `E:\project-monitor\agent\src\client.ts`
- Modify: `E:\project-monitor\agent\src\runner.ts`
- Modify: `E:\project-monitor\src\components\playwright-runner\usePlaywrightRunner.ts`
- Create: `E:\project-monitor\agent\src\single-instance.ts` only if the existing Agent startup has no reusable single-instance guard
- Test: `E:\project-monitor\tests\unit\test-agent\log-batcher.test.ts`
- Test: `E:\project-monitor\tests\unit\test-agent\playwright-runner.test.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-agent-routes.test.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-e2e-flow.test.ts`
- Modify: `E:\project-monitor\docs\superpowers\plans\STATUS.md`

**Interfaces:**

- `LogBatcher.push`, `flush`, and `drain` must retain an unacknowledged batch and sequence number until `/api/playwright-runner/agent/logs` accepts it.
- `AgentClient.appendPlaywrightLogs` must return success only for an acknowledged response and throw a safe error containing HTTP status and a bounded response reason without headers, tokens, paths, or environment values.
- `runner.ts` must drain pending stdout, stderr, and system lines before reporting a terminal job status.
- `usePlaywrightRunner` must append log pages by sequence without duplicates and perform a bounded final reconciliation after a job becomes terminal.
- Only one local Agent process may use a given `agentId` on the same machine at a time.

- [x] **Step 1: Reproduce the loss with failing batching tests**

Add tests where the first two uploads reject and the third succeeds. Assert that the same lines and starting sequence remain pending until acknowledgment, the accepted upload contains every line exactly once, and `drain()` rejects if its retry budget is exhausted.

Run:

```powershell
npx vitest run tests/unit/test-agent/log-batcher.test.ts
```

Expected before the fix: at least one assertion fails because the current queue is removed or its sequence advances before upload acknowledgment.

- [x] **Step 2: Make log batching acknowledgment-based**

Change `LogBatcher` to copy the pending slice, await upload, and only then remove that slice and advance its sequence. Serialize flushes so timer and explicit drains cannot upload the same range concurrently. Retry transient upload failures with bounded exponential delays of 250 ms, 500 ms, 1 s, 2 s, and 4 s; do not retry authentication or validation failures indefinitely.

- [x] **Step 3: Surface safe Agent upload diagnostics**

Update `AgentClient.appendPlaywrightLogs` so a failed response reports a safe shape such as `log upload failed: HTTP 401 unauthorized` or `HTTP 500 upstream_error`. Cap the response excerpt, parse JSON defensively, and redact authorization values, URLs containing credentials, absolute workspace paths, and environment output.

- [x] **Step 4: Prevent completion before log delivery settles**

Add a system start line before spawning Playwright. Await `LogBatcher.drain()` after the child process closes and before completing the job. If delivery still fails after bounded retries, do not report a clean pass; finish with a safe log-delivery failure reason that remains visible through the job status API.

- [x] **Step 5: Prevent duplicate Local Agents with the same ID**

Add or reuse a Windows-safe single-instance guard keyed by `agentId`. A second process must exit with a clear message before polling or claiming work. Release the guard on normal shutdown and reject a stale guard only after verifying that its owning process is no longer alive. Unit-test active-owner and stale-owner behavior without exposing machine paths to the frontend.

- [x] **Step 6: Reconcile browser logs without an unbounded loop**

Keep one log-page request in flight per job, append only sequences not yet displayed, and retain the existing bounded polling interval. When status first becomes `passed`, `failed`, `cancelled`, or `timed_out`, fetch one final log page after the current request settles, then stop polling when no newer sequence remains.

- [x] **Step 7: Run focused automated verification**

Run:

```powershell
npx vitest run tests/unit/test-agent/log-batcher.test.ts tests/unit/test-agent/playwright-runner.test.ts tests/integration/playwright-runner-agent-routes.test.ts tests/integration/playwright-runner-e2e-flow.test.ts
npm run test-agent:build
npm run typecheck
```

Expected: retry, sequence, drain, terminal reconciliation, and Agent build checks all pass.

- [x] **Step 8: Prove realtime output with one real ProjectSTS job**

Stop every existing Local Agent, start exactly one Agent with `agentId=windows-local-agent-1`, then run one selected `sts-playwright` test. While it runs, confirm the terminal grows beyond the submission line; after completion, confirm Redis-backed job details report `logCount > 0` and the UI contains system output plus any emitted stdout or stderr without duplicate sequence entries.

- [x] **Step 9: Unlock the remaining plan only after evidence is recorded**

Update `STATUS.md` with the focused test result, Agent build result, real job ID without secrets, final status, and observed log count. Only then proceed to Task 1 and the remaining production checks.

---

## Task 1: Establish one correct Local Agent configuration

**Files:**

- Modify: `E:\project-monitor\test-runner.config.local.json`
- Modify: `E:\project-monitor\agent\test-runner.config.example.json`
- Modify: `E:\project-monitor\README.md`
- Test: `E:\project-monitor\tests\unit\test-agent\config.test.ts` or the existing Agent config test file

**Interfaces:**

- Consumes: `AgentConfigSchema`, `buildPlaywrightCatalogFromConfig`, and the Local Agent `TEST_RUNNER_CONFIG` environment variable.
- Produces: one documented configuration contract with `agentId`, `serverUrl`, `sts-playwright`, `workspaceRoot`, `testRoot`, `config`, and `PLAYWRIGHT_BASE_URL`.

- [x] **Step 1: Add a failing configuration contract test**

Assert that a parsed config contains:

```ts
expect(config.projects.find((project) => project.id === "sts-playwright")?.playwright).toMatchObject({
  workspaceRoot: "E:\\ProjectSTS\\frontend",
  testRoot: "e2e",
  config: "playwright.config.ts",
  allowedBrowsers: ["chromium"],
  allowWorkspaceExecution: false,
});
```

- [x] **Step 2: Run the test and capture the current contract**

Run:

```powershell
npx vitest run tests/unit/test-agent/config.test.ts
```

Expected: the test either passes against the local config or fails with the exact mismatched field. Do not print token or environment values. (Verified: 8/8 tests passed).

- [x] **Step 3: Keep local and production server targets explicit**

Use `http://localhost:3000` only in the local config when testing the local Next server. Document the production alternative `https://morniter.vercel.app` without embedding it as a secret. The example config must use a clearly named server URL placeholder and must not contain a real token.

- [x] **Step 4: Validate the real ProjectSTS catalog**

Run:

```powershell
$env:TEST_RUNNER_CONFIG="E:\project-monitor\test-runner.config.local.json"
npm run test-agent:build
node --input-type=module -e "import fs from 'node:fs'; import { buildPlaywrightCatalogFromConfig } from './agent/dist/playwright-catalog.js'; const c=JSON.parse(fs.readFileSync('./test-runner.config.local.json','utf8')); const p=(await buildPlaywrightCatalogFromConfig(c)).projects.find(x=>x.id==='sts-playwright'); console.log(JSON.stringify({id:p?.id,tests:p?.tests.length,groups:p?.testGroups.map(g=>({name:g.name,count:g.tests.length})),scanPathLabel:p?.scanPathLabel}));"
```

Expected:

```text
{"id":"sts-playwright","tests":3,"groups":[{"name":"Authentication","count":1},{"name":"Monitor","count":1},{"name":"Students","count":1}],"scanPathLabel":"frontend/e2e"}
```

- [x] **Step 5: Run configuration and Agent build checks**

Run:

```powershell
npx vitest run tests/unit/test-agent/config.test.ts
npm run test-agent:build
```

Expected: both commands exit 0.

---

## Task 2: Prove the complete local execution path

**Files:**

- Modify: `E:\project-monitor\docs\superpowers\plans\STATUS.md`
- Test: `E:\project-monitor\tests\integration\playwright-runner-e2e-flow.test.ts`
- Test: `E:\ProjectSTS\frontend\e2e\auth\login.spec.ts`
- Test: `E:\ProjectSTS\frontend\e2e\students\access.spec.ts`
- Test: `E:\ProjectSTS\frontend\e2e\monitor\navigation.spec.ts`

**Interfaces:**

- Consumes: `/api/playwright-runner/catalog`, `/api/playwright-runner/jobs`, Local Agent poll, source loading API, and ProjectSTS `webServer`.
- Produces: evidence that selecting `sts-playwright` results in a real queued job, streamed terminal output, and a final job status.

- [x] **Step 1: Add a red-capable integration assertion for the ProjectSTS project**

The integration seam must assert all of the following from the catalog response:

```ts
expect(project.id).toBe("sts-playwright");
expect(project.testGroups.map((group) => group.name)).toEqual([
  "Authentication",
  "Monitor",
  "Students",
]);
expect(project.tests).toHaveLength(3);
```

- [x] **Step 2: Start the local Next server and Agent with the same target**

Run in separate terminals:

```powershell
cd E:\project-monitor
npm run dev
```

```powershell
cd E:\project-monitor
$env:TEST_RUNNER_CONFIG="E:\project-monitor\test-runner.config.local.json"
npm run test-agent
```

Expected Agent output contains the configured agent ID and `http://localhost:3000`; it must not contain a token, password, or database URL.

- [x] **Step 3: Run the ProjectSTS Playwright suite independently**

Run:

```powershell
cd E:\ProjectSTS\frontend
npx playwright test
```

Expected: 3 tests pass and the configured `webServer` starts or reuses the frontend on port 3001.

- [x] **Step 4: Run one safe job from Morniter**

In `/monitor/tests`, unlock with the shared group password, select `STS Playwright Automation`, select one test, and run Chromium headless.

Record only these values in the release note:

```text
projectId=sts-playwright
selectedTestCount=1
status=passed|failed
logStreams=stdout,stderr,system
```

Never record the password, Agent token, Redis token, or complete environment output.

- [x] **Step 5: Verify source loading and project switching**

Confirm that clicking a test title loads the matching relative file into the editor, switching to `Project Monitor Automation` clears the selected STS test, and switching back reloads the STS catalog without showing the previous source or search term.

- [x] **Step 6: Update `STATUS.md` only after the live job is observed**

Mark the live-job item complete only when the job status, terminal log, source loading, and final result have all been observed. Keep production smoke unchecked until Task 4 passes.

---

## Task 3: Verify concurrency and recovery boundaries

**Files:**

- Modify: `E:\project-monitor\src\lib\playwright-runner\job-store-logic.ts` only if a failing test identifies a transition or lease defect
- Test: `E:\project-monitor\tests\unit\playwright-runner\job-store.test.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-agent-routes.test.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-e2e-flow.test.ts`
- Modify: `E:\project-monitor\docs\superpowers\plans\STATUS.md`

**Interfaces:**

- Consumes: bounded Redis queue, active-job lease, Agent presence TTL, cancel route, timeout handling, and catalog publish throttling.
- Produces: repeatable evidence for multi-user use without duplicate claims or unbounded polling.

- [x] **Step 1: Add tests for one active job per Agent**

Enqueue two jobs for the same Agent and assert the second active execution is rejected or remains queued according to the existing queue contract. Assert that two concurrent claim calls return at most one job.

- [x] **Step 2: Add tests for stale lease recovery**

Advance the test clock beyond `LEASE_SECONDS`, run stale-job recovery, and assert the stale job is no longer marked active and can be claimed again. Assert that a heartbeat before expiry keeps ownership.

- [x] **Step 3: Add tests for cancellation and timeout**

Assert these transitions:

```text
queued -> cancelled
running -> cancel_requested -> cancelled
running -> timed_out
```

Assert that terminal jobs cannot be cancelled again and that the terminal log remains bounded.

- [x] **Step 4: Verify Agent offline and reconnect behavior**

Stop the Agent process, wait longer than the presence TTL, and confirm the UI shows offline or lagging without retrying aggressively. Start the Agent again and confirm the catalog and presence recover without duplicate jobs.

- [x] **Step 5: Measure catalog polling load**

Observe 2 minutes of idle Agent logs and count poll requests. Catalog upload must occur only on the first publish or when the catalog version changes; heartbeat updates may continue each interval. No source file should be uploaded once per idle poll.

- [x] **Step 6: Run the focused recovery suite**

Run:

```powershell
npx vitest run tests/unit/playwright-runner/job-store.test.ts tests/integration/playwright-runner-agent-routes.test.ts tests/integration/playwright-runner-e2e-flow.test.ts
```

Expected: all tests pass with no unbounded log or polling behavior.

---

## Task 4: Deploy and verify the production contract

**Files:**

- Modify: `E:\project-monitor\README.md`
- Modify: `E:\project-monitor\docs\superpowers\plans\STATUS.md`
- Modify: `E:\project-monitor\docs\superpowers\plans\2026-08-29-playwright-runner-deploy-readiness.md`
- Test: `E:\project-monitor\tests\integration\auth-routes.test.ts`
- Test: `E:\project-monitor\tests\integration\playwright-runner-browser-routes.test.ts`

**Interfaces:**

- Consumes: Vercel environment variables, deployed `/api/playwright-runner` routes, shared group password, Upstash Redis, and Local Agent production `serverUrl`.
- Produces: a production smoke record with no secret exposure and a clear rollback boundary owned by the user.

- [x] **Step 1: Verify the required Vercel variables before deployment**

Confirm in the Morniter Vercel project:

```text
GROUP_ACCESS_PASSWORD_HASH
SESSION_SIGNING_SECRET
TEST_RUNNER_AGENT_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Do not paste values into plans, logs, screenshots, or chat. The execution password does not require a separate `TEST_RUNNER_PASSWORD_HASH` after the shared-password change.

- [x] **Step 2: Run the exact local release gate**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run test-agent:build
npm run build
```

Expected: lint and typecheck pass, all Vitest tests pass, Agent TypeScript build passes, and Next.js generates the Playwright routes.

- [x] **Step 3: Deploy the verified source revision**

Push and deploy manually using the workspace owner’s Git/Vercel workflow. Do not change the Vercel environment values during this step.

- [x] **Step 4: Point a production Agent at Morniter**

Use a separate local configuration with:

```json
{
  "serverUrl": "https://morniter.vercel.app",
  "agentId": "windows-local-agent-1"
}
```

Keep the same `sts-playwright` workspace and test root. Do not run two Agents with the same `agentId` at the same time.

- [x] **Step 5: Perform production smoke checks**

Verify:

```text
unauthenticated /monitor/tests -> /login
group password -> Monitor opens
same group password -> Execution Lock unlocks
catalog -> sts-playwright with 3 tests in 3 groups
source request -> relativePath and source content only
one safe test -> queued -> claimed -> running -> passed|failed
```

- [x] **Step 6: Record production result and close only verified work**

Update `STATUS.md` with timestamp, deployment URL, test project ID, test count, and final status. Record failures as remaining work instead of marking the plan complete.

---

## Task 5: Finish operator documentation and PWA verification

**Files:**

- Modify: `E:\project-monitor\README.md`
- Modify: `E:\project-monitor\docs\superpowers\plans\STATUS.md`
- Test: `E:\project-monitor\public\manifest.webmanifest` through browser inspection
- Test: deployed `/manifest.webmanifest` and installed desktop app

**Interfaces:**

- Consumes: deployed login, `/monitor/tests`, manifest, cache headers, and the operator workflow from Tasks 1–4.
- Produces: a short team runbook with startup, environment, test selection, failure recovery, and PWA installation steps.

- [x] **Step 1: Document the safe startup commands**

Add the exact local commands for starting Next.js, setting `TEST_RUNNER_CONFIG`, building the Agent, and starting the Agent. State that the ProjectSTS frontend is started by Playwright `webServer` for local runs.

- [x] **Step 2: Document the project distinction**

State clearly that `sts` is the legacy preset project and `sts-playwright` is the Playwright project used by Test Explorer. Include the scan label `frontend/e2e` without exposing the absolute workspace path in browser-facing copy.

- [x] **Step 3: Document failure triage**

Use this order:

```text
Agent presence -> catalog groups -> selected test -> job status -> terminal stderr -> ProjectSTS app URL
```

Tell operators to inspect the expanded terminal log and never copy secrets from environment output.

- [x] **Step 4: Verify desktop PWA installation**

On Chromium desktop, open the deployed Morniter URL, confirm the install action appears, install the app, close the browser tab, and reopen the installed app. Confirm the manifest icon is the current logo and that stale assets are not shown after a hard refresh.

- [x] **Step 5: Run the final documentation and quality checks**

Run:

```powershell
npm run lint
npm run typecheck
npm test
```

Expected: all commands pass and `STATUS.md` has only real, externally unverified items left.

---

## Release exit criteria

- [x] Mandatory Task 0 passes: Agent log delivery is acknowledged and retryable, only one Agent owns an ID, and a real job shows realtime output with `logCount > 0`.
- [x] ProjectSTS catalog is online under `sts-playwright` with 3 tests in Authentication, Monitor, and Students.
- [x] A real selected ProjectSTS test runs through the Local Agent and its terminal output is visible in Morniter.
- [x] Source loading, project switching, search reset, and selected-test reset work in the browser.
- [x] Concurrent claim, cancel, timeout, offline, reconnect, and stale lease behavior are verified.
- [x] Production environment variables are present without exposing their values.
- [x] Production smoke passes against the deployed Morniter URL.
- [x] Desktop PWA install, icon, and cache update behavior are verified.
- [x] `STATUS.md` links only to the active release plan and completed historical plans are not listed as active work.
