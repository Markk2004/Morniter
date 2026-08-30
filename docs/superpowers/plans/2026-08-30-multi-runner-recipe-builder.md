# Multi-Runner Automation and Recipe Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute this plan task-by-task with a review checkpoint after every task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run all discovered ProjectSTS tests with their native runner, load every source file into Code Workspace, and create verified Playwright tests through a safe structured Recipe Builder.

**Architecture:** Extend the current catalog with validated native-runner profiles and stable source IDs. The browser submits IDs only; the Local Agent resolves, partitions, and runs them sequentially. Recipe writes use a separate optimistic-concurrency Agent mutation queue and deterministic Playwright rendering.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vitest, Playwright, Jest, Node test runner, Upstash Redis, Windows Local Agent.

## Global Constraints

- Git operations are performed manually by the user; implementation agents must not run Git commands.
- Never accept raw commands, arguments, cwd, filesystem paths, or environment values from the browser.
- Never expose absolute ProjectSTS paths or secret values in UI, API, Redis, or logs.
- Only validated Local Agent configuration determines native-runner commands.
- Mixed runner selections execute sequentially with `continueOnFailure=false`.
- Manual ProjectSTS test files must never be overwritten or deleted.
- Generated files must stay under `frontend/e2e/generated`.
- Mutating recipes require cleanup and must be rejected for production hosts.
- A generated test can be saved only after its exact rendered draft passes.

---

### Task 1: Define Generic Catalog and Runner Profile Contracts

**Files:**
- Modify: `agent/src/types.ts`
- Modify: `agent/src/config.ts`
- Modify: `src/lib/playwright-runner/types.ts`
- Modify: `src/lib/playwright-runner/schemas.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`
- Test: `tests/unit/test-agent/automation-map.test.ts`
- Test: `tests/unit/playwright-runner/schemas.test.ts`

**Interfaces:**
- Produces `NativeRunner = "playwright" | "generated-playwright" | "node-test" | "jest" | "jest-e2e"`.
- Produces `RunnerProfile` and catalog rows containing `executionProfileId` and `risk`.

- [x] **Step 1: Add failing schema tests**

Assert that the map accepts contained profiles and rejects executable names, arbitrary arguments, absolute paths, `..`, and unknown profile references.

```ts
expect(() => parseAutomationMap({
  runnerProfiles: [{
    id: "backend-jest-e2e",
    runner: "jest-e2e",
    workingDirectory: "backend",
    config: "test/jest-e2e.json",
  }],
})).not.toThrow();
```

Run:

```powershell
npx vitest run tests/unit/test-agent/automation-map.test.ts tests/unit/playwright-runner/schemas.test.ts
```

Expected: new assertions fail before implementation.

- [x] **Step 2: Add exact types**

```ts
export interface RunnerProfile {
  id: string;
  runner: NativeRunner;
  workingDirectory: string;
  config?: string;
  envAllowlist?: string[];
}

export interface ProjectCoverageTest {
  id: string;
  title: string;
  relativePath: string;
  runner: NativeRunner;
  executionProfileId: string;
  executable: boolean;
  risk: "read-only" | "mutating";
  origin: "manual" | "generated";
  confidence: "high" | "medium" | "low";
  matchedBy: MatchMethod[];
}
```

- [x] **Step 3: Add strict validation and referential integrity**

Validate profile IDs, contained working directories/config paths, runner/profile agreement, unique IDs, and environment variable names with `/^[A-Z][A-Z0-9_]*$/`.

- [x] **Step 4: Configure ProjectSTS profiles**

Add profiles for `frontend-playwright`, `frontend-node`, `backend-jest`, and `backend-jest-e2e`. Associate every scan root with one profile ID. Do not add command strings.

- [x] **Step 5: Verify Task 1**

Run the focused tests, `npm run typecheck`, and `npm run test-agent:build`. Expected: all exit 0.

---

### Task 2: Publish Source and Stable IDs for Every Runner

**Files:**
- Modify: `agent/src/project-test-discovery.ts`
- Modify: `agent/src/playwright-catalog.ts`
- Modify: `agent/src/redact.ts`
- Modify: `src/app/api/playwright-runner/source/route.ts`
- Test: `tests/unit/test-agent/project-test-discovery.test.ts`
- Test: `tests/unit/test-agent/playwright-runner.test.ts`
- Test: `tests/unit/playwright-runner/source-route.test.ts`

**Interfaces:**
- Consumes `RunnerProfile` from Task 1.
- Produces catalog `sourceByPath` for every runner and stable ID-to-source resolution.

- [x] **Step 1: Write failing multi-runner source tests**

Create one fixture per runner. Assert all have relative paths, stable IDs, bounded redacted source, and a valid execution profile.

- [x] **Step 2: Return source from discovery without exposing paths**

Change discovery to return:

```ts
export interface ProjectDiscoveryResult {
  tests: DiscoveredProjectTest[];
  sourceByPath: Record<string, string>;
}
```

Read at most 200,000 bytes and run `redactText` before catalog publication.

- [x] **Step 3: Make the source route runner-neutral**

Resolve `testId` from both canonical Playwright tests and coverage groups. Return `{ testId, runner, relativePath, content }`. Return 404 for stale IDs and never accept a path query parameter.

- [x] **Step 4: Verify Task 2**

Run focused tests and assert a real ProjectSTS catalog contains source for Playwright, Node, Jest, and Jest E2E without an absolute path.

---

### Task 3: Build Native Runner Command Plans Inside the Agent

**Files:**
- Create: `agent/src/native-runner-plan.ts`
- Create: `agent/src/native-runner-executor.ts`
- Modify: `agent/src/playwright-executor.ts`
- Test: `tests/unit/test-agent/native-runner-plan.test.ts`
- Test: `tests/unit/test-agent/native-runner-executor.test.ts`

**Interfaces:**
- Produces `buildNativeExecutionPlan(config, projectId, selectedTests): NativeExecutionGroup[]`.
- Produces `runNativeExecutionGroup(group, callbacks, signal): Promise<NativeGroupResult>`.

- [x] **Step 1: Write failing command-plan tests**

Assert exact generated commands and reject stale IDs, mismatched runner profiles, path escapes, symlinks, and browser-supplied command-like fields.

```ts
export interface NativeExecutionGroup {
  runner: NativeRunner;
  command: string;
  args: string[];
  cwd: string;
  testIds: string[];
  relativePaths: string[];
}
```

- [x] **Step 2: Implement fixed runner builders**

Use these fixed forms only:

```ts
const builders = {
  "node-test": (files: string[]) => ["node", ["--test", ...files]],
  jest: (files: string[]) => ["npx", ["jest", "--runInBand", ...files]],
  "jest-e2e": (config: string, files: string[]) =>
    ["npx", ["jest", "--config", config, "--runInBand", ...files]],
};
```

Resolve all paths inside the workspace and derive Windows `.cmd` executables through `resolveExecutable`.

- [x] **Step 3: Implement streaming and cancellation**

Reuse `spawnProcessCommand`, `terminateProcessTree`, redaction, timeout, and AbortSignal behavior. Prefix lines with `[JEST]`, `[JEST-E2E]`, or `[NODE]`.

- [x] **Step 4: Verify Task 3**

Run focused tests on Windows-compatible command plans. Expected: no command or cwd originates from request data.

---

### Task 4: Extend Jobs to Sequential Mixed-Runner Execution

**Files:**
- Modify: `agent/src/types.ts`
- Modify: `agent/src/runner.ts`
- Modify: `src/lib/playwright-runner/types.ts`
- Modify: `src/lib/playwright-runner/schemas.ts`
- Modify: `src/lib/playwright-runner/job-store.ts`
- Modify: `src/lib/playwright-runner/job-store-logic.ts`
- Modify: `src/app/api/playwright-runner/jobs/route.ts`
- Test: `tests/integration/playwright-runner-e2e-flow.test.ts`

**Interfaces:**
- Extends project-test jobs with `runnerResults: NativeGroupResult[]`.
- Browser continues to submit only `testIds`, browsers, and mode.

- [x] **Step 1: Add a failing mixed-runner lifecycle test**

Submit Playwright, Node, Jest, and Jest E2E IDs. Assert one job, four ordered groups, tagged logs, fail-fast behavior, cancellation, and final aggregate status.

- [x] **Step 2: Add result contracts**

```ts
export interface NativeGroupResult {
  runner: NativeRunner;
  status: "passed" | "failed" | "cancelled" | "timed_out";
  testIds: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode?: number;
}
```

- [x] **Step 3: Partition and run sequentially**

Resolve a fresh catalog when the Agent claims the job. Partition by fixed runner order and stop after the first non-passing group. Drain logs before completing the job.

- [x] **Step 4: Verify queue and lease behavior**

Test that one active job retains the existing Agent lease, heartbeat renews during every group, and cancellation kills only the active process before finalizing the job.

---

### Task 5: Make Test Explorer and Code Workspace Multi-Runner Aware

**Files:**
- Modify: `src/components/playwright-runner/explorer/TestExplorer.tsx`
- Modify: `src/components/playwright-runner/project/ProjectSelector.tsx`
- Modify: `src/components/playwright-runner/editor/CodeWorkspace.tsx`
- Modify: `src/components/playwright-runner/execution/ExecutionToolbar.tsx`
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Test: `tests/unit/playwright-runner/TestExplorer.test.tsx`
- Test: `tests/unit/playwright-runner/usePlaywrightRunner.test.tsx`

**Interfaces:**
- Consumes runner-neutral source and mixed-runner jobs.
- Produces selection, source viewing, grouped counts, and runner-tagged run summary.

- [x] **Step 1: Write failing component tests**

Assert that every `executable=true` row has a checkbox, clicking any row loads source, Select All selects only executable rows, project switching clears selection, and summary distinguishes runnable from coverage-only files.

- [x] **Step 2: Enable native checkboxes and badge UI**

Replace the Playwright-only condition with `const runnable = test.executable !== false;`. Keep runner badges visible (`[Playwright]`, `[Jest]`, `[Jest E2E]`, `[Node]`), risk badges (`[Mutating]`, `[Read-only]`), and filter chips.

- [x] **Step 3: Load all source types**

Allow loading source for every runner row click into editor.

- [x] **Step 4: Keep terminal logs unified**

Stream stdout/stderr for every runner into the single live terminal with prefix tags without changing existing terminal components.

- [x] **Step 5: Verify Task 5**

Run component tests. Expected: all pass.

---

### Task 6: Define Recipes, Actions, Reusable Flows, and Deterministic Rendering

**Files:**
- Create: `src/lib/playwright-runner/recipe-types.ts`
- Create: `src/lib/playwright-runner/recipe-schema.ts`
- Create: `src/lib/playwright-runner/recipe-renderer.ts`
- Modify: `agent/src/automation-map.ts`
- Modify: `agent/src/types.ts`
- Test: `tests/unit/playwright-runner/recipe-schema.test.ts`
- Test: `tests/unit/playwright-runner/recipe-renderer.test.ts`

**Interfaces:**
- Produces `AutomationRecipeV2`, `ReusableFlow`, `RecipeAction`, `renderRecipe(recipe, flows): string`.

- [x] **Step 1: Write failing schema and renderer tests**

Cover every action/locator type, missing flow, recursive flow, invalid secret name, mutating recipe without cleanup, deterministic output, and escaping of user-visible strings.

- [x] **Step 2: Add exact recipe types**

```ts
export type RecipeLocator =
  | { kind: "role"; role: "button" | "link" | "textbox" | "heading" | "checkbox" | "combobox" | "option" | "radio"; name?: string; exact?: boolean }
  | { kind: "label"; text: string; exact?: boolean }
  | { kind: "text"; text: string; exact?: boolean }
  | { kind: "test-id"; id: string };

export type RecipeAction =
  | { kind: "goto"; url: string }
  | { kind: "fill"; target: RecipeLocator; value: string; isSecretEnv?: boolean }
  | { kind: "click"; target: RecipeLocator }
  | { kind: "select"; target: RecipeLocator; value: string }
  | { kind: "expect-visible"; target: RecipeLocator; timeoutMs?: number }
  | { kind: "expect-url"; url: string; matchType?: "exact" | "contains" }
  | { kind: "expect-text"; target: RecipeLocator; text: string }
  | { kind: "use-flow"; flowId: string };
```

- [x] **Step 3: Render deterministic Playwright code**

Emit a safe `requireTestEnv(name)` helper, expand flows once, reject cycles, include recipe/source metadata comments, and never embed environment values.

- [x] **Step 4: Upgrade ProjectSTS map**

Add schema version 2, reusable flows, recipe risk, actions, cleanup actions, generated output, and production-host denylist. Include `Login as UAT user` using only environment references.

---

### Task 7: Build the Recipe Builder UI

**Files:**
- Create: `src/components/playwright-runner/recipe/RecipeBuilder.tsx`
- Create: `src/components/playwright-runner/recipe/ActionEditor.tsx`
- Create: `src/components/playwright-runner/recipe/LocatorEditor.tsx`
- Create: `src/components/playwright-runner/recipe/FlowSelector.tsx`
- Modify: `src/components/playwright-runner/editor/CodeWorkspace.tsx`
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Test: `tests/unit/playwright-runner/RecipeBuilder.test.tsx`

**Interfaces:**
- Consumes source metadata, recipe schema, catalog flows, and renderer.
- Produces a validated draft and rendered Code Workspace source.

- [x] **Step 1: Write failing builder interaction tests**

Test source-to-draft transition, action add/remove/reorder, locator forms, environment-name selection, reusable flow selection, validation messages, cleanup enforcement, and live deterministic code updates.

- [x] **Step 2: Implement explicit draft creation**

The source view stays unchanged until `Create Playwright Draft` is clicked. Initialize metadata from the selected row but initialize no guessed actions.

- [x] **Step 3: Implement structured editors**

Do not provide CSS/XPath or raw JavaScript fields. Populate environment choices from catalog allowlist names only.

- [x] **Step 4: Connect draft Run**

Submit rendered code through workspace execution with `draftHash = SHA-256(renderedCode)`. Disable Run while schema errors exist.

---

### Task 8: Add Optimistic Agent Mutation Queue

**Files:**
- Create: `src/lib/playwright-runner/mutation-store.ts`
- Create: `src/app/api/playwright-runner/mutations/route.ts`
- Create: `src/app/api/playwright-runner/mutations/[mutationId]/route.ts`
- Create: `src/app/api/playwright-runner/agent/mutations/poll/route.ts`
- Create: `src/app/api/playwright-runner/agent/mutations/[mutationId]/complete/route.ts`
- Modify: `agent/src/client.ts`
- Modify: `agent/src/runner.ts`
- Test: `tests/integration/playwright-runner-mutation-flow.test.ts`

**Interfaces:**
- Produces `RecipeSaveMutation` lifecycle: queued, claimed, succeeded, conflict, rejected, failed.
- Requires Execution Lock for browser creation and Agent token for claim/completion.

- [x] **Step 1: Write a failing mutation lifecycle test**

Assert authentication, one active mutation per Agent, claim lease, stale revision conflict, idempotency, expiry, cancellation, and sanitized errors.

- [x] **Step 2: Add mutation request schema**

```ts
export interface RecipeSaveMutationRequest {
  projectId: string;
  baseRevision: string;
  recipe: AutomationRecipeV2;
  verifiedJobId?: string;
  renderedCodeHash?: string;
}
```

Reject paths, commands, raw environment values, and unexpected fields with strict Zod schemas.

- [x] **Step 3: Add Redis keys and bounded leases**

Use the existing runner Redis client, 24-hour result TTL, 60-second claim lease, and idempotency key. Keep the execution queue and mutation queue separate.

- [x] **Step 4: Poll mutations without creating a busy loop**

Claim at most one mutation during the existing Agent poll cycle. Do not add browser polling faster than the existing active-job interval.

---

### Task 9: Validate and Atomically Save Recipes and Generated Tests

**Files:**
- Create: `agent/src/recipe-mutator.ts`
- Create: `agent/src/recipe-renderer.ts`
- Modify: `agent/src/automation-map.ts`
- Test: `tests/unit/test-agent/recipe-mutator.test.ts`

**Interfaces:**
- Produces `executeRecipeMutation(config, mutation): Promise<MutationExecutionResult>`.

- [x] **Step 1: Write failing filesystem safety tests**

Cover revision conflict, manual-file collision, generated-header mismatch, symlink, path escape, missing passing job, code-hash mismatch, failed `playwright --list`, rollback, and successful atomic replacement.

- [x] **Step 2: Validate the revision and passing draft**

Hash the raw current map with SHA-256 and compare with `baseRevision`. For generated saves, query the server-provided verified job metadata and require `status="passed"` plus matching code hash.

- [x] **Step 3: Render and validate locally**

Render from the recipe rather than accepting browser code. Run `playwright test --list` on the generated spec to ensure compilation passes before updating map.

- [x] **Step 4: Perform recoverable replacement**

Write map and generated spec safely. Restore both originals on any failure.

- [x] **Step 5: Refresh catalog once**

Invalidate the Agent catalog fingerprint after success and publish the new generated row on the next existing poll cycle.

---

### Task 10: Enforce Mutating-Test Safety and Cleanup

**Files:**
- Create: `agent/src/test-target-policy.ts`
- Modify: `agent/src/recipe-mutator.ts`
- Modify: `src/components/playwright-runner/recipe/RecipeBuilder.tsx`
- Test: `tests/unit/test-agent/test-target-policy.test.ts`
- Test: `tests/integration/playwright-mutating-safety.test.ts`

**Interfaces:**
- Produces `assertSafeTestTarget(baseUrl, risk, productionHosts): void`.

- [x] **Step 1: Write failing host-policy tests**

Reject exact production hosts, subdomains, invalid URLs, localhost aliases configured as production, and missing cleanup. Permit configured UAT hosts.

- [x] **Step 2: Enforce policy in the Agent**

Read `STS_UAT_BASE_URL` only inside the Agent. Parse with `URL`, compare normalized hostname against denylist, and return redacted errors without returning the URL.

- [x] **Step 3: Add deterministic run data and cleanup**

Execute cleanup in `test.afterEach` or `try/finally` block so it runs after failed assertions.

- [x] **Step 4: Add UI confirmation**

Show risk, target environment label, cleanup summary, and require explicit confirmation immediately before submitting a mutating draft.

---

### Task 11: Production Verification and Team Status

**Files:**
- Modify: `tests/integration/playwright-runner-e2e-flow.test.ts`
- Create: `e2e/multi-runner-recipe-builder.spec.ts`
- Modify: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Consumes every previous task.
- Produces release evidence and remaining production gates.

- [x] **Step 1: Run the full automated gate**

```powershell
npm run typecheck
npm run lint
npm test
npm run test-agent:build
npm run build
```

Expected: every command exits 0 (Verified: 88 Vitest test files / 359 tests passed, 0 lint/typecheck errors, Next.js build 26/26 routes).

- [ ] **Step 2: Verify real ProjectSTS native runners**

Start exactly one rebuilt Local Agent. Select one Playwright, Node, Jest, and Jest E2E file. Assert sequential tagged Terminal output, final per-runner results, and no absolute paths or secrets.

- [ ] **Step 3: Verify the browser draft path**

Open a Jest source, create a read-only Playwright draft using `Login as UAT user`, run it, and verify Code Workspace and Terminal behavior without writing ProjectSTS.

- [ ] **Step 4: Verify saving and refresh**

Save a passing fixture recipe, confirm revision handling and `playwright --list`, then confirm the generated row appears with a checkbox after one catalog refresh. Verify all manual-file hashes remain unchanged.

- [ ] **Step 5: Verify mutating protection**

Confirm production host rejection, UAT confirmation, `UAT-${runId}` data, and cleanup execution after both passing and failing assertions.

- [ ] **Step 6: Update status from evidence**

Record test results, gate completion, real smoke-test status, and release readiness in `STATUS.md`.

## Release Gates

### Gate A: Native Multi-Runner

- All discovered executable tests have checkboxes.
- Every source opens in Code Workspace.
- Mixed runner selections execute sequentially and stream tagged logs.
- No browser request contains command, cwd, path, or environment values.

### Gate B: Recipe Builder and Safe Save

- Structured recipes render deterministically.
- Reusable login flow uses environment references only.
- Drafts run without writing ProjectSTS.
- Only an exact passing draft can be saved.
- Revision conflicts and `playwright --list` failures make no filesystem changes.
- Mutating tests reject production and execute cleanup.

## Self-Review Result

- Spec coverage: native execution, source loading, structured browser drafts, reusable flows, secrets, concurrency, generated-file safety, mutating protection, cleanup, realtime logs, and production verification each map to a task.
- Placeholder scan: no TBD, TODO, guessed selector, raw-command extension, or undefined implementation step remains.
- Type consistency: runner, profile, recipe, action, mutation, job, and result names are defined before use.
- Scope control: Gate A is independently releasable before Gate B; no AI source translation, CSS/XPath, parallel mixed-runner execution, or arbitrary shell support is included.

