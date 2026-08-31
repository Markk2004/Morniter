# Playwright Workspace Balanced Layout Design

## Status

Approved in conversation on 2026-08-31. Git operations remain user-managed.

## Goal

Rebalance `/monitor/tests` around its three primary tasks: selecting tests, reviewing or editing code, and following execution output. The layout must remain usable in a full desktop window, an installed PWA window, and a narrow in-app browser without changing test execution behavior.

## Current Problems

- The page container uses `max-w-7xl`, which constrains an IDE-like workspace unnecessarily on wide displays.
- Project, browser, execution mode, and Agent controls occupy separate vertical cards before the user reaches Test Explorer.
- The desktop layout fixes Test Explorer at 320px and gives the user no way to balance long function names against editor width.
- Terminal renders below the main grid without a bounded workspace height, so reading logs requires substantial page scrolling.
- Below the current `lg` breakpoint, every panel stacks vertically. In a narrow 587px viewport the page grows beyond 3,000px and the active work area is not visible as one workspace.

## Product Decisions

- Use an editor-first two-column layout with Test Explorer on the left and Code Space on the right.
- Place Terminal across the full width below both columns.
- Consolidate Project, Browser, Execution Mode, Agent status, and Run or Cancel into one compact toolbar.
- Let the user resize Test Explorer between 280px and 440px.
- Let the user resize Terminal from its 240px default up to 60% of the viewport and collapse it.
- At viewport widths below 900px, replace the split layout with three workspace tabs: Explorer, Code, and Terminal.
- Persist only panel dimensions, collapsed state, and the last selected workspace tab.
- Keep Run, Cancel, Execution Lock, Agent, catalog, editor, and Terminal data behavior unchanged.

## Desktop Layout

The tests page uses the available content width instead of `max-w-7xl`. A small outer gutter remains for separation from the app shell.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Project | Browser | Mode | Agent                 Run / Cancel       │
├───────────────────┬─────────────────────────────────────────────────┤
│ Test Explorer     │ Code Space                                      │
│ 280–440px         │ minmax(0, 1fr)                                  │
│ resizable         │                                                 │
├───────────────────┴─────────────────────────────────────────────────┤
│ Terminal · resizable · collapsible · default 240px                 │
└─────────────────────────────────────────────────────────────────────┘
```

The main work region should fit within the remaining viewport height after the app navigation and workspace heading. Explorer, editor, and Terminal scroll internally. Resizing one panel must not cause the document body to jump or create horizontal scrolling.

## Compact Toolbar

The toolbar keeps the current controls and status information while removing separate stacked cards.

- Project is a labeled select.
- Browser is a compact segmented control or select, depending on available width.
- Execution Mode is a compact segmented control with short labels and accessible descriptions.
- Agent status uses a status dot, text label, and last-seen details through existing disclosure behavior.
- Run and Cancel share one stable action area aligned to the right.
- At intermediate widths, secondary descriptions hide before controls wrap.
- The toolbar may wrap to a second row, but action placement remains predictable.

No setting is moved into a hidden modal. The user can verify the active project, browser, and mode before every run.

## Resizable Panels

### Test Explorer

- Default width: 320px.
- Minimum width: 280px.
- Maximum width: 440px.
- The separator provides pointer drag and keyboard adjustment.
- Keyboard arrows change width in 16px increments; Home resets to minimum, End sets maximum.
- The separator exposes `role="separator"`, orientation, minimum, maximum, and current value.
- Double-click resets to 320px.

### Terminal

- Default height: 240px.
- Minimum expanded height: 160px.
- Maximum height: 60% of the viewport.
- The horizontal separator supports pointer drag and keyboard adjustment.
- Collapse leaves a persistent Terminal header with job state and unread-log count.
- Double-click resets to 240px.
- Starting a run does not force the panel open if the user intentionally collapsed it; the header shows running state and unread log count instead.

Resize updates should be frame-bounded to avoid layout thrashing. Dimensions are clamped again when the viewport changes.

## Narrow Layout

Below 900px, resizers disappear and the work area becomes one panel controlled by tabs:

```text
Explorer | Code | Terminal
```

- Only the selected panel participates in the visible layout.
- Switching tabs does not clear selection, editor contents, scroll position, or Terminal output.
- A running job adds status and unread count to the Terminal tab but does not steal focus.
- Controls retain at least a 44px touch target.
- No panel or toolbar creates horizontal page scrolling.

The narrow layout replaces the current long vertical stack. It is intended for resized desktop or PWA windows as well as tablet-sized widths; mobile remains a secondary usage mode.

## Persistence and Reset

Store the following browser-local preferences under one versioned workspace-layout key:

- Explorer width;
- Terminal height;
- Terminal collapsed state;
- last selected narrow-layout tab.

Do not persist selected tests, code drafts, log contents, passwords, tokens, project paths, or Agent data. Invalid, old-version, or out-of-range values fall back to defaults. A `Reset layout` action restores all defaults without clearing login or application data.

## Component Boundaries

- `PlaywrightWorkspace` continues to own runner state and composes the workspace.
- A focused layout component owns responsive mode, dimensions, persistence, and separators.
- A compact toolbar component composes existing selectors and actions without duplicating runner state.
- Existing Test Explorer, Code Workspace, Terminal, result, and recipe components remain responsible for their current content and behavior.
- Layout state does not enter API payloads or runner hooks.

This boundary lets panel behavior be tested independently and avoids adding resize concerns to test execution code.

## Accessibility and Interaction

- Separators are keyboard operable and have visible focus indicators.
- Tabs use tablist, tab, and tabpanel semantics with arrow-key navigation.
- Collapsed Terminal remains discoverable through its labeled header.
- Resize cursor and focus treatment make draggable boundaries visible without relying on color alone.
- Motion is limited to 150–200ms opacity or transform transitions and respects reduced motion.
- Existing focus behavior for Tutorial, Run, Cancel, and Execution Lock must remain intact.

## Performance

- Pointer resize uses `requestAnimationFrame` or an equivalent frame-bounded update.
- Preference writes occur after resize settles rather than on every pointer event.
- Panel resizing must not restart catalog polling, reset editor state, remount Terminal, or refetch jobs.
- Hidden narrow-layout panels remain stateful without duplicating expensive content trees.
- Long Explorer and Terminal content retains internal scrolling and current list or log bounds.

## Testing

- Unit tests cover preference parsing, clamping, version fallback, and Reset layout.
- Component tests cover pointer and keyboard resizing, Terminal collapse, stable Run or Cancel placement, and state preservation.
- Responsive tests cover wide desktop, laptop, 900px boundary, and the observed 587px narrow viewport.
- Accessibility tests cover separator values, tab semantics, keyboard order, focus visibility, and touch target sizes.
- Regression tests verify that resizing or switching tabs does not alter selected tests, editor source, active job, logs, or execution controls.
- Browser verification confirms no horizontal document scroll and no multi-thousand-pixel vertical workspace stack at narrow widths.

## Acceptance

```text
Open /monitor/tests on a wide desktop
→ project, browser, mode, Agent, and Run controls appear in one compact toolbar
→ Explorer and Code share the main row
→ Explorer width can be adjusted from 280px to 440px
→ Terminal spans the bottom and can be resized or collapsed
→ Run and Cancel stay in a stable location

Resize the window below 900px
→ workspace changes to Explorer, Code, and Terminal tabs
→ no horizontal page scroll appears
→ selection, code, job, and logs survive tab changes
→ the page no longer becomes one long stack

Reload the page
→ safe layout preferences are restored
→ Reset layout restores defaults
```

## Out of Scope

- Changes to runner APIs, Redis jobs, Local Agent execution, cancellation, or catalog contracts.
- A mobile-first redesign of Test Explorer content.
- Detachable panels, multiple editor tabs, or floating windows.
- Persisting workspace data on the server or sharing layout preferences between users.
- Replacing the existing visual theme, typography, or application navigation.
