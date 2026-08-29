# ProjectSTS Playwright Test Explorer Design

Date: 2026-08-30

## Goal

Make Morniter discover real Playwright tests from `E:\ProjectSTS\frontend`, group them by folder, let a user search and select tests, load a selected file into the editor, and run the selected tests through the Local Agent without exposing an absolute filesystem path to the browser.

## Confirmed current state

- ProjectSTS contains many `*.spec.ts`, `*.spec.tsx`, `*.test.ts`, and `*.test.tsx` files, but they currently use Node or Nest test runners.
- No ProjectSTS test currently imports `@playwright/test`.
- ProjectSTS has no `playwright.config.*` file.
- The frontend test script uses `node --test`, so those existing tests must not be sent to Playwright.
- Morniter already has Playwright catalog, job, Agent, selector, Explorer, and editor modules, but they require alignment around discovery, grouped catalog data, and real source loading.

## Scope

### ProjectSTS changes

Changes inside ProjectSTS are limited to Playwright testing assets under `E:\ProjectSTS\frontend`:

- add `@playwright/test` as a development dependency;
- add `playwright.config.ts`;
- add read-only smoke tests under `e2e/auth`, `e2e/students`, and `e2e/monitor`;
- add package scripts needed to list and run those tests.

No application source, database migration, seed, production data, or backend behavior will be changed.

### Morniter changes

- validate the Local Agent Playwright project configuration;
- discover only real Playwright files;
- derive test groups from paths under the configured `testRoot`;
- publish grouped catalog data and source snapshots safely;
- render the grouped Test Explorer;
- support search, selection, source loading, project switching, and Run;
- preserve containment, allowlisting, and no-raw-command rules.

## ProjectSTS Playwright layout

```text
E:\ProjectSTS\frontend
├── playwright.config.ts
└── e2e
    ├── auth
    │   └── login.spec.ts
    ├── students
    │   └── access.spec.ts
    └── monitor
        └── navigation.spec.ts
```

Initial tests are read-only:

- `auth/login.spec.ts`: open `/login` and verify the login UI is visible;
- `students/access.spec.ts`: open a protected students route without a session and verify safe redirect/access handling;
- `monitor/navigation.spec.ts`: verify a public or unauthenticated navigation boundary without modifying data.

`playwright.config.ts` uses `PLAYWRIGHT_BASE_URL` when provided and defaults to the local ProjectSTS frontend URL. It declares Chromium initially. Firefox and WebKit are enabled only after their browser packages are installed and Local Agent capabilities report them as available.

## Local Agent configuration

The ProjectSTS Playwright entry is:

```json
{
  "id": "projectsts",
  "name": "ProjectSTS",
  "playwright": {
    "enabled": true,
    "workspaceRoot": "E:\\ProjectSTS\\frontend",
    "testRoot": "e2e",
    "config": "playwright.config.ts",
    "allowedBrowsers": ["chromium"],
    "allowHeaded": true,
    "allowWorkspaceExecution": false,
    "maxTimeoutSeconds": 300,
    "envAllowlist": ["PLAYWRIGHT_BASE_URL"]
  }
}
```

`workspaceRoot` is local-only. `testRoot` and `config` must resolve inside it. Agent startup rejects traversal, an absolute `testRoot`, a missing root, a missing test directory, or a config path outside the root.

## Discovery rules

`agent/src/playwright-catalog.ts` recursively scans only the configured `testRoot`. Candidate filenames are:

- `*.spec.ts`
- `*.spec.tsx`
- `*.test.ts`
- `*.test.tsx`

A candidate is included only when its source imports Playwright from `@playwright/test`. Files importing `node:test`, Jest, Vitest, or Nest test helpers without `@playwright/test` are ignored.

The scanner derives:

- `relativePath`: path relative to `workspaceRoot`, normalized with `/`;
- `group`: first directory below `testRoot`, title-cased for display;
- `title`: Playwright test title when safely parsed, otherwise filename without extension;
- `id`: stable hash of project ID, relative path, test title, and line number;
- `line`: optional declaration line.

The scanner never returns `workspaceRoot`, drive letters, or absolute paths. Before reading every file it resolves the candidate and confirms it remains inside `workspaceRoot/testRoot`.

## Catalog contract

The browser-facing response from `GET /api/playwright-runner/catalog` retains the current envelope and supplies both grouped and flat forms during migration:

```ts
interface PlaywrightProjectCatalog {
  id: string;
  name: string;
  rootLabel: string;
  scanPathLabel: string;
  capabilities: AgentPlaywrightCapabilities;
  testGroups: Array<{
    name: string;
    tests: PlaywrightTestDescriptor[];
  }>;
  tests: PlaywrightTestDescriptor[];
}

interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  line?: number;
}
```

`scanPathLabel` is display-safe, for example `ProjectSTS/frontend/e2e`. It is composed from configured labels and relative segments, never from the absolute path. `tests` is retained temporarily for compatibility but `testGroups` is the UI source of truth. Each descriptor contains only `id`, `title`, `group`, `relativePath`, and optional `line`.

The API returns `Cache-Control: private, no-store`. A project with no valid Playwright files remains in the catalog with empty `testGroups` and `tests` so the UI can display the scan location and empty state.

## Secure source loading

Vercel cannot read files stored on the Windows Local Agent machine. The current source route must not resolve a ProjectSTS path from `process.cwd()` or fabricate placeholder source.

The Agent publishes source snapshots separately from the browser-facing catalog:

1. During catalog refresh, the Agent reads only files that passed discovery and containment.
2. It uploads a bounded source snapshot keyed by `agentId`, `projectId`, and `testId`.
3. Redis stores the source with the same short TTL as the catalog and a maximum file size of 200 KiB.
4. `GET /api/playwright-runner/source?projectId=...&testId=...` verifies the monitor session, loads the current catalog, confirms the test ID belongs to the selected project, then returns the stored source snapshot.
5. The response contains `relativePath` and `code`, never a local absolute path.

The browser cannot request an arbitrary relative path. It can request only a catalog-issued test ID. A stale or unknown ID returns 404 and prompts the UI to refresh the catalog.

## Test Explorer behavior

`PlaywrightWorkspace` passes `currentProject.testGroups` directly to `TestExplorer`. The flat `currentProject.tests` fallback is removed after catalog compatibility tests confirm every Agent publishes groups.

The Explorer displays:

```text
Authentication
 ☐ login.spec.ts

Students
 ☐ access.spec.ts

Monitor
 ☐ navigation.spec.ts
```

Behavior:

- checkbox toggles one test ID for Run;
- clicking the filename/title loads its source into the editor without changing selection;
- search matches filename, title, group, and relative path, case-insensitively;
- group headers can collapse and show selected/total counts;
- changing project clears selected IDs, editor source, search, and stale active-file state before rendering the new catalog;
- no tests shows the safe scan path and exactly `No Playwright tests found`;
- no search results shows `No matching tests found` without replacing the project-level empty state;
- test names are never hard-coded in frontend source.

## Run flow

1. User selects ProjectSTS.
2. UI renders ProjectSTS `testGroups` from the latest Agent catalog.
3. User selects one or more test IDs.
4. UI submits only `projectId`, `testIds`, selected browsers, and mode.
5. Server validates the IDs against the current catalog.
6. Agent claims the job and resolves IDs back to catalog-owned relative paths.
7. Agent performs containment checks again and invokes Playwright with an argument array and `shell: false`.
8. Existing bounded logs, heartbeat, cancellation, timeout, and result reporting remain in effect.

No request accepts a raw command, working directory, absolute path, arbitrary CLI argument, or arbitrary environment variable.

## Error handling

- Missing `workspaceRoot`: Agent startup/config error naming the project, without publishing the path.
- Missing `testRoot`: project remains visible with empty groups, safe scan label, and a catalog scan error suitable for the Agent log.
- No valid Playwright imports: normal empty state, not an API failure.
- Unreadable file: skip the file and record a sanitized Agent warning.
- Catalog expired: UI reports Agent/catalog unavailable and retries only through the existing bounded refresh mechanism.
- Source snapshot expired: source API returns 404; UI refreshes catalog once and asks the user to retry.
- Project switch during source request: abort or ignore the stale response by matching project ID and request generation.

## Test seams

Tests verify behavior at these public seams:

1. `scanPlaywrightTests(workspaceRoot, testRoot)`: candidate filtering, groups, stable IDs, relative paths, and containment.
2. Catalog Agent route and browser route: complete `projects[].testGroups` and `projects[].tests`, safe scan label, no absolute paths.
3. Source API: authorized catalog ID returns source; arbitrary path, unknown ID, oversized source, and expired source are rejected.
4. `TestExplorer`: grouped display, search by title/path/group, checkbox selection, filename source action, and empty state.
5. `usePlaywrightRunner`: project switch clears stale state and refreshes the selected project catalog.
6. ProjectSTS Playwright smoke suite: discovery via `--list`, Chromium execution, and read-only assertions.
7. Full Morniter flow: Agent online, ProjectSTS selected, catalog visible, source loaded, selected test run, terminal result completed.

## Acceptance criteria

- ProjectSTS has at least one real test importing `@playwright/test` in each approved group.
- Local Agent config resolves `E:\ProjectSTS\frontend\e2e` correctly.
- Explorer loads real ProjectSTS tests after the Agent publishes its catalog.
- Tests are grouped from folders, searchable, selectable, and openable in the editor.
- Run executes only selected test IDs through the Local Agent.
- Changing project refreshes groups and clears stale selection/source.
- Browser/API payloads contain no absolute local filesystem path.
- Existing path containment, project allowlist, execution authorization, secret filtering, bounded polling, cancellation, and timeout behavior continue to pass.

## Out of scope

- Converting existing Node or Nest tests into Playwright tests.
- Running backend Jest/Nest tests through the Playwright runner.
- Mutating student records or production data.
- Automatically generating tests from application source.
- Sending arbitrary local files to the editor.
- Artifact storage changes beyond the existing runner behavior.

