# Multi-Runner Automation and Recipe Builder Design

## Status

Approved in conversation on 2026-08-30. Git operations remain user-managed.

## Goal

Make every discovered ProjectSTS test useful from Test Explorer. Existing Playwright, Jest, Jest E2E, and Node tests run with their native runner. Any source file can also seed a reviewed Playwright browser draft through a structured Recipe Builder.

## Product Decisions

- A checkbox always means the selected item can run with its declared native runner.
- Playwright and generated Playwright run through Playwright.
- Jest, Jest E2E, and Node tests run as automated tests without conversion.
- Clicking any discovered file loads its exact source into Code Workspace.
- `Create Playwright Draft` is optional and does not modify ProjectSTS.
- Browser drafts are built from structured actions, not guessed from source code.
- Supported actions are Go to, Fill, Click, Select, Expect visible, Expect URL, and Expect text.
- Supported locators are Role, Label, Text, and Test ID. CSS and XPath are excluded from the first release.
- Reusable flows such as `Login as UAT user` can be referenced by recipes.
- Credentials are environment references such as `STS_UAT_USERNAME`; their values never enter the browser, catalog, Redis, generated source, or logs.
- A draft must pass before `Save as Automated Test` is enabled.
- Recipes, flows, and generated-test metadata are owned by `E:\ProjectSTS\test-automation-map.json`.
- Generated specs stay under `E:\ProjectSTS\frontend\e2e\generated`.
- Recipe writes require Execution Lock and explicit confirmation.
- Writes use an optimistic revision hash. A stale revision returns a conflict and never overwrites newer work.
- Mutating recipes are rejected when the target resolves to production and must define cleanup steps.
- Selected tests are partitioned by runner and executed sequentially. Logs and results appear in one Terminal job.

## Architecture

### Catalog

The Local Agent remains the only component allowed to read ProjectSTS files. It publishes relative paths and bounded source text for every discovered test. Each catalog row includes a stable ID, runner, execution profile, risk, and executable state.

The browser never sends a command, working directory, config path, or filesystem path. It sends only catalog test IDs. The Agent resolves those IDs against a fresh local catalog before execution.

### Native Multi-Runner Execution

The Agent partitions selected IDs in this fixed order:

1. Playwright and generated Playwright;
2. Frontend Node tests;
3. Backend Jest tests;
4. Backend Jest E2E tests.

Runner commands are constructed inside the Agent from validated runner profiles:

```text
playwright         npx playwright test <resolved files> --config <validated config>
node-test          node --test <resolved files>
jest               npx jest --runInBand <resolved files>
jest-e2e           npx jest --config <validated config> --runInBand <resolved files>
```

The manifest supplies only contained working directories and optional contained config paths. It cannot supply executable names or arbitrary arguments.

One failed runner group marks the job failed. Remaining groups do not run unless the request explicitly uses `continueOnFailure=true`; the first release fixes this value to `false` and does not expose it in the UI.

### Source Loading

The source endpoint resolves a catalog test ID, then returns its catalog-cached source and relative path. It supports all runner types. Absolute paths are never returned. Source is capped at 200 KB per file and redacted before publication.

### Recipe Builder

`Create Playwright Draft` copies only safe metadata from the selected source: test ID, title, runner, UAT function, and relative path. It does not translate implementation code.

The builder creates a typed recipe from reusable flows and actions. A deterministic renderer converts the recipe to Playwright TypeScript in Code Workspace after every valid edit. Invalid actions produce field-level errors and no executable draft.

Environment values are referenced in generated code through a safe helper:

```ts
const username = requireTestEnv("STS_UAT_USERNAME");
```

The helper throws a redacted missing-variable error and never prints the value.

### Draft Verification and Saving

Drafts run through the existing isolated workspace-code path. The server records a SHA-256 code hash on the job. A recipe can be saved as an automated test only when the referenced job passed and its code hash matches the current rendered draft.

Direct local writes use a separate Agent mutation queue:

```text
Browser POST save request
→ server validates Execution Lock and stores mutation request in Redis
→ Local Agent claims mutation
→ Agent compares baseRevision with current map hash
→ Agent validates recipe, renders deterministic spec, and runs playwright --list
→ Agent atomically writes map and generated spec
→ browser polls mutation result and refreshes catalog
```

The Agent refuses to overwrite manual files. Existing generated files must contain the Morniter generated header and matching recipe ID.

### Mutating Test Safety

Every recipe declares `risk: "read-only" | "mutating"`. Mutating recipes must include cleanup actions and use generated data prefixed with `UAT-${runId}`. Before execution, the Agent parses `STS_UAT_BASE_URL` and rejects hosts listed in the project's production-host denylist.

## User Interface

- Test Explorer displays runner badges and checkboxes for every executable row.
- Project summary distinguishes `runnable tests` from `coverage references`.
- Clicking a row opens source in Code Workspace.
- Native source mode is read-only.
- `Create Playwright Draft` opens Recipe Builder beside Code Workspace.
- Code updates live as actions change.
- Run output prefixes each line with the runner and file group.
- After a successful draft run, `Save as Automated Test` becomes available.
- Conflict, missing environment, unsafe production target, invalid locator, failed cleanup, and failed `playwright --list` are explicit states.

## Security Boundaries

- No raw command, cwd, config path, environment value, or absolute path comes from the browser.
- Test IDs are resolved against the current Agent catalog and project allowlist.
- All reads and writes use path containment and reject symlinks.
- Only allowlisted environment variable names may appear in recipes.
- Source and logs pass through existing redaction.
- Recipe and generated-file writes require Execution Lock, a matching revision, and a verified passing draft.
- Production hosts are denied for mutating tests.
- Manual test files are never overwritten or deleted.

## Acceptance

```text
Select ProjectSTS
→ Explorer shows Playwright, Node, Jest, and Jest E2E files
→ every executable native test has a checkbox
→ clicking any row loads exact source
→ mixed selections run sequentially by native runner
→ Terminal streams tagged output and final per-runner results
→ Create Playwright Draft opens structured actions
→ reusable login flow references Local Agent secrets
→ draft code updates live and runs without writing ProjectSTS
→ passing draft can be saved with optimistic revision checking
→ saved generated test appears as selectable Generated Playwright
→ mutating draft cannot run against production and performs cleanup
```

