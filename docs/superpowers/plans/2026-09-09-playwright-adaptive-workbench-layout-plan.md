# Playwright Adaptive Workbench Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution with checkpoints. Git operations are user-managed and must not be run automatically.

**Goal:** Make `/monitor/tests` use an adaptive workbench that protects the Explorer and Code area, keeps Terminal bounded and collapsible, and switches to a non-overlapping tab layout on narrow or short screens.

**Architecture:** Keep runner state and APIs in `PlaywrightWorkspace` unchanged. Move workspace sizing into `useWorkspaceLayout` using a measured root/container budget, then let `BalancedWorkspaceLayout` allocate toolbar, main row, separator, and Terminal from that budget. Use the existing tab semantics for narrow mode and update only sizing, defaults, and surface composition.

**Tech Stack:** Next.js, React, TypeScript, Tailwind utility classes, `ResizeObserver`, Vitest, Testing Library, Playwright browser checks.

## Global Constraints

- Terminal must not compress the desktop main row below 320px.
- Expanded Terminal is bounded to the smaller of 280px or 28% of the measured workspace height.
- Terminal is collapsed by default for new layout preferences.
- Narrow mode is selected by measured workspace width below 860px or insufficient usable height, not only by `window.innerWidth`.
- Existing runner APIs, Agent protocol, catalog polling, editor state, logs, and job state remain unchanged.
- Do not run `git add`, `git commit`, or `git push` automatically.

---

### Task 1: Update layout preference bounds and defaults

**Files:**
- Modify: `src/components/playwright-runner/layout/workspace-layout-state.ts`
- Test: `tests/unit/playwright-runner/workspace-layout-state.test.ts`

**Interfaces:**
- Preserve `WorkspaceLayoutPreferences` and all exported function names.
- `clampTerminalHeight(value, availableHeight)` must clamp to 160px minimum and `min(280px, floor(availableHeight * 0.28))`, with a 160px fallback when the measured height is unavailable.
- `DEFAULT_WORKSPACE_LAYOUT.terminalCollapsed` becomes `true`.

- [ ] **Step 1: Extend unit expectations for the new defaults and workspace budget**

Add assertions for a collapsed default, a 28%-of-workspace terminal ceiling, and safe behavior when the workspace budget is shorter than the minimum.

```ts
expect(DEFAULT_WORKSPACE_LAYOUT.terminalCollapsed).toBe(true);
expect(clampTerminalHeight(500, 1000)).toBe(280);
expect(clampTerminalHeight(500, 600)).toBe(168);
expect(clampTerminalHeight(500, 500)).toBe(160);
```

- [ ] **Step 2: Run the focused unit test and confirm the old implementation fails**

Run: `npx vitest run tests/unit/playwright-runner/workspace-layout-state.test.ts`

Expected: FAIL on the old 60%-viewport expectation and the expanded default.

- [ ] **Step 3: Implement the new constants and clamp function**

Use named constants for `MIN_TERMINAL_HEIGHT = 160`, `MAX_TERMINAL_HEIGHT = 280`, and `TERMINAL_WORKSPACE_RATIO = 0.28`. Treat invalid or non-positive available height as 160px maximum/minimum-safe behavior, and preserve Explorer clamping and serialized field names.

- [ ] **Step 4: Run the focused unit test**

Run: `npx vitest run tests/unit/playwright-runner/workspace-layout-state.test.ts`

Expected: PASS with all preference and clamp assertions.

### Task 2: Measure the workspace and derive responsive mode

**Files:**
- Modify: `src/components/playwright-runner/layout/useWorkspaceLayout.ts`
- Modify: `src/components/playwright-runner/layout/workspace-layout-state.ts`
- Test: `tests/components/playwright-runner/useWorkspaceLayout.test.tsx`

**Interfaces:**
- Extend `UseWorkspaceLayoutResult` with `workspaceWidth`, `workspaceHeight`, and `terminalMaxHeight`.
- Preserve setters and reset behavior.
- Use `ResizeObserver` on a supplied or internally resolved workspace element; do not read `window.innerHeight` as the terminal budget.

- [ ] **Step 1: Add tests for measured dimensions and short-mode switching**

Mock `ResizeObserver`, render the hook with a host element, emit `{ width: 820, height: 700 }`, and assert `isNarrow === true`. Emit `{ width: 1200, height: 900 }` and assert `isNarrow === false` and `terminalMaxHeight === 252`.

- [ ] **Step 2: Run the hook tests to capture the missing interface**

Run: `npx vitest run tests/components/playwright-runner/useWorkspaceLayout.test.tsx`

Expected: FAIL because the hook does not yet expose measured dimensions or a ResizeObserver-driven mode.

- [ ] **Step 3: Implement measurement and conservative fallback**

Add a `workspaceRef` callback/ref to the hook result, observe its content box, store width and height, and use these rules:

```ts
const NARROW_WORKSPACE_WIDTH = 860;
const MIN_DESKTOP_MAIN_HEIGHT = 320;
const isNarrow = workspaceWidth < NARROW_WORKSPACE_WIDTH || workspaceHeight < MIN_DESKTOP_MAIN_HEIGHT + 180;
const terminalMaxHeight = clampTerminalHeight(Number.POSITIVE_INFINITY, workspaceHeight - MIN_DESKTOP_MAIN_HEIGHT);
```

Before the first measurement, use the existing media-query result and an 800px height fallback so SSR stays deterministic. Re-clamp stored terminal height whenever the measured budget changes.

- [ ] **Step 4: Run hook tests and existing layout-state tests**

Run: `npx vitest run tests/components/playwright-runner/useWorkspaceLayout.test.tsx tests/unit/playwright-runner/workspace-layout-state.test.ts`

Expected: PASS.

### Task 3: Apply the height budget to desktop and narrow layouts

**Files:**
- Modify: `src/components/playwright-runner/PlaywrightWorkspace.tsx`
- Modify: `src/components/playwright-runner/layout/BalancedWorkspaceLayout.tsx`
- Modify: `src/components/playwright-runner/layout/WorkspaceTabs.tsx`
- Modify: `src/components/test-runner/LiveTestTerminal.tsx`
- Test: `tests/components/playwright-runner/BalancedWorkspaceLayout.test.tsx`
- Test: `tests/components/playwright-runner/WorkspaceLayoutControls.test.tsx`

**Interfaces:**
- `BalancedWorkspaceLayout` consumes `workspaceRef`, `terminalMaxHeight`, and the existing layout setters.
- `LiveTestTerminal` keeps its existing `height` prop but receives no fixed height in narrow tab mode.
- No runner API or terminal line shape changes.

- [ ] **Step 1: Add component assertions for collapsed default, protected main row, and tab-mode terminal**

Assert the desktop root receives the measured ref, the desktop main row has `min-h-[320px]`, and the narrow Terminal panel does not render an inline pixel height wrapper.

- [ ] **Step 2: Run the focused component tests to capture the old layout**

Run: `npx vitest run tests/components/playwright-runner/BalancedWorkspaceLayout.test.tsx tests/components/playwright-runner/WorkspaceLayoutControls.test.tsx`

Expected: FAIL for the new protected-row and no-fixed-height assertions.

- [ ] **Step 3: Implement the desktop structure**

Attach the hook ref to the workspace root. Remove the global `window.innerHeight * 0.6` calculation from `BalancedWorkspaceLayout`; use `terminalMaxHeight`. Keep the toolbar shrink-0, make the main row `minmax(320px, 1fr)`, and render Terminal as a bounded region with a compact header. Pass `height={isNarrow ? undefined : terminalHeight}` so tab mode can grow naturally.

- [ ] **Step 4: Implement the narrow structure**

Keep the existing tablist semantics but replace `min-h-[400px]` plus the outer `min-h-[520px]` with a selected panel minimum of 360px and document-level vertical scrolling. Ensure hidden panels remain stateful and no tab panel has a fixed Terminal height.

- [ ] **Step 5: Remove nested overflow traps around the page workspace**

Change the Tests route wrappers so desktop keeps one bounded workspace scroll context, while narrow mode uses `overflow-y-auto` and `overflow-x-hidden`. Do not remove overflow protection from the Terminal log itself.

- [ ] **Step 6: Run focused component tests**

Run: `npx vitest run tests/components/playwright-runner/BalancedWorkspaceLayout.test.tsx tests/components/playwright-runner/WorkspaceLayoutControls.test.tsx`

Expected: PASS.

### Task 4: Reduce toolbar and panel density without changing controls

**Files:**
- Modify: `src/components/playwright-runner/layout/WorkspaceControlBar.tsx`
- Modify: `src/components/playwright-runner/explorer/TestExplorer.tsx`
- Modify: `src/components/playwright-runner/editor/CodeWorkspace.tsx`

**Interfaces:**
- Preserve all current callback props and control labels used by `PlaywrightWorkspace` tests.
- Keep existing selection, editor, and run behavior unchanged.

- [ ] **Step 1: Add/adjust component assertions for stable Run placement and compact grouping**

Assert the toolbar exposes configuration and execution groups, and the Run/Cancel action remains present after the toolbar wraps.

- [ ] **Step 2: Group existing controls into two flex regions**

Use one configuration group for project/source/browser and one execution group for mode/Agent/reset/Run. Allow the first group to wrap, but keep the execution group together with `shrink-0` and a stable trailing action area.

- [ ] **Step 3: Reduce nested surfaces in Explorer and Code**

Keep one panel surface, use dividers for rows, reduce secondary action labels in narrow widths, and replace unsupported `py-0.2` utilities with `py-1` or `py-0.5`.

- [ ] **Step 4: Run component tests for workspace integration**

Run: `npx vitest run tests/components/playwright-runner/PlaywrightWorkspace.test.tsx tests/components/playwright-runner/WorkspaceLayoutControls.test.tsx`

Expected: PASS with existing selection, editor, and run behavior intact.

### Task 5: Verify responsive behavior in browser

**Files:**
- Modify if needed: the files from Tasks 2–4 only
- Test: `tests/e2e/playwright-workspace-layout.spec.ts` (create)

**Interfaces:**
- The browser test uses the existing authenticated test setup or a mocked workspace boundary; it does not submit real jobs or mutate provider data.

- [ ] **Step 1: Add browser assertions for required viewport sizes**

Cover 1440×900, 1024×640, 900×700, 613×739, and 390×844. Assert no horizontal document overflow, desktop main row minimum when wide, tablist presence when narrow, and Terminal body absence of fixed inline height in tab mode.

- [ ] **Step 2: Run the browser layout test**

Run: `npx playwright test tests/e2e/playwright-workspace-layout.spec.ts --project=chromium`

Expected: PASS for all viewport checks.

- [ ] **Step 3: Run the complete focused suite**

Run: `npx vitest run tests/unit/playwright-runner/workspace-layout-state.test.ts tests/components/playwright-runner/`

Expected: PASS with no changes to runner API behavior.

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run typecheck`

Run: `npm run lint`

Expected: both commands exit with code 0.

- [ ] **Step 5: Verify the live page at the reported narrow viewport**

Open `/monitor/tests`, set the viewport to approximately 613×739, and confirm visually that only one workspace tab panel is visible, the page scrolls vertically, and Terminal does not overlap the header or Explorer. Then verify a 1440×900 view with Terminal collapsed and expanded.

No Git commit or push is performed automatically; the user handles those operations.
