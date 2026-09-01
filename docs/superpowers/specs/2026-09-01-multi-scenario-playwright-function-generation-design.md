# Multi-scenario Playwright function generation design

## Problem

ProjectSTS has Sheet/UAT function records, source code, and several existing test styles. A function may need more than one browser scenario, but the current draft flow primarily creates one recipe at a time. Users should not have to rewrite each function manually as Playwright code or guess which source files are relevant.

## Goal

From one mapped Sheet/UAT function, scan a bounded set of related ProjectSTS files, propose up to 10 evidence-backed browser scenarios, let the user review and select them, render one Playwright spec, run selected scenarios sequentially, and save only scenarios that passed verification.

## User flow

1. Select ProjectSTS and a function in Test Explorer.
2. Choose `Create browser scenarios`.
3. The Local Agent scans the mapped source entry, bounded relative imports, route/API files, and related existing tests.
4. Recipe Builder displays ranked scenario candidates with category, risk, confidence, evidence summary, and locator readiness.
5. The user selects scenarios and reviews or edits the generated steps.
6. Code Space previews one `test.describe()` for the function containing one `test()` per selected scenario.
7. Run executes selected scenarios sequentially with one browser worker and streams scenario-tagged output.
8. Passing scenarios can be saved atomically under the configured generated output root.
9. Test Explorer refreshes and shows Draft, Verified, Saved, Stale, or Gap state.

## Scope and boundaries

- Begin from a function ID defined in ProjectSTS `test-automation-map.json`.
- Scan only the mapped file, relative imports reachable to depth 3, files associated with the same route/API/component, and existing tests matched to the function.
- Scan at most 40 files and 1 MiB of source text per request.
- Include `.ts`, `.tsx`, `.js`, and `.jsx`; ignore `node_modules`, `.next`, `dist`, coverage output, and generated Playwright output.
- Keep Jest, Node, service, and existing Playwright tests unchanged. They are evidence, not migration targets.
- Do not edit ProjectSTS application source to manufacture selectors.
- Do not send absolute paths, source text, credentials, or environment values to the frontend. Public evidence contains relative path, kind, summary, and content hash only.
- Never overwrite a manually maintained Playwright file.

## Scenario rules

- Generate only scenarios supported by Sheet/UAT metadata, source branches, routes, UI controls, validation logic, or existing tests.
- Categories are `success`, `validation`, `permission`, `not-found`, `error`, and `custom`.
- Rank candidates by risk and confidence, remove semantic duplicates, and return at most 10.
- A scenario without a stable role, label, test ID, placeholder, or exact accessible text is marked `blocked_locator` with the message `ต้องกำหนด Locator`. It cannot run or save.
- Mutating scenarios require a non-production target, dedicated test data, cleanup in `finally`, and explicit confirmation before execution.
- Initial execution is sequential in one job with one Playwright worker to keep results deterministic and avoid test-data collisions.

## Data contracts

```ts
type ScenarioCategory =
  | "success"
  | "validation"
  | "permission"
  | "not-found"
  | "error"
  | "custom";

type FunctionScenarioStatus =
  | "draft"
  | "blocked_locator"
  | "verified"
  | "saved"
  | "stale"
  | "gap";

interface ScenarioEvidence {
  relativePath: string;
  kind: "sheet" | "source" | "route" | "component" | "existing-test";
  summary: string;
  contentHash: string;
}

interface FunctionScenarioCandidate {
  id: string;
  functionId: string;
  title: string;
  category: ScenarioCategory;
  status: FunctionScenarioStatus;
  risk: "read-only" | "mutating";
  confidence: "high" | "medium" | "low";
  evidence: ScenarioEvidence[];
  actions: RecipeStep[];
  evidenceHash: string;
  blockReason?: "LOCATOR_REQUIRED";
}

interface FunctionScenarioBundle {
  functionId: string;
  functionName: string;
  evidenceHash: string;
  scannedAt: string;
  scanSummary: {
    relativeRoots: string[];
    filesScanned: number;
    truncated: boolean;
  };
  scenarios: FunctionScenarioCandidate[];
}
```

The evidence hash is SHA-256 over normalized relative paths, their content hashes, the automation-map revision, and normalized Sheet/UAT metadata. A changed hash marks an existing draft or saved scenario `stale`; the system never replaces it automatically.

## Generated file contract

- Output path: `<generatedRoot>/<function-id>-<function-slug>.spec.ts`.
- One file per function.
- One `test.describe()` per function and one stable scenario ID per `test()`.
- Shared login and setup use imported fixtures or helpers instead of duplicated steps.
- Generated metadata records function ID, scenario IDs, evidence hash, and generator version.
- Saving merges verified scenarios by stable scenario ID through the existing atomic mutation transaction. A stale base revision or evidence hash rejects the save.

## Failure and recovery behavior

- If no relevant files are found, return a Gap with the relative roots scanned.
- If a scan reaches a limit, return available candidates with `scanSummary.truncated=true`; do not silently broaden scope.
- If the Agent disconnects, preserve the draft in the browser and disable Run/Save until a fresh catalog and evidence scan are available.
- If one selected scenario fails, continue the remaining sequential scenarios and report each result separately.
- Only scenarios with a passing result for the current evidence hash are eligible for Save.

## Acceptance criteria

```text
เลือก ProjectSTS และฟังก์ชันจาก Sheet
→ Agent สแกน source/test ที่เกี่ยวข้องภายในขอบเขต
→ แสดง scenario ที่มีหลักฐานและแบ่งประเภท
→ เลือก scenario ได้และ Code Space แสดง Playwright code
→ scenario ที่ locator ไม่พร้อมถูกบล็อกพร้อมเหตุผล
→ Run แบบเรียงลำดับและ Terminal ระบุ function/scenario
→ Save ได้เฉพาะ scenario ที่ผ่านกับ evidence hash ปัจจุบัน
→ Test Explorer refresh และแสดงสถานะล่าสุด
```

