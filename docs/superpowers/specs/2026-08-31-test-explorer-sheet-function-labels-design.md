# Test Explorer Sheet Function Labels Design

## Status

Approved and implemented locally on 2026-08-31. Focused Agent, schema, and Test Explorer tests pass.

## Goal

Make the relationship between automated tests and functions from an automation sheet visible in Test Explorer without hard-coding ProjectSTS or a specific function-ID format.

## Confirmed presentation

- A coverage-group heading displays `functionId · functionName`, for example `FN-STS-01 · Authentication`.
- Each matched test displays a compact `ตรงกับ Sheet` badge and its existing confidence value as High, Medium, or Low.
- Search matches function ID and function name in addition to test title, relative path, runner, and match method.
- Projects without automation-map metadata keep the existing Test Explorer presentation.
- The UI does not repeat the full function name in every test row.

## Data contract

Extend `ProjectCoverageGroup` in both Agent and web contracts with optional metadata:

```ts
interface ProjectCoverageGroup {
  id: string;
  name: string;
  functionId?: string;
  functionName?: string;
  tests: ProjectCoverageTest[];
  gaps: ProjectCoverageGap[];
}
```

Both fields are optional so stored catalogs, mocked fixtures, and non-sheet projects remain compatible. The Agent must populate both fields together from the selected `AutomationFunctionRule`; the frontend must not infer them from `id` or parse a ProjectSTS naming convention.

## Data flow

1. `uat-test-matcher.ts` continues selecting one primary automation function for each discovered test.
2. `playwright-catalog.ts` preserves the matched coverage group's function ID and name when producing `coverageGroups`.
3. Agent and web TypeScript contracts expose the optional fields.
4. The Zod catalog schema accepts the optional fields and rejects invalid non-string values.
5. Test Explorer renders sheet metadata when both values are present and falls back to the existing group name otherwise.

No new API route, storage key, database, or matching algorithm is required.

## Test Explorer behavior

For a sheet-backed group, the expandable heading uses the function identity as its accessible name and visible label. The test count remains aligned on the opposite side.

Inside an expanded group:

- Executable behavior, checkbox selection, source opening, runner badge, risk badge, and confidence remain unchanged.
- `ตรงกับ Sheet` appears only when the parent group has both `functionId` and `functionName`.
- Confidence remains visible and uses text, not color alone.
- Search includes `group.functionId` and `group.functionName` before groups are filtered.

For a legacy group or a catalog without the optional metadata, Test Explorer continues displaying `group.name` and does not show the sheet badge.

## Security and compatibility

- Do not expose an automation-sheet file path, workspace root, absolute path, source code, recipe body, credentials, or raw sheet rows.
- Continue exposing only the existing test `relativePath`.
- Do not hard-code `ProjectSTS`, `FN-STS`, a fixed function count, or a particular sheet provider in frontend code.
- Preserve existing catalog payloads by making both fields optional.
- If only one field is present in malformed upstream data, render the legacy group label and omit the badge.

## Testing

- Agent catalog test proves `functionId` and `functionName` survive matching and catalog serialization.
- Schema tests accept a group with both fields and remain compatible with a group without them.
- Test Explorer component tests verify the combined heading, sheet badge, confidence text, search by function ID, search by function name, and legacy fallback.
- Security assertions confirm no absolute path or raw sheet content is added to the payload.
- Full Agent build, typecheck, lint, Vitest, and production build remain required before completion.

## Acceptance

- Selecting a sheet-backed project shows a function ID and function name on each coverage-group heading.
- Expanding the group shows `ตรงกับ Sheet` on matched automated tests.
- Searching by function ID or function name finds the correct group and tests.
- Projects without automation-map metadata render unchanged.
- Existing selection, source opening, runner filtering, and execution behavior continue working.
