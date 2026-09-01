# Multi-scenario Playwright function generation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, review, execute, and safely save multiple evidence-backed Playwright browser scenarios for each mapped ProjectSTS Sheet/UAT function.

**Architecture:** Extend the existing Source-Assisted Draft and Recipe Builder path. The Local Agent owns all filesystem traversal and returns only safe relative evidence; the web app stores and renders typed scenario bundles, while the existing mutation lease and transaction flow performs atomic generated-file updates.

**Tech Stack:** Next.js, React, TypeScript, Zod, Node.js Local Agent, Playwright, Vitest, Testing Library, Upstash Redis.

## Global Constraints

- Never expose absolute paths, raw filesystem paths from the client, source text, secrets, or environment values.
- Resolve every project and file through the Agent project allowlist and path-containment checks.
- Scan depth is 3, maximum files is 40, and maximum source text is 1 MiB per request.
- Return no more than 10 evidence-backed scenarios per function.
- Block scenarios without stable locators and show `ต้องกำหนด Locator`.
- Run selected scenarios sequentially with one worker in the first release.
- Never overwrite manual Playwright files or modify ProjectSTS application source.
- Save only scenarios that passed against the current evidence hash.
- Git operations are manual and must not be performed by the implementation agent.

---

## File structure

- Create `agent/src/function-evidence-scanner.ts`: bounded dependency graph and safe evidence summaries.
- Create `agent/src/function-scenario-analyzer.ts`: candidate derivation, ranking, deduplication, locator blocking, and evidence hash.
- Create `src/components/playwright-runner/recipe/ScenarioReviewList.tsx`: multi-scenario selection and evidence review.
- Modify `agent/src/source-analyzer.ts`: expose reusable single-file analysis primitives without filesystem traversal.
- Modify `agent/src/playwright-recipe-generator.ts`: render one function spec containing multiple scenarios.
- Modify `agent/src/recipe-mutator.ts`: merge verified scenarios into a generated function spec.
- Modify `src/lib/playwright-runner/recipe-types.ts`: scenario bundle and save contracts.
- Modify `src/lib/playwright-runner/schemas.ts` and `agent/src/types.ts`: matching Zod and Agent transport contracts.
- Modify `src/components/playwright-runner/recipe/RecipeBuilder.tsx`: orchestrate scenario review and combined preview.
- Modify `src/components/playwright-runner/usePlaywrightRunner.ts`: scan, sequential run, result tracking, stale detection, and save eligibility.
- Modify `src/components/playwright-runner/explorer/TestExplorer.tsx`: function action and lifecycle statuses.
- Modify `src/components/playwright-runner/editor/CodeWorkspace.tsx`: scenario-aware generated preview.
- Modify existing browser and Agent routes under `src/app/api/playwright-runner/`: carry safe bundle, selected IDs, evidence hash, and per-scenario results through the existing authenticated queue.

### Task 1: Define scenario bundle contracts

**Files:**
- Modify: `src/lib/playwright-runner/recipe-types.ts`
- Modify: `src/lib/playwright-runner/schemas.ts`
- Modify: `agent/src/types.ts`
- Test: `tests/unit/playwright-runner/recipe-schema.test.ts`
- Test: `tests/unit/playwright-runner/schemas.test.ts`

**Interfaces:**
- Produces: `ScenarioCategory`, `FunctionScenarioStatus`, `ScenarioEvidence`, `FunctionScenarioCandidate`, `FunctionScenarioBundle`, `FunctionScenarioRunResult`.
- Produces: matching Zod schemas with `scenarios.max(10)`, relative-path validation, SHA-256 hex validation, and conditional `LOCATOR_REQUIRED` validation.

- [ ] Add failing schema tests proving a valid ten-scenario bundle parses, an eleventh scenario fails, an absolute path fails, and `blocked_locator` requires `blockReason: "LOCATOR_REQUIRED"`.
- [ ] Run `npm test -- tests/unit/playwright-runner/recipe-schema.test.ts tests/unit/playwright-runner/schemas.test.ts` and confirm the new imports or assertions fail.
- [ ] Add the exact types from the approved design and Zod schemas; export the same property names from browser and Agent modules.
- [ ] Run the two test files again and confirm they pass.
- [ ] Run `npm run typecheck` and resolve all contract drift before continuing.

### Task 2: Build the bounded ProjectSTS evidence scanner

**Files:**
- Create: `agent/src/function-evidence-scanner.ts`
- Modify: `agent/src/automation-map.ts`
- Modify: `agent/src/source-analyzer.ts`
- Test: `tests/unit/test-agent/function-evidence-scanner.test.ts`
- Test: `tests/unit/test-agent/source-analyzer.test.ts`

**Interfaces:**
- Consumes: function ID and validated project configuration from the Agent allowlist.
- Produces: `scanFunctionEvidence(input: FunctionEvidenceScanInput): Promise<FunctionEvidenceScanResult>`.
- `FunctionEvidenceScanResult` contains normalized relative roots, safe evidence records, files scanned, truncation flag, and no absolute path or source text.

- [ ] Create a fixture project in the test temporary directory with one mapped page, nested relative components, route handler, matching Jest test, unrelated files, generated output, and an escaping import.
- [ ] Add failing tests for depth 3, 40-file and 1-MiB limits, ignored directories, related-test inclusion, escape rejection, and public output free of drive letters and fixture source contents.
- [ ] Run `npm test -- tests/unit/test-agent/function-evidence-scanner.test.ts tests/unit/test-agent/source-analyzer.test.ts` and confirm failure because the scanner is absent.
- [ ] Implement deterministic breadth-first traversal for relative imports only; normalize paths with `/`, hash file contents with SHA-256, and reuse source-analyzer parsing without adding filesystem access to that pure module.
- [ ] Match existing tests using the automation-map source IDs, mapped paths, function keywords, and route names; do not use a whole-repository fallback.
- [ ] Run the focused tests and `npm run test-agent:build`; confirm both pass.

### Task 3: Derive and rank evidence-backed scenarios

**Files:**
- Create: `agent/src/function-scenario-analyzer.ts`
- Modify: `agent/src/source-analyzer.ts`
- Test: `tests/unit/test-agent/function-scenario-analyzer.test.ts`

**Interfaces:**
- Consumes: `FunctionEvidenceScanResult`, function metadata, and existing recipe steps.
- Produces: `analyzeFunctionScenarios(input: FunctionScenarioAnalysisInput): FunctionScenarioBundle`.

- [ ] Add failing tests covering success, validation, permission, not-found, and error evidence; semantic duplicate removal; risk-then-confidence ordering; ten-item cap; stable IDs; and empty evidence producing a Gap.
- [ ] Add failing tests proving fragile CSS or missing locator evidence produces `blocked_locator` and cannot be promoted to `draft`.
- [ ] Run `npm test -- tests/unit/test-agent/function-scenario-analyzer.test.ts` and confirm the module-not-found failure.
- [ ] Implement category-specific evidence rules. A candidate must cite at least one evidence record, and error/permission scenarios must cite the corresponding branch, status, message, or existing test.
- [ ] Compute `evidenceHash` from normalized evidence hashes, function metadata, and automation-map revision. Do not include timestamps or machine paths.
- [ ] Run the focused test and repeat it once to prove IDs, order, and hash are deterministic.

### Task 4: Render one safe Playwright spec per function

**Files:**
- Modify: `agent/src/playwright-recipe-generator.ts`
- Modify: `src/lib/playwright-runner/recipe-renderer.ts`
- Test: `tests/unit/test-agent/playwright-recipe-generator.test.ts`
- Test: `tests/unit/playwright-runner/recipe-renderer.test.ts`

**Interfaces:**
- Consumes: `FunctionScenarioBundle` plus selected runnable scenario IDs.
- Produces: `renderFunctionScenarioSpec(bundle, selectedScenarioIds): RenderedFunctionSpec` with relative output path, code, scenario IDs, and evidence hash.

- [ ] Add failing golden-string tests for one `test.describe`, multiple stable `test()` cases, shared setup import, scenario metadata, and deterministic file naming.
- [ ] Add failing security tests for path traversal, an unknown scenario ID, blocked locator, and a mutating scenario without cleanup.
- [ ] Run `npm test -- tests/unit/test-agent/playwright-recipe-generator.test.ts tests/unit/playwright-runner/recipe-renderer.test.ts` and confirm failures.
- [ ] Implement renderer output under `<generatedRoot>/<function-id>-<slug>.spec.ts`; preserve manual output protection and render cleanup in `finally` for mutating scenarios.
- [ ] Run the focused tests and `npm run typecheck`; confirm both pass.

### Task 5: Add Agent scan and atomic save lifecycle

**Files:**
- Modify: `src/app/api/playwright-runner/agent/mutations/poll/route.ts`
- Modify: `src/app/api/playwright-runner/agent/mutations/[mutationId]/complete/route.ts`
- Modify: `src/app/api/playwright-runner/mutations/route.ts`
- Modify: `src/lib/playwright-runner/mutation-store.ts`
- Modify: `agent/src/recipe-mutator.ts`
- Modify: `agent/src/mutation-transaction.ts`
- Test: `tests/integration/playwright-runner-mutation-flow.test.ts`
- Test: `tests/unit/test-agent/recipe-mutator.test.ts`

**Interfaces:**
- Adds mutation operations `analyze_function_scenarios` and `save_verified_scenarios` to the existing owner-safe lease protocol.
- Save consumes function ID, selected scenario IDs, evidence hash, map revision, and verified run IDs. It does not consume a client filesystem path.

- [ ] Add failing integration tests for authenticated scan completion, lease ownership, safe payload shape, stale evidence rejection, and save rejection when a scenario has no passing current-hash result.
- [ ] Add failing mutator tests for atomic merge by stable scenario ID, crash recovery, and refusal to overwrite an unmarked manual file.
- [ ] Run `npm test -- tests/integration/playwright-runner-mutation-flow.test.ts tests/unit/test-agent/recipe-mutator.test.ts` and confirm failures.
- [ ] Extend the existing mutation protocol and transaction journal; resolve output paths exclusively from Agent configuration and regenerate the complete function file before atomic replacement.
- [ ] Publish a refreshed catalog after a successful save and preserve the draft on any failed mutation.
- [ ] Run focused tests and `npm run agent:build`; confirm both pass.

### Task 6: Run selected scenarios sequentially with tagged results

**Files:**
- Modify: `src/lib/playwright-runner/job-store.ts`
- Modify: `src/app/api/playwright-runner/jobs/route.ts`
- Modify: `agent/src/playwright-executor.ts`
- Modify: `agent/src/runner.ts`
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Test: `tests/integration/playwright-runner-e2e-flow.test.ts`
- Test: `tests/unit/test-agent/playwright-runner.test.ts`

**Interfaces:**
- Job request adds `functionId`, `scenarioIds`, `evidenceHash`, and `workers: 1` for bundle runs.
- Job result exposes `scenarioResults: FunctionScenarioRunResult[]` with `scenarioId`, status, duration, and current evidence hash.

- [ ] Add failing tests proving scenario order is preserved, workers remain 1, a failed scenario does not skip later scenarios, and logs begin with `[FN:<functionId>][SCENARIO:<scenarioId>]`.
- [ ] Add failing tests proving cancel stops the active process and marks unstarted scenarios cancelled without reporting them passed.
- [ ] Run the focused integration and Agent tests and confirm failures.
- [ ] Render selected scenarios into the Agent-controlled draft workspace, execute serially, stream tagged stdout/stderr through the existing log batcher, and persist individual results.
- [ ] Gate mutating execution on non-production target, dedicated test-data declaration, cleanup presence, and explicit confirmation.
- [ ] Run focused tests plus `npm run test-agent:build`; confirm all pass.

### Task 7: Add scenario review, preview, and status UI

**Files:**
- Create: `src/components/playwright-runner/recipe/ScenarioReviewList.tsx`
- Modify: `src/components/playwright-runner/recipe/RecipeBuilder.tsx`
- Modify: `src/components/playwright-runner/explorer/TestExplorer.tsx`
- Modify: `src/components/playwright-runner/editor/CodeWorkspace.tsx`
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Modify: `src/components/playwright-runner/usePlaywrightRunner.ts`
- Test: `tests/unit/playwright-runner/RecipeBuilder.test.tsx`
- Test: `tests/components/playwright-runner/TestExplorer.test.tsx`
- Test: `tests/components/playwright-runner/CodeWorkspace.test.tsx`
- Test: `tests/components/playwright-runner/PlaywrightWorkspace.test.tsx`

**Interfaces:**
- Consumes: `FunctionScenarioBundle`, selected scenario IDs, per-scenario run results, and stale state.
- Produces user actions: analyze function, select scenario, inspect evidence, edit recipe steps, run selected, confirm mutating run, and save verified.

- [ ] Add failing component tests for the function-level action, loading/error/Gap states, ten ranked rows, category/risk/confidence labels, evidence disclosure, search, checkbox selection, and blocked locator controls.
- [ ] Add failing tests for combined Code Space preview, sequential progress, per-scenario result badges, stale warning, and Save enabled only for passing current-hash scenarios.
- [ ] Run the four focused component suites and confirm failures.
- [ ] Implement the review list using native buttons, checkboxes, and disclosure controls; preserve the balanced layout and internal scrolling without adding a new page or dependency.
- [ ] Connect Recipe Builder edits to a scenario ID, regenerate preview deterministically, and keep unsaved edits when the Agent disconnects.
- [ ] Refresh Test Explorer after save and show Thai labels for Draft, Verified, Saved, Stale, Gap, and Locator required.
- [ ] Run focused tests, `npm run lint`, and `npm run typecheck`; confirm all pass.

### Task 8: Verify with real ProjectSTS and update operator documentation

**Files:**
- Modify: `e2e/multi-runner-recipe-builder.spec.ts`
- Modify: `docs/playwright-local-agent.md`
- Modify: `docs/superpowers/plans/STATUS.md`
- Test: `e2e/multi-runner-recipe-builder.spec.ts`

**Interfaces:**
- Acceptance uses the configured ProjectSTS allowlist, automation map, non-production test target, and generated output root.

- [ ] Add an authenticated E2E test that selects ProjectSTS, analyzes one Sheet function, sees multiple evidence-backed scenarios, blocks one missing-locator scenario, previews code, runs two selected scenarios sequentially, saves passing scenarios, and observes the refreshed Generated Playwright group.
- [ ] Add an E2E assertion that switching projects clears the previous function bundle and loads the new catalog without leaking paths.
- [ ] Run `npx playwright test e2e/multi-runner-recipe-builder.spec.ts` with the Local Agent online and confirm the acceptance flow passes.
- [ ] Run the complete release gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test-agent:build`, `npm run agent:build`, `npm run build`, and `npx playwright test`.
- [ ] Document scan limits, locator requirements, non-production mutation safeguards, stale recovery, result location, and manual Git/deploy steps in `docs/playwright-local-agent.md`.
- [ ] Update `docs/superpowers/plans/STATUS.md` with exact test counts and mark this feature implemented locally only after every release command passes.

## Completion criteria

- The acceptance flow in the design passes against real ProjectSTS.
- Browser/API payloads contain no absolute paths, source text, tokens, or environment values.
- Existing Jest, Node, service, and Playwright files remain unchanged except for explicitly generated output.
- A generated function file is saved only through an Agent-owned atomic mutation after current-hash verification.
- All release gates pass; Git and deployment remain manual operator actions.

