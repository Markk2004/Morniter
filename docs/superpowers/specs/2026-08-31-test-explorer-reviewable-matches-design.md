# Test Explorer Reviewable Matches Design

## Status

Approved for implementation on 2026-08-31.

## Goal

Make large function groups easier to scan and explain why unfamiliar automated tests were matched to a sheet function, without changing the matcher or exposing additional filesystem data.

## Confirmed decisions

- Keep the existing function heading `functionId · functionName`.
- Remove the long nested `border-l` treatment from expanded test lists.
- Split matched tests into `พร้อมทดสอบ` and `ควรตรวจสอบการจับคู่`.
- High and Medium confidence belong to `พร้อมทดสอบ`; Low belongs to `ควรตรวจสอบการจับคู่`.
- Keep the Low-confidence section collapsed initially.
- Show at most 10 tests per section initially, with `แสดงเพิ่มอีก 10` and `ย่อรายการ` actions.
- Add inline match details; do not use a modal.
- Preserve checkbox selection, source opening, runner filtering, search, risk, and execution behavior.

## Presentation model

Filtering occurs before presentation grouping. Search and runner filters produce the visible tests for a function group, then those tests are partitioned by confidence.

```ts
const readyTests = tests.filter((test) => test.confidence !== "low");
const reviewTests = tests.filter((test) => test.confidence === "low");
```

Each section shows its own count and visible-page limit. Limits start at 10 and increase by 10. `ย่อรายการ` resets that section to 10. Changing Project, search text, or runner filter resets all limits to 10 so stale expansion state does not make the next view unexpectedly long.

Legacy tests normalized by Test Explorer receive High confidence and remain in `พร้อมทดสอบ`.

## Test row

The primary row keeps:

- checkbox for executable tests;
- test title;
- relative path;
- `ตรงกับ Sheet` badge when complete function metadata exists;
- runner, risk, and confidence labels;
- source-opening action.

Add a separate `รายละเอียด` button. It expands a panel directly below the same row and uses `aria-expanded` plus `aria-controls`. Multiple detail panels may remain open.

The detail panel shows:

- sheet function ID and name;
- relative path only;
- runner label;
- confidence text;
- matching reasons;
- executable status;
- Read-only or Mutating risk.

No absolute path, workspace root, raw sheet row, source body, recipe body, credential, or environment variable is displayed.

## Matching reason copy

Map existing `matchedBy` values to user-facing Thai copy:

- `explicit`: `กำหนดไว้ใน automation map`
- `source-id`: `พบ Function/Test ID ใน source`
- `path`: `ตรงจากชื่อโฟลเดอร์หรือไฟล์`
- `title`: `ตรงจากชื่อ test`
- `keyword`: `ตรงจากคำสำคัญ`

If no reason exists, show `ไม่มีรายละเอียดการจับคู่`.

## Expanded function layout

Replace the current indented list and long left border with two flat subsections:

1. `พร้อมทดสอบ` with a count and immediately visible rows.
2. `ควรตรวจสอบการจับคู่` with a count, a short explanation, and collapsed rows by default.

The section headers are native buttons when collapsible. They expose state with `aria-expanded`. Status is communicated with text and count, not color alone. Existing dark colors remain; no gradient or decorative glass effect is added.

## Component boundaries

- `test-explorer-presentation.ts`: confidence partitioning, batch-size constant, reason labels, and pure presentation helpers.
- `TestMatchDetails.tsx`: accessible inline detail panel for one test.
- `TestExplorer.tsx`: search/filter state, group and subsection expansion, visible limits, selection, and source actions.

The matcher, Agent catalog, API schema, and persistence layers do not change.

## Testing

- Pure helper tests cover High/Medium versus Low partitioning and matching-reason labels.
- Component tests cover default section state, counts, inline details, multiple open details, load-more increments, collapse to 10, search, runner filter, checkbox behavior, source opening, and legacy groups.
- Tests verify only relative paths appear in details.
- Typecheck, lint, focused Vitest, full Vitest, and production build are required.

## Acceptance

- Large function groups no longer display every test at once.
- High and Medium tests appear under `พร้อมทดสอบ`.
- Low tests remain under a collapsed `ควรตรวจสอบการจับคู่` section.
- A user can see why an unfamiliar test was matched without leaving Test Explorer.
- Search still finds all tests regardless of the current 10-row display limit.
- Selection, source opening, runner filtering, and legacy catalogs continue working.
