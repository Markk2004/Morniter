# Playwright Adaptive Workbench Layout Design

## Status

Approved in conversation on 2026-09-09. Git operations remain user-managed.

This document supersedes the sizing, terminal-default, and responsive-breakpoint decisions in `2026-08-31-playwright-workspace-balanced-layout-design.md`. Test execution, Agent, catalog, editor, and persistence behavior remain unchanged unless stated here.

## Goal

Make `/monitor/tests` comfortable in a full desktop window, a short laptop window, and the narrow in-app browser. Explorer and Code remain the primary workspace. Terminal must never cover or compress them below a usable height.

## Observed Problems

- Terminal height is bounded against the entire viewport instead of the space remaining after navigation, heading, alerts, and toolbar.
- Terminal, its separator, and header are non-shrinking, while the main row receives whatever height remains.
- Responsive mode changes only at a viewport width of 899px and ignores the actual workspace container width and available height.
- `h-dvh`, `h-full`, `min-h-0`, and `overflow-hidden` are nested across the shell and workspace, producing clipping and unexpected height budgets.
- The toolbar wraps a large set of equally prominent controls, increasing its height and making Run difficult to find.
- Explorer uses a fixed 320px default despite dense rows and secondary actions.
- Repeated cards, borders, and padding reduce usable space without improving grouping.

## Chosen Structure

Use an adaptive workbench with two structural modes.

### Wide and Tall Workspace

```text
┌──────────────────────────────────────────────────────────────┐
│ Playwright Automation                              Tutorial │
├──────────────────────────────────────────────────────────────┤
│ Project / Source / Browser                                   │
│ Run mode / Agent status                         Reset / Run  │
├────────────────────┬─────────────────────────────────────────┤
│ Test Explorer      │ Code / Recipe / Results                │
│ 30–35%             │ primary flexible work area             │
├────────────────────┴─────────────────────────────────────────┤
│ Terminal · job state · unread count              Show/Hide  │
├──────────────────────────────────────────────────────────────┤
│ Log body, bounded to the remaining workspace                │
└──────────────────────────────────────────────────────────────┘
```

- Explorer and Code share the primary flexible row.
- Explorer width is `clamp(280px, 32%, 400px)` and remains resizable within those bounds.
- Terminal is collapsed by default for new preferences.
- Expanded Terminal uses a minimum of 160px and a maximum of the smaller of 280px or 28% of the measured workspace height.
- A main-row minimum height of 320px is protected before Terminal receives additional height.
- The Terminal header remains visible while collapsed and shows running state and unread-log count.
- Starting a job does not steal focus. It may expose running state in the header but does not force the body open.

### Narrow or Short Workspace

```text
┌──────────────────────────────┐
│ Project / Browser / Run      │
├──────────────────────────────┤
│ Explorer | Code | Terminal   │
├──────────────────────────────┤
│ exactly one visible panel    │
│ document scrolls naturally   │
└──────────────────────────────┘
```

- Enter tab mode when the workspace container is narrower than 860px or when its measured usable height cannot preserve a 320px main row plus the compact toolbar.
- Only the selected Explorer, Code, or Terminal panel participates in visible layout.
- The page scrolls vertically; selected panel content may scroll internally after a 360px minimum height.
- Terminal receives no inline pixel height in tab mode.
- Resizers are absent in tab mode.
- Switching modes preserves selected tests, editor contents, logs, active job, and active tab.

## Height Budget

One component owns the workspace measurement. It derives available height from the workspace root with `ResizeObserver`, rather than reading `window.innerHeight` inside panel components.

The layout allocates space in this order:

1. workspace heading and status messages;
2. toolbar at its rendered height;
3. main row with a protected 320px minimum;
4. Terminal header and separator;
5. Terminal body using only the remaining bounded allowance.

Stored terminal heights are reclamped whenever the workspace measurement changes. An old stored 60%-viewport value cannot reopen into an oversized panel.

## Toolbar

Split the toolbar into two visually distinct zones without adding another card.

- Configuration zone: Project, source, browser.
- Execution zone: run mode, Agent state, Reset, Run or Cancel.
- Run or Cancel remains at the trailing edge on wide screens and at the end of the second row at medium widths.
- Secondary descriptions disappear before controls wrap.
- Controls keep 44px touch targets in tab mode.
- Project and browser labels remain visible so the user can verify the target before running.

## Panel Surfaces and Density

- Use one outer workbench surface with dividers. Do not nest a bordered card around each internal group.
- Explorer rows show title, path, selection, and status by default. Secondary actions move into Details or a compact overflow action.
- Use 8–12px gaps inside related control groups, 16–20px panel padding, and 24–32px between distinct page regions.
- Remove unsupported `py-0.2` utilities and use explicit spacing from the 4px scale.
- Terminal log rows retain compact density but reduce outer padding on narrow screens.

## State and Persistence

Persist the existing safe preferences under a new versioned layout key or migrate version 1 values once:

- Explorer width;
- Terminal height after workspace-aware clamping;
- Terminal collapsed state;
- active narrow-mode tab.

New defaults set Terminal to collapsed. Invalid, oversized, or old viewport-relative values fall back to safe values. Reset layout applies the new defaults without clearing selected tests, login state, or Agent data.

## Accessibility

- Tabs retain tablist, tab, and tabpanel semantics and arrow-key navigation.
- Separators remain keyboard-operable and expose current, minimum, and maximum values.
- Terminal state is conveyed through text as well as color.
- Focus remains visible on toolbar controls, tabs, separators, and Terminal toggle.
- Narrow controls retain at least 44×44px targets.
- Layout changes do not move focus automatically.

## Error and Edge Cases

- Execution Unlock and run-error banners consume normal document space and trigger a fresh height measurement.
- A two-row toolbar cannot reduce the main row below 320px; the layout switches to tab mode first.
- Browser zoom, Thai translations, and long project names may wrap labels without causing horizontal document scrolling.
- When Terminal contains long unbroken output, only the log line wraps or scrolls; it cannot widen the workbench.
- If `ResizeObserver` is unavailable, width-based tab mode and conservative terminal bounds are used.

## Testing

- Unit tests cover the new layout defaults, migration, terminal clamping against workspace height, and short-height mode.
- Component tests cover wide split mode, narrow tab mode, short viewport behavior, Terminal collapse, Reset layout, and stable Run placement.
- Regression tests assert a 320px minimum main row whenever desktop mode is active.
- Regression tests assert that tab-mode Terminal receives no fixed inline height.
- Responsive browser checks cover 1440×900, 1024×640, 900×700, 613×739, and 390×844.
- Visual verification confirms no overlap, no horizontal document scroll, and no clipped Run or Terminal controls.

## Acceptance

```text
Open /monitor/tests at 1440×900
→ Explorer and Code share the primary row
→ Terminal starts collapsed and can be expanded
→ expanded Terminal never exceeds 28% of measured workspace height
→ main row remains at least 320px tall

Resize to 1024×640
→ toolbar may use two ordered rows
→ Run remains visible
→ Terminal cannot compress the main row below 320px

Resize to 613×739 or 390×844
→ Explorer, Code, and Terminal appear as tabs
→ only one panel is visible
→ document scrolls naturally
→ Terminal does not use a fixed pixel height
→ no panel overlaps another panel

Reload with old saved layout preferences
→ values migrate or clamp to safe bounds
→ Reset layout restores the new collapsed-Terminal default
```

## Out of Scope

- Changes to Playwright execution, Redis jobs, Local Agent protocol, catalog discovery, or pairing.
- Floating, detachable, or multi-window panels.
- Multiple editor tabs.
- A new visual theme or navigation redesign outside `/monitor/tests`.
- Rewriting Test Explorer data or runner APIs.
