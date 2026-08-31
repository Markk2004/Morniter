# Source-Assisted Playwright Draft Import Design

## Status

Approved in conversation on 2026-08-31. Git operations remain user-managed.

## Goal

Import existing Playwright tests directly into Test Explorer and let a user create one reviewed Playwright browser draft at a time from a selected ProjectSTS Sheet, Jest, Jest E2E, or Node coverage item. A verified draft can be saved under `frontend/e2e/generated` and then reappear as an executable Generated Playwright test.

## Product Decisions

- Existing files that import `@playwright/test` are discovered and shown as Playwright without conversion.
- A non-Playwright row exposes `Create Playwright Draft` only when its catalog metadata identifies a contained source item and Sheet function.
- Draft generation is user-triggered for one selected row at a time. Catalog refresh never creates files.
- Source analysis may propose routes, locators, actions, assertions, and reusable flows. Every proposal remains editable in Recipe Builder.
- Generated code is not trusted merely because it compiles. The user must review it and run the exact draft successfully before saving.
- Verified generated specs are stored under `ProjectSTS/frontend/e2e/generated`.
- The Agent refreshes the catalog after a successful save so the generated file appears in Test Explorer automatically.
- The feature extends the existing Recipe Builder contract. It does not add arbitrary commands, raw paths, or unrestricted source access.

## Supported Inputs

The selected catalog item may be:

- a Sheet function coverage reference;
- a frontend Node test;
- a backend Jest test;
- a backend Jest E2E test; or
- an existing Playwright test.

Existing Playwright tests open as source and remain directly runnable. They do not show a conversion action by default. Other supported inputs may seed a browser draft when the Agent can resolve the item through the current project catalog and automation map.

## Architecture

### Catalog Classification

The Local Agent classifies files using validated source content and runner configuration. A file belongs to Playwright only when it imports `@playwright/test` and is inside an executable Playwright scan root. File extensions or names alone are insufficient.

Catalog rows continue to expose stable IDs, relative paths, runner, Sheet function metadata, risk, and executable state. No absolute path is published to the server or browser.

### Source-Assisted Analysis

When the user selects `Create Playwright Draft`, the browser submits only project ID, catalog item ID, and current automation-map revision. The Local Agent resolves the ID and reads only allowlisted, contained project files.

The analyzer returns bounded recipe suggestions rather than arbitrary generated source. It may derive:

- route candidates from test names, route constants, router calls, and automation-map metadata;
- locator candidates from accessible roles, labels, visible text, and `data-testid` values;
- action candidates from existing test setup and UI interaction helpers;
- assertion candidates from existing expectations and Sheet expected results;
- reusable-flow references such as `Login as UAT user`;
- confidence and evidence for every suggested step.

The analyzer must not execute source code, import application modules, crawl outside configured roots, infer secret values, or emit CSS/XPath selectors in the first release. When evidence is insufficient, it creates an incomplete recipe with explicit fields requiring review instead of inventing a runnable step.

### Recipe Review

Recipe Builder displays each suggestion with its source reason and confidence. The user may accept, edit, reorder, or delete actions. The deterministic renderer remains the only component that produces Playwright TypeScript for Code Workspace.

Validation blocks Draft Run when required route, locator, assertion, environment reference, or cleanup data is missing. The generated code contains environment variable names only; values stay in the Local Agent environment.

### Verification and Import

Draft Run uses the existing isolated workspace-code execution path. The job records the rendered-code hash and recipe revision. `Save as Automated Test` is enabled only after that exact hash passes.

The save mutation follows the existing Agent queue and performs these checks:

1. validate Execution Lock and optimistic map revision;
2. verify the successful Draft Run hash;
3. render the recipe again deterministically;
4. derive a contained filename from Sheet function ID and recipe ID;
5. reject collisions with manual files or mismatched generated headers;
6. run Playwright `--list` against the candidate;
7. atomically write the recipe metadata and generated spec;
8. publish a refreshed catalog.

The output stays under `frontend/e2e/generated`. The browser receives only its relative path and new catalog test ID.

## User Interface Flow

```text
Select ProjectSTS
→ select one Sheet/Jest/Node coverage item
→ Create Playwright Draft
→ review suggested Recipe actions and evidence
→ generated Playwright code appears in Code Workspace
→ resolve incomplete fields and validation errors
→ Run Draft
→ inspect realtime Terminal output
→ passing exact revision enables Save as Automated Test
→ save to frontend/e2e/generated
→ refresh catalog
→ new row appears in Generated Playwright and can be selected for Run
```

Existing Playwright rows skip draft generation and remain selectable immediately.

## Safety and Failure Handling

- The browser sends catalog IDs, never commands or filesystem paths.
- Agent resolution uses the current project allowlist, path containment, and symlink rejection.
- Source excerpts and analysis evidence are bounded and redacted.
- Unsupported or ambiguous code produces review-required fields, not guessed executable steps.
- Mutating drafts require cleanup actions, generated UAT data, explicit confirmation, and a non-production target.
- A stale catalog ID or automation-map revision returns a conflict and does not write files.
- Failed Draft Run, failed cleanup, failed `--list`, Agent disconnect, or filename collision leaves ProjectSTS unchanged.
- Manual Playwright files are never overwritten.

## Testing

- Unit tests cover Playwright classification, candidate extraction, unsupported syntax, confidence, redaction, path containment, and deterministic rendering.
- Agent integration tests cover ID-only analysis requests, allowlist enforcement, stale revisions, save verification, collision handling, atomic writes, and catalog refresh.
- Component tests cover single-row Draft creation, evidence display, incomplete-state validation, code preview, Run gating, and Save gating.
- End-to-end verification uses one read-only ProjectSTS item: create a draft, review generated code, run it, save it, refresh the catalog, select the generated Playwright row, and run it again.
- A mutating fixture verifies production-host rejection and required cleanup without changing real project data.

## Acceptance

```text
Existing @playwright/test files appear directly in the Playwright category
→ select one non-Playwright ProjectSTS coverage item
→ Create Playwright Draft analyzes only allowed source
→ Recipe Builder shows editable steps with evidence
→ Code Workspace shows deterministic Playwright code
→ incomplete or unsafe drafts cannot run
→ the exact reviewed draft passes
→ Save writes only under frontend/e2e/generated
→ catalog refresh shows the new Generated Playwright test
→ the imported test is selectable and runnable from Test Explorer
```

## Out of Scope

- Automatically creating drafts during catalog polling.
- Bulk conversion of multiple items.
- Running generated drafts without user review.
- AI-generated selector guesses without source evidence.
- Editing or replacing existing manual Playwright files.
- Sending ProjectSTS source code to the browser beyond the existing bounded source-view contract.
