# Playwright mobile vertical scroll implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore vertical scrolling and usable Test tab height on narrow `/monitor/tests` screens.

**Architecture:** Switch only the narrow layout from a viewport-locked shell to document scrolling. Retain the existing desktop layout and panel-owned scrolling.

**Tech Stack:** React, Tailwind CSS, Playwright.

## Global Constraints

- The breakpoint remains 900px.
- The selected narrow tab panel must be at least 320px high.
- Desktop layout behavior must not change.
- Git operations remain manual.

---

### Task 1: Add the responsive scroll regression and fix layout containment

**Files:**
- Modify: `e2e/playwright-workspace-layout.spec.ts`
- Modify: `src/components/monitor/MonitorShell.tsx`
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Modify: `src/components/playwright-runner/layout/BalancedWorkspaceLayout.tsx`
- Modify: `src/components/playwright-runner/layout/WorkspaceTabs.tsx`

**Interfaces:**
- Consumes: existing 900px `isNarrow` breakpoint.
- Produces: document scrolling below 900px and a selected tab panel height of at least 320px.

- [x] Add a 534x752 browser test that checks document vertical overflow, selected panel height, panel `overflow-y`, and no horizontal overflow.
- [x] Run `npx playwright test e2e/playwright-workspace-layout.spec.ts --grep "534x752"` and confirm it fails because the selected panel is below 320px.
- [x] Add narrow breakpoint overflow and minimum-height classes while retaining desktop classes.
- [x] Run the focused test and the complete layout spec.
- [x] Run `npm run typecheck` and `npm run lint`.
