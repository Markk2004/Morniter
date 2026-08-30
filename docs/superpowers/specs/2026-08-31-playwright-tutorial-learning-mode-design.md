# Playwright Tutorial Learning Mode Design

## Status

Approved for implementation on 2026-08-31.

## Goal

Replace the current text-heavy spotlight tutorial with a full-screen Learning mode that explains the Playwright workflow using a clear icon, a small UI diagram, concise Thai copy, and visible chapter navigation for every step.

## Confirmed decisions

- Use the full-screen Learning mode every time Tutorial opens, including manual reopen.
- Keep the existing nine-step workflow and storage behavior.
- Use icons and code-rendered mini UI diagrams as the primary visuals.
- Do not depend on screenshots or external image URLs.
- Do not use gradient backgrounds, gradient text, decorative glass effects, or oversized rounded cards.
- Preserve the existing dark product visual language.

## Information architecture

Desktop uses two regions:

1. A narrow left rail listing all nine steps, completed steps, the current step, and upcoming steps.
2. A main learning stage containing the step icon, mini UI diagram, title, description, unavailable-state message, and navigation actions.

On narrow screens the rail becomes a compact horizontal step summary above the learning stage. The content must fit at 320 CSS pixels without horizontal scrolling.

## Step model

Each `TutorialStep` adds:

```ts
type TutorialIconName =
  | "agent"
  | "lock"
  | "project"
  | "test"
  | "browser"
  | "code"
  | "run"
  | "terminal"
  | "result";

type TutorialVisualKind = TutorialIconName;

interface TutorialStep {
  id: `step-${number}`;
  targetId: TutorialTargetId;
  label: string;
  chapter: "เตรียมระบบ" | "เลือกการทดสอบ" | "รันและตรวจผล";
  icon: TutorialIconName;
  visual: TutorialVisualKind;
  title: string;
  description: string;
  unavailableMessage: string;
}
```

The visual name is data only. It selects a fixed local React component; it cannot inject markup, image paths, or URLs.

## Visual system

- Icons use one consistent 24-pixel outline style and inherit `currentColor`.
- Mini diagrams reproduce only the relevant control: status indicator, lock form, project selector, test tree, browser choices, editor, run process, terminal lines, or result summary.
- Accent color marks only the current step and primary action.
- Completed steps use icon plus text, not color alone.
- Inactive steps remain readable but visually quieter.
- Transitions last 150–200 milliseconds and become instant under `prefers-reduced-motion`.

## Interaction

- `ArrowRight` and `ArrowDown` advance.
- `ArrowLeft` and `ArrowUp` go back.
- `Escape` closes and restores focus to the Tutorial button.
- `Tab` remains trapped inside Learning mode.
- Clicking a rail step jumps directly to it.
- Previous, Next, Finish, Skip tutorial, and Close remain visible text actions.
- Opening Tutorial manually always starts the same Learning mode UI; it does not fall back to the old spotlight.

## Accessibility

- Use `role="dialog"`, `aria-modal="true"`, a labelled heading, and a described step body.
- The active rail item uses `aria-current="step"`.
- Decorative icons and diagrams use `aria-hidden="true"`.
- Progress exposes current and total step count to assistive technology.
- Unavailable-state text remains visible and does not block navigation.
- Focus indicators use the project focus style and must remain visible at every breakpoint.

## File boundaries

- `tutorial-steps.ts`: tutorial data and visual identifiers only.
- `TutorialIcon.tsx`: fixed icon renderer.
- `TutorialVisual.tsx`: fixed mini diagram renderer.
- `TutorialStepRail.tsx`: chapter and step navigation.
- `PlaywrightTutorial.tsx`: dialog behavior, layout, focus, and keyboard handling.
- Existing tutorial hook remains the source of open/close/progress/storage state.

## Acceptance

- Every step displays a distinct icon and mini UI diagram.
- Tutorial opens as Learning mode both automatically and from the header button.
- No gradient styling or external image request is introduced.
- Desktop and 320-pixel layouts remain usable without clipping.
- Keyboard, focus restoration, reduced motion, unavailable states, and storage behavior continue to pass automated tests.

