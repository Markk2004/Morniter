# Playwright Automation Workspace Architecture

**Repository**: `Markk2004/Morniter`  
**Target Route**: `/monitor/tests`  
**Architecture Status**: Proposed / Reference Implementation  

---

## 1. Architectural Goal

Transform the Morniter Test Runner from a **preset-driven command launcher** into an interactive **Playwright Automation Development and Execution Workspace** while maintaining the hardened security invariants and scalable infrastructure of the current system.

---

## 2. Existing Architecture

```
┌───────────────────────────┐
│ /monitor/tests            │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ TestRunnerWorkspace       │
├───────────────────────────┤
│ ExecutionUnlock           │
│ AgentStatusBanner         │
│ PresetLauncher            │
│ RunProgress               │
│ LiveTestTerminal          │
│ JobHistory                │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ /api/test-runner/*        │
├───────────────────────────┤
│ auth                      │
│ lock                      │
│ catalog                   │
│ jobs                      │
│ agent                     │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Upstash Redis             │
│ queue / job / logs        │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Windows Local Agent       │
├───────────────────────────┤
│ config                    │
│ preset resolver           │
│ process adapter           │
│ executor                  │
│ redaction                 │
│ progress parser           │
└───────────────────────────┘
```

---

## 3. Target Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Browser Client                          │
│                 /monitor/tests                             │
├────────────────────────────────────────────────────────────┤
│ Execution Unlock                                           │
│ Agent Presence                                             │
│ Project Selector                                           │
│ Test / Function Explorer                                   │
│ Browser Selector (Chromium, Firefox, WebKit)               │
│ Code Workspace (Monaco/CodeMirror Editor)                  │
│ Execution Toolbar                                          │
│ Browser Status                                             │
│ Live Terminal                                              │
│ Artifact Panel                                             │
│ History                                                    │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTPS (Strict Zod Validation)
                            ▼
┌────────────────────────────────────────────────────────────┐
│                     Next.js Server                         │
├────────────────────────────────────────────────────────────┤
│ Session Auth                                               │
│ Execution Step-Up (15m JWT Session Cookie)                 │
│ Request Validation                                         │
│ Catalog Proxy                                              │
│ Job Creation                                               │
│ Job Read / Cancel                                          │
│ Artifact Authorization                                     │
└───────────────────────────┬────────────────────────────────┘
                            │ REST
                            ▼
┌────────────────────────────────────────────────────────────┐
│                    Upstash Redis                           │
├────────────────────────────────────────────────────────────┤
│ agent presence                                             │
│ catalog                                                    │
│ FIFO queue                                                 │
│ active lease                                               │
│ job state & progress                                       │
│ logs (Cursor-paged Sorted Set)                             │
│ job history                                                │
│ idempotency                                                │
│ artifact metadata                                          │
└───────────────────────────┬────────────────────────────────┘
                            │ poll / claim
                            ▼
┌────────────────────────────────────────────────────────────┐
│                 Windows Local Agent                        │
├────────────────────────────────────────────────────────────┤
│ Agent Authentication                                       │
│ Project Registry                                           │
│ Test Catalog Scanner                                       │
│ Function Scanner                                           │
│ Workspace Builder (%LOCALAPPDATA%\Morniter\runs\<jobId>)   │
│ Playwright Command Builder                                 │
│ Process Executor (cross-spawn, shell: false)               │
│ Log Batcher + Redactor                                     │
│ Result Parser (Custom Playwright Reporter)                 │
│ Artifact Manager                                           │
│ Cleanup Manager                                            │
└───────────────────────────┬────────────────────────────────┘
                            │ spawn (shell: false, safe childEnv)
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

## 4. Trust Boundaries

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
Browser input is completely untrusted. Next.js validates:
- `projectId`
- `testIds`
- `browsers`
- `mode`
- `source`
- `code` length bounds
- `idempotencyKey`

**Browser is strictly forbidden from supplying**:
- Executable binary names or paths
- Working directories (`cwd`)
- Arbitrary CLI arguments
- Agent URL or token
- Redis credentials
- Environment variable overrides

### Boundary B — Next.js ↔ Redis
- Next.js is the authoritative creator of canonical job objects.
- Redis acts as a transport and state store, **not** the filesystem authority.

### Boundary C — Redis ↔ Agent
- Local Agent authenticates with `TEST_RUNNER_AGENT_TOKEN` (timing-safe).
- Local Agent independently revalidates the job before execution.
- *Guiding Principle*: **Never trust a job simply because it arrived via Redis.**

### Boundary D — Agent ↔ Child Process
- The test runner process is an execution isolation boundary.
- Child test processes **never** receive:
  - `SESSION_SIGNING_SECRET`
  - `GROUP_ACCESS_PASSWORD_HASH`
  - `TEST_RUNNER_PASSWORD_HASH`
  - `TEST_RUNNER_AGENT_TOKEN`
  - `UPSTASH_REDIS_REST_TOKEN`
  - Provider tokens (Vercel, Render, Aiven, cron-job.org)

---

## 5. Project Registry

Configuration defined in `test-runner.config.local.json` on the Agent machine:

```json
{
  "agentId": "windows-agent-01",
  "projects": [
    {
      "id": "projectsts",
      "name": "ProjectSTS",
      "root": "E:\\ProjectSTS",
      "playwright": {
        "testDir": "e2e",
        "config": "playwright.config.ts",
        "allowedBaseUrls": [
          "http://localhost:3000",
          "https://staging.example.com"
        ],
        "allowWorkspaceExecution": true,
        "allowHeaded": true
      }
    }
  ]
}
```

The absolute project `root` exists solely on the Agent host. The frontend and Redis only receive clean identifiers: `{ "id": "projectsts", "name": "ProjectSTS" }`.

---

## 6. Catalog Architecture

```
Agent Startup
   │
   ▼
Scan configured project roots
   ├─ Discover *.spec.ts files
   ├─ Parse test titles & descriptions
   ├─ Normalize relative paths
   └─ Generate stable test IDs
   │
   ▼
Publish catalog to Redis
   │
   ▼
Next.js /api/test-runner/catalog
   │
   ▼
Frontend Test Explorer
```

Catalog refresh triggers:
- On Agent startup
- On explicit user refresh button click
- On periodic interval / background heartbeat

---

## 7. Test ID Strategy

To prevent path traversal (`../../secret.ts`), absolute or raw relative paths are never exposed as user-controllable IDs:

- **Relative Path**: `e2e/auth/login.spec.ts`
- **Title**: `Login with valid credentials`
- **Generated ID**: `auth-login-valid-credentials-a8f2e1`

The Agent maps `testId` to its verified relative path within the project root.

---

## 8. Workspace Execution Architecture

```
User Code in Browser Editor
  │
  ▼
POST /api/test-runner/jobs
  │
  ▼
Next.js Validates Schema & Byte Size
  │
  ▼
Enqueued to Redis
  │
  ▼
Agent Claims & Validates Job
  │
  ▼
Agent Creates Isolated Temp Workspace:
%LOCALAPPDATA%\Morniter\runs\<jobId>\
  ├─ workspace.spec.ts
  ├─ generated.playwright.config.ts
  └─ artifacts/
  │
  ▼
Spawn fixed Playwright executable (shell: false)
  │
  ▼
Collect output / logs / test metrics
  │
  ▼
Purge temporary source files & retention management
```

Ad-hoc workspace code is never written into the project's permanent source tree.

---

## 9. Command Construction

**Dangerous (Forbidden)**:
```ts
spawn(job.command, job.args); // Arbitrary command execution vulnerability
```

**Safe & Deterministic**:
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

---

## 10. Browser Selection & Enums

```ts
import { z } from "zod";

export const BrowserSchema = z.enum(["chromium", "firefox", "webkit"]);
export const BrowsersSchema = z.array(BrowserSchema).min(1).max(3);
```

Browser lists are deduplicated prior to enqueueing.

---

## 11. Browser Execution Strategy

### Strategy A — Unified Invocation (Phase 1 Recommended)
```bash
playwright test --project=chromium --project=firefox --project=webkit
```
- **Pros**: Native Playwright execution, single child process, simple lifecycle.
- **Cons**: Coarse per-browser cancellation granularity.

### Strategy B — Per-Browser Child Execution (Phase 4 Extension)
```
Job
 ├─ Chromium child process
 ├─ Firefox child process
 └─ WebKit child process
```
- **Pros**: Granular per-browser progress, isolated retry/cancel, clean log tagging.
- **Cons**: Orchestration complexity and higher memory footprint.

---

## 12. Reporter Strategy

Rather than relying purely on regex parsing of unstructured stdout, the Agent uses a structured custom reporter (`agent/playwright-reporter/`):

```json
{
  "type": "test-end",
  "browser": "chromium",
  "testId": "auth-login",
  "status": "passed",
  "durationMs": 1234
}
```

Structured events update canonical progress while raw stdout continues streaming to the live terminal.

---

## 13. Job State Machine

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

---

## 14. Redis Model Extension

- `monitor:test-runner:v2:agent:<id>:presence` - Agent presence & capabilities.
- `monitor:test-runner:v2:agent:<id>:catalog` - Playwright & Preset test catalog.
- `monitor:test-runner:v2:agent:<id>:queue` - FIFO job queue.
- `monitor:test-runner:v2:agent:<id>:active` - Atomic active job lease lock.
- `monitor:test-runner:v2:job:<id>` - Canonical job state & progress metadata.
- `monitor:test-runner:v2:job:<id>:logs` - Sequence-scored log sorted set.
- `monitor:test-runner:v2:job:<id>:artifacts` - Artifact metadata index.
- `monitor:test-runner:v2:history` - Sorted set history of 20 most recent execution jobs.

---

## 15. API Architecture

- `GET /api/test-runner/catalog` - Returns agent presence, projects, and test catalog.
- `GET /api/test-runner/playwright/source?projectId=X&testId=Y` - Returns authorized spec source.
- `POST /api/test-runner/jobs` - Enqueues existing test run or workspace code run.
- `GET /api/test-runner/jobs/:id` - Fetches job status and cursor-paged logs.
- `POST /api/test-runner/jobs/:id/cancel` - Signals cancellation request.

---

## 16. Source Retrieval Model

- **Phase 2 Implementation**: Test source code is retrieved via Agent-mediated requests restricted strictly to verified `testId` identifiers. Absolute filesystem paths are never accepted over HTTP.

---

## 17. Editor Architecture

The Code Workspace is a presentation-tier editor (Monaco or CodeMirror). It does not compile or evaluate scripts on the browser client or Next.js server.

```ts
interface EditorState {
  sourceType: "project-test" | "workspace";
  selectedTestId?: string;
  code: string;
  dirty: boolean;
}
```

---

## 18. Save Semantics

- **Run Draft**: Executes the current editor buffer directly in the isolated temp workspace.
- **Save to Project**: Intentionally omitted in initial phases to avoid write hazards and git merge conflicts.

---

## 19. Production Guardrails

```json
{
  "environments": {
    "local": {
      "baseUrl": "http://localhost:3000",
      "risk": "safe"
    },
    "staging": {
      "baseUrl": "https://staging.example.com",
      "risk": "controlled"
    },
    "production": {
      "baseUrl": "https://prod.example.com",
      "risk": "production",
      "workspaceExecution": false
    }
  }
}
```

Mutating automation against production targets is denied by default.

---

## 20. Artifact Architecture

- Artifacts stored on Agent: `%LOCALAPPDATA%\Morniter\artifacts\<jobId>\`
- Metadata stored in Redis.
- Delivered to authorized users via authenticated Next.js proxy endpoints.
- Raw file paths (`file:///C:/...`) are never exposed to clients.
- Enforces max size limits, MIME verification, and automated TTL cleanup.

---

## 21. Failure Isolation

System guarantees dashboard resilience during failures:
- Agent offline
- Playwright binaries missing
- TypeScript compilation failure
- Test timeout / cancellation
- Browser process crash
- Missing artifact files

---

## 22. Browser Installation Detection

Agent probes installed browser binaries on startup:
```json
{
  "capabilities": {
    "browsers": {
      "chromium": true,
      "firefox": true,
      "webkit": false
    },
    "headed": true,
    "workspaceExecution": true
  }
}
```
Frontend disables unavailable browsers automatically.

---

## 23. Observability & System Log Events

System lifecycle events emitted to terminal stream `"system"`:
- `job_queued`
- `job_claimed`
- `workspace_prepared`
- `playwright_started`
- `browser_launched`
- `test_passed` / `test_failed`
- `artifacts_harvested`
- `cleanup_completed`

---

## 24. Cleanup Policy

On Agent startup and job completion:
- Purge temporary execution workspaces older than 2 hours.
- Purge artifact directories exceeding TTL (7 days).
- Clean orphan job locks and stale processes.

---

## 25. Concurrency Policy

- **Phase 1**: Exactly 1 active job per agent to avoid headed browser display conflicts and resource contention.
- **Future Phases**: Configurable `maxConcurrentJobs`.

---

## 26. Backward Compatibility

- Optional feature flag: `PLAYWRIGHT_WORKSPACE_ENABLED=true`.
- Legacy preset runner compatibility maintained during transition.

---

## 27. Security Invariants Summary

1. Browser never selects executable binary.
2. Browser never selects absolute working directory.
3. Browser never receives Agent Bearer token or provider credentials.
4. Child process never inherits server secrets.
5. Filesystem access is bounded to allowlisted project & temp workspace roots.
6. Workspace code is never evaluated inside the Next.js process.
7. Production mutation is denied by default.
8. All output is sanitized via multi-pass redaction.
9. Runtime, output lines, and artifact sizes are strictly bounded.

---

## 28. Target Directory Structure

```
Morniter/
├── src/
│   ├── app/
│   │   ├── monitor/
│   │   │   └── tests/
│   │   │       └── page.tsx
│   │   └── api/
│   │       └── test-runner/
│   │           ├── auth/
│   │           ├── lock/
│   │           ├── catalog/
│   │           ├── jobs/
│   │           ├── agent/
│   │           └── playwright/
│   │               ├── source/
│   │               └── artifacts/
│   │
│   ├── components/
│   │   ├── test-runner/
│   │   └── playwright-runner/
│   │       ├── PlaywrightWorkspace.tsx
│   │       ├── usePlaywrightRunner.ts
│   │       ├── browser/
│   │       ├── editor/
│   │       ├── explorer/
│   │       ├── execution/
│   │       └── artifacts/
│   │
│   └── lib/
│       ├── test-runner/
│       └── playwright-runner/
│           ├── types.ts
│           ├── schemas.ts
│           ├── lifecycle.ts
│           └── api.ts
│
├── agent/
│   └── src/
│       ├── progress/
│       │   └── playwright.ts
│       └── playwright/
│           ├── catalog.ts
│           ├── validator.ts
│           ├── workspace.ts
│           ├── command-builder.ts
│           ├── runner.ts
│           ├── artifacts.ts
│           ├── result-parser.ts
│           └── cleanup.ts
│
├── playwright.config.ts
└── docs/
    └── superpowers/
        └── plans/
            └── 2026-08-26-playwright-automation-workspace.md
```
