# Recipe Mutation Production Safety Fixes Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a review checkpoint after every task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Recipe Builder release blockers by resolving relative URLs against an Agent-owned test target, making mutation leases recoverable and owner-safe, and making recipe/map replacement recoverable after process interruption.

**Architecture:** The Local Agent configuration is the source of truth for the test target; browser payloads continue to contain recipe IDs and relative actions only. Redis stores a durable claimed-mutation index separately from the short active lease, and all lease transitions use an owner token. Filesystem replacement uses staged files, backups, and a transaction journal that can be recovered on the next Agent start.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vitest, Playwright, Upstash Redis, Windows Local Agent.

## Global Constraints

- Do not run Git commands; the user handles Git operations manually.
- Never accept a target host, command, cwd, absolute path, or environment value from the browser.
- Never expose absolute ProjectSTS paths or secrets through catalog, API, Redis, UI, or logs.
- Mutating recipes require cleanup actions and an Agent-configured target with `allowMutating: true`.
- Every relative `goto` must be resolved against the trusted target before production-denylist validation.
- At most one mutation may be owned by an Agent at a time.
- A late completion must never clear another mutation's lease.
- Manual ProjectSTS files must never be overwritten or deleted.
- Generated files must remain under `frontend/e2e/generated`.

---

### Task 1: Add an Agent-Owned Test Target Contract

**Files:**
- Modify: `agent/src/types.ts`
- Modify: `agent/src/config.ts`
- Modify: `agent/src/automation-map.ts`
- Modify: `agent/src/playwright-catalog.ts`
- Modify: `src/lib/playwright-runner/types.ts`
- Modify: `src/lib/playwright-runner/schemas.ts`
- Modify: `E:\ProjectSTS\test-automation-map.json`
- Test: `tests/unit/test-agent/automation-map.test.ts`
- Test: `tests/unit/playwright-runner/schemas.test.ts`

**Interfaces:**
- Produces `TestTargetConfig { id: string; label: string; baseUrl: string; allowMutating: boolean }`.
- Catalog exposes only `id`, `label`, and `allowMutating`; it does not expose `baseUrl`.
- Recipe execution always selects the single Agent-configured target for the project. Browser requests cannot override it.

- [x] **Step 1: Add failing schema tests**
- [x] **Step 2: Implement and validate the target contract**
- [x] **Step 3: Publish safe target metadata**
- [x] **Step 4: Configure ProjectSTS UAT and run tests**

---

### Task 2: Enforce the Resolved Target for Draft Run and Save

**Files:**
- Modify: `agent/src/test-target-policy.ts`
- Modify: `agent/src/recipe-mutator.ts`
- Modify: `agent/src/runner.ts`
- Modify: `src/components/playwright-runner/recipe/RecipeBuilder.tsx`
- Test: `tests/unit/test-agent/test-target-policy.test.ts`
- Test: `tests/unit/test-agent/recipe-mutator.test.ts`
- Test: `tests/integration/playwright-mutating-safety.test.ts`

**Interfaces:**
- Produces `resolveAndAssertSafeTestTarget(actionUrl, target, risk, denylist): URL`.
- The same policy is called before workspace draft execution and before generated-file mutation.

- [x] **Step 1: Add failing relative-URL tests**
- [x] **Step 2: Implement canonical URL resolution**
- [x] **Step 3: Use one policy in both execution paths**
- [x] **Step 4: Show the selected environment in Recipe Builder**
- [x] **Step 5: Run the safety gate**

---

### Task 3: Make Mutation Leases Owner-Safe and Recoverable

**Files:**
- Modify: `src/lib/playwright-runner/mutation-store.ts`
- Modify: `src/app/api/playwright-runner/agent/mutations/poll/route.ts`
- Modify: `src/app/api/playwright-runner/agent/mutations/[mutationId]/complete/route.ts`
- Modify: `agent/src/types.ts`
- Modify: `agent/src/client.ts`
- Test: `tests/integration/playwright-runner-mutation-flow.test.ts`

**Interfaces:**
- Claimed mutation adds `leaseToken`, `claimedAt`, and `leaseExpiresAt`.
- Redis adds `monitor:playwright:v1:mutation-claimed:<agentId>` as a durable sorted set whose score is lease expiry epoch milliseconds.
- Completion requires `{ mutationId, leaseToken, result }`.

- [x] **Step 1: Add failing lease tests**
- [x] **Step 2: Add durable claimed indexing**
- [x] **Step 3: Reap expired claims independently of activeKey**
- [x] **Step 4: Make completion compare-and-delete atomic**
- [x] **Step 5: Run concurrency and API tests**

---

### Task 4: Add Recoverable Two-File Replacement

**Files:**
- Modify: `agent/src/recipe-mutator.ts`
- Create: `agent/src/mutation-transaction.ts`
- Modify: `agent/src/runner.ts`
- Test: `tests/unit/test-agent/recipe-mutator.test.ts`
- Create: `tests/unit/test-agent/mutation-transaction.test.ts`

**Interfaces:**
- Produces `recoverRecipeTransactions(workspaceRoot): Promise<void>`.
- Journal phases are `prepared`, `spec-replaced`, `map-replaced`, and `committed`.
- Journal contains only contained relative paths and content hashes, never secrets or absolute paths.

- [x] **Step 1: Add failure-injection tests**
- [x] **Step 2: Implement staged replacement and journal phases**
- [x] **Step 3: Recover before accepting work**
- [x] **Step 4: Run filesystem tests on Windows**

---

### Task 5: Release Verification and Status Correction

**Files:**
- Modify: `docs/superpowers/plans/STATUS.md`
- Modify: `docs/superpowers/plans/2026-08-30-multi-runner-recipe-builder.md`
- Test: `tests/integration/playwright-runner-mutation-flow.test.ts`
- Test: `tests/integration/playwright-mutating-safety.test.ts`

**Interfaces:**
- Gate B may be marked complete only after automated gates and one live ProjectSTS save pass.

- [x] **Step 1: Run the complete automated gate**
- [x] **Step 2: Run the live ProjectSTS acceptance path**
- [x] **Step 3: Exercise lease failure manually**
- [x] **Step 4: Update status from observed evidence**

## Release Gates

### Gate 1: Target Safety

- Relative and absolute URLs resolve against an Agent-owned target.
- Mutating execution is impossible against a production-denylisted target.
- Browser payloads cannot select or override the target host.

### Gate 2: Mutation Ownership

- One Agent owns at most one mutation.
- Expired claims are discoverable after the active key expires.
- Late completion cannot alter a replacement lease.

### Gate 3: Filesystem Consistency

- Interrupted writes recover to one consistent recipe/map revision.
- Manual files remain untouched.
- Generated output remains inside the configured generated root.

### Gate 4: Production Acceptance

- Full automated gate passes.
- Live ProjectSTS run and save passes with realtime logs.
- `STATUS.md` matches observed evidence.

