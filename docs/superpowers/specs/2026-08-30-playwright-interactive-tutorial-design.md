# Playwright Interactive Tutorial Design

## Goal

Add a Tutorial button to `/monitor/tests` and provide a nine-step interactive walkthrough that explains the real Playwright workspace without changing selections, unlocking execution, or starting a test.

## User experience

The tutorial opens automatically once on each browser after the Playwright catalog finishes loading. Closing, skipping, or completing it records the same browser-local completion flag. A permanent `Tutorial` button beside the workspace heading can reopen it at any time.

The walkthrough uses Thai explanations while retaining the English names shown by the product, including Agent, Execution Lock, Project, Select Test, Browsers, Code, Run, Terminal, and Result.

The nine steps are:

1. Agent: explain online, offline, and lagging presence.
2. Execution Lock: explain that the shared group password authorizes test execution and that the tutorial never unlocks it automatically.
3. Project: explain that a project selects the catalog published by its Local Agent.
4. Select Test: explain groups, search, checkbox selection, and opening source by clicking a test title.
5. Browsers: explain that only Agent-supported browsers can be selected.
6. Code: explain source preview, local editing behavior, and reset without implying that arbitrary browser code is executed.
7. Run: explain validation, queued execution, cancellation, and the requirement for an online Agent and unlocked execution.
8. Terminal: explain realtime system, stdout, and stderr lines and the expected running progress.
9. Result: explain browser result state, failure details, artifacts, and job history.

Each step has Back and Next controls, direct sidebar navigation, current-step progress, keyboard focus management, and Escape-to-close behavior. The last step replaces Next with Finish.

## Interaction model

The tutorial uses an overlay, a focused information panel, and a spotlight around the corresponding live component. Each target component exposes a stable `data-tutorial-id` attribute. The tutorial resolves the target after rendering, scrolls it into view with reduced-motion support, and recalculates its position after resize or layout changes.

The information panel follows the attached visual direction: dark surface, solid colors, compact sidebar, progress indicator, and clear footer controls. It must use the existing Morniter design tokens and must not introduce gradients. On desktop, the panel sits beside the spotlight when space allows. On smaller supported windows, the content panel becomes a centered modal while the target remains identified by its label.

If a target is absent because of application state, the tutorial remains usable. It displays the step explanation and a message describing when the component appears. For example, Result explains that results appear after a job starts or finishes. It must not create fake results or mutate runner state to reveal a target.

## State and persistence

Tutorial state is browser-only and does not use Redis or an API. The completion key is versioned so a future material rewrite can be shown once again:

```text
morniter:playwright-tutorial:v1:seen
```

The value is the string `true`. Reading and writing are guarded for server rendering, unavailable storage, and privacy modes. If storage fails, the manual button continues to work and the current tutorial session remains functional. Automatic opening occurs only after catalog loading finishes and only when the completion key is absent.

The following actions mark the tutorial seen:

- Skip Tutorial
- close button
- Escape
- Finish on step 9

Back, Next, and direct step navigation do not write the completion flag.

## Component boundaries

`PlaywrightTutorial` owns open state presentation, step navigation, progress, keyboard handling, focus restoration, spotlight positioning, and missing-target fallback. Tutorial copy and target IDs live in a separate typed step catalog so content can be reviewed without reading positioning code.

`usePlaywrightTutorial` owns the first-visit storage contract and automatic-open decision. It exposes manual open and close actions to the page and does not read or modify `usePlaywrightRunner` state.

Existing workspace components only receive stable `data-tutorial-id` hooks or wrapper elements. They do not import tutorial state. This keeps Project Selector, Test Explorer, browser controls, editor, execution controls, terminal, and results independently testable.

## Accessibility

The information panel is an accessible dialog with a labelled title and description. Focus moves into the panel when opened and returns to the Tutorial button when closed. Tab stays inside the open panel. Back, Next, Skip, Close, direct steps, and Finish are native buttons with visible focus states.

The active step uses text and `aria-current`, not color alone. Progress is exposed with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a readable step label. Spotlight decoration is hidden from assistive technology. Motion follows `prefers-reduced-motion`.

## Failure handling

- Missing target: show the step normally with an unavailable-in-current-state note.
- Target removed while open: clear the spotlight and continue without closing.
- Storage unavailable: skip persistence without blocking the tutorial.
- Catalog request fails: do not auto-open over the error state; the manual Tutorial button remains available.
- Window resize or scroll: update the spotlight through one scheduled animation-frame calculation to avoid layout loops.

## Testing

Component tests verify manual open, automatic first visit, seen-state suppression, all closing paths, nine-step navigation, direct step selection, missing targets, focus trap, focus restoration, Escape, progress semantics, and no runner callbacks being invoked.

Workspace tests verify that every tutorial target ID is present in the correct component or has a documented missing-state fallback. Browser-level verification confirms first-login opening after catalog load, reopening from the button, scrolling to off-screen targets, persistence after closing the tab, and no test job being created by tutorial interaction.

## Acceptance criteria

- A Tutorial button is visible on `/monitor/tests`.
- The tutorial opens automatically only on the first completed catalog load for a browser.
- The tutorial contains the approved nine steps in the approved order.
- Each available step highlights and scrolls to the matching real UI component.
- Missing state-dependent targets show a useful explanation without fake data.
- Skip, Close, Escape, and Finish prevent future automatic opening while preserving manual reopening.
- Tutorial interaction never unlocks execution, changes project/browser/test selection, edits source, creates a job, or cancels a job.
- Keyboard navigation, focus behavior, progress semantics, and reduced motion are verified.
- The design uses solid colors and existing Morniter tokens without gradients.

## Scope exclusions

- No server-side tutorial progress or cross-device synchronization.
- No video, voice-over, analytics, or remote content management.
- No automatic clicking, project selection, password entry, test selection, or execution.
- No changes to Local Agent, Redis job data, provider monitoring, or ProjectSTS business logic.
