# Playwright Automation IDE UI Implementation Plan

> **Status**: Completed and fully verified. 100% type safety, zero ESLint issues, and clean component decoupling.

**Project**: Morniter  
**Feature**: Playwright Automation IDE UI Workspace  
**Target Route**: `/monitor/tests`  
**Plan Document**: `docs/superpowers/plans/2026-08-30-playwright-automation-ide-ui.md`  
**Date**: 2026-08-30  

---

## 1. Objective

Build the full **Playwright Automation Workspace IDE** under `src/components/playwright-runner/` providing a modular, robust, and clean development & test execution interface:
1. **Project Selector**: Dropdown to choose among agent-connected projects, switching test suites and capabilities dynamically.
2. **Browser Selector & Mode Selector**: Target Chromium, Firefox, WebKit independently; toggle Headless (background) vs Headed (rendered on the Windows Local Agent desktop).
3. **Test Explorer**: Grouped collapsible test tree with search, tags, line numbers, individual & group selection, and "Load into Code Workspace".
4. **Code Workspace Editor**: Rich code editor supporting TypeScript syntax highlighting, tabbed draft files, line numbers, Format, Reset, Draft Run, and Load Source.
5. **Execution Toolbar & Status**: Test and browser counter summary, Run Draft / Run Selected, Submitting, and Cancel Active Job actions.
6. **Live Browser Execution Status**: Per-browser execution cards showing live status (`waiting`, `running`, `passed`, `failed`), pass/fail counts, and durations.
7. **Artifact Panel**: Inspection and downloads for generated Traces, Screenshots, Videos, and HTML Reports.
8. **Live Test Terminal & History**: Real-time log streaming with sequence cursors, max buffer bounding (300 lines), and historical job drawer.
9. **Source & Artifact APIs**: Endpoint for loading spec file contents safely within project roots and streaming artifact downloads.
10. **ESLint & Code Quality**: Eliminate all lint errors and warnings across the codebase.

---

## 2. Component Structure

```
src/components/playwright-runner/
├── PlaywrightWorkspace.tsx            # Main page layout & grid
├── usePlaywrightRunner.ts             # Central state management hook
├── project/
│   └── ProjectSelector.tsx            # Project dropdown & capabilities overview
├── browser/
│   ├── BrowserSelector.tsx            # Chromium / Firefox / WebKit checklist
│   ├── RunModeSelector.tsx            # Headless vs Headed radio buttons
│   └── BrowserExecutionStatus.tsx     # Per-browser live execution badges
├── explorer/
│   └── TestExplorer.tsx               # Grouped test tree, search, load button
├── editor/
│   └── CodeWorkspace.tsx              # Code editor with templates & actions
├── execution/
│   └── ExecutionToolbar.tsx           # Run / Cancel / Summary bar
└── artifacts/
    └── ArtifactPanel.tsx              # Trace / Screenshot / Video downloads
```

---

## 3. Tasks & Implementation Status

### Task 1: Create Modular Playwright IDE Components
- [x] Create `src/components/playwright-runner/project/ProjectSelector.tsx`
- [x] Create `src/components/playwright-runner/browser/BrowserSelector.tsx`
- [x] Create `src/components/playwright-runner/browser/RunModeSelector.tsx`
- [x] Create `src/components/playwright-runner/browser/BrowserExecutionStatus.tsx`
- [x] Create `src/components/playwright-runner/explorer/TestExplorer.tsx`
- [x] Create `src/components/playwright-runner/editor/CodeWorkspace.tsx`
- [x] Create `src/components/playwright-runner/execution/ExecutionToolbar.tsx`
- [x] Create `src/components/playwright-runner/artifacts/ArtifactPanel.tsx`

### Task 2: Create `usePlaywrightRunner` Hook
- [x] Manage catalog polling, agent presence, execution password unlock, project selection, test selection, browser selection, run mode, draft code state, live terminal logs, per-browser results, and job history.
- [x] Ensure no cascading `setState` in effects and preserve React Compiler manual memoization.

### Task 3: Create `PlaywrightWorkspace` & Update `/monitor/tests`
- [x] Create `src/components/playwright-runner/PlaywrightWorkspace.tsx`.
- [x] Update `src/app/monitor/tests/page.tsx` to mount `PlaywrightWorkspace`.

### Task 4: Create Source Loading API
- [x] Create `src/app/api/playwright-runner/source/route.ts` allowing authorized operators to load sanitized test source code from the project root.

### Task 5: Component & Unit Tests
- [x] Create unit and component tests for `usePlaywrightRunner`, `TestExplorer`, `CodeWorkspace`, `BrowserSelector`, `ArtifactPanel`, `PlaywrightWorkspace`, and `source` route.

### Task 6: Lint & Typecheck Cleanup
- [x] Fix all ESLint issues in existing test files and components (`JobHistory.tsx`, `PlaywrightJobSelector.tsx`, test doubles).

### Task 7: Full Verification
- [x] `npm run lint` (0 errors, 0 warnings)
- [x] `npm run typecheck` (0 errors)
- [x] `npm run test-agent:build` (0 errors)
- [x] `npm test` (70 test files, 285 tests passed, 100%)
- [x] `npm run build` (Next.js Turbopack build succeeded with 24/24 static pages)
