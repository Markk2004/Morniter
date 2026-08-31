# Playwright Tutorial Learning Mode Design

## Status

Approved for implementation on 2026-08-31.

## Goal

Replace the current text-heavy spotlight tutorial with a full-screen Learning mode that explains the Playwright workflow using a clear icon, a small UI diagram, concise Thai copy, and visible chapter navigation for every step.

## Confirmed decisions

- Replace the workspace with full-screen Learning mode while it is open; do not render a modal or spotlight above the workspace.
- Open automatically only on the first successful catalog load. Manual reopen always starts at step 1.
- Keep the existing nine-step workflow and storage behavior.
- Use icons and code-rendered mini UI diagrams as the primary visuals.
- Do not depend on screenshots or external image URLs.
- Do not use gradient backgrounds, gradient text, decorative glass effects, or oversized rounded cards.
- Preserve the existing dark product visual language.

## Information architecture

Desktop uses two regions:

1. A narrow left rail listing all nine steps, completed steps, the current step, and upcoming steps.
2. A main learning stage containing the step icon, mini UI diagram, title, description, unavailable-state message, and navigation actions.

On narrow screens the rail becomes a compact summary above the learning stage: `ขั้นตอน N/9 · ชื่อขั้นตอน`. A button opens the complete step list as an accessible bottom sheet. The content must fit at 320 CSS pixels without horizontal scrolling.

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
- Next slides the learning stage from right to left in 180–220 milliseconds.
- Previous slides the learning stage from left to right in 180–220 milliseconds.
- Direct step selection fades the learning stage without directional movement.
- All movement becomes instant under `prefers-reduced-motion`.

## Interaction

- `ArrowRight` and `ArrowDown` advance.
- `ArrowLeft` and `ArrowUp` go back.
- `Escape` closes without marking the tutorial as seen and restores focus to the Tutorial button.
- `Tab` follows normal page order inside Learning mode; only the mobile bottom sheet traps focus while open.
- Clicking a rail step jumps directly to it.
- `ออกจาก Tutorial` closes without writing completion state.
- `ข้าม Tutorial` writes the seen state and closes.
- The last-step `เริ่มใช้งาน` action writes the seen state and closes.
- Opening Tutorial manually always starts at step 1 in the same Learning mode UI; it does not fall back to the old spotlight.
- Tutorial must not auto-open while a test job is already running.

## Accessibility

- Use a labelled `role="region"` for Learning mode because it replaces workspace content instead of opening a modal.
- The mobile step-list bottom sheet uses `role="dialog"`, `aria-modal="true"`, focus containment, Escape close, and focus restoration to its trigger.
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
- `PlaywrightTutorial.module.css`: directional and reduced-motion transitions only.
- `PlaywrightTutorial.tsx`: learning-view layout, stage navigation, focus restoration, and keyboard handling.
- Existing tutorial hook remains the source of open/close/progress/storage state and distinguishes close from skip/finish persistence.

## Acceptance

- Every step displays a distinct icon and mini UI diagram.
- Tutorial replaces the workspace instead of covering it.
- Tutorial opens automatically only once after a successful catalog load; manual reopen starts at step 1.
- Next, Previous, and direct selection use the confirmed directional transitions.
- Desktop rail and mobile bottom sheet navigate to all nine steps.
- Close does not persist seen state; Skip and Finish do.
- No gradient styling or external image request is introduced.
- Desktop and 320-pixel layouts remain usable without clipping.
- Keyboard, focus restoration, reduced motion, unavailable states, and storage behavior continue to pass automated tests.
