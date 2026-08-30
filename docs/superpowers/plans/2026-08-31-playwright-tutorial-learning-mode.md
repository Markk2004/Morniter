# Playwright Tutorial Learning Mode Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a review checkpoint after every task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-heavy Playwright spotlight tutorial with the approved full-screen Learning mode containing step icons, mini UI diagrams, chapter navigation, and production-ready responsive behavior.

**Architecture:** Keep tutorial state and persistence in the existing hook. Extend the typed step catalog with fixed visual identifiers, render local SVG icons and mini UI diagrams through dedicated components, and make `PlaywrightTutorial` responsible only for dialog behavior and responsive composition.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright E2E.

## Global Constraints

- Git operations remain user-managed; implementation must not run Git commands.
- Use Learning mode every time Tutorial opens.
- Keep all nine existing tutorial targets and storage behavior.
- Use local React/SVG visuals only; do not add external images, screenshots, URLs, or an icon dependency.
- Do not use gradients, gradient text, glassmorphism, decorative grid backgrounds, or card radii above 16 pixels.
- Preserve keyboard navigation, focus trap, focus restoration, `inert`, unavailable states, and reduced-motion behavior.
- Support desktop and a 320 CSS pixel viewport without horizontal page scrolling.

---

### Task 1: Extend the Tutorial Catalog with Visual Metadata

**Files:**
- Modify: `src/components/playwright-runner/tutorial/tutorial-steps.ts`
- Test: `tests/unit/playwright-runner/tutorial-steps.test.ts`

**Interfaces:**
- Produces `TutorialIconName` and `TutorialVisualKind` unions.
- Extends every `TutorialStep` with `chapter`, `icon`, and `visual`.

- [ ] **Step 1: Add failing catalog assertions**

Assert that all nine entries have a supported icon, visual, and one of the three approved chapters, and that their IDs and target IDs remain unique.

```ts
const icons = new Set(PLAYWRIGHT_TUTORIAL_STEPS.map((step) => step.icon));
const visuals = new Set(PLAYWRIGHT_TUTORIAL_STEPS.map((step) => step.visual));

expect(PLAYWRIGHT_TUTORIAL_STEPS).toHaveLength(9);
expect(icons.size).toBe(9);
expect(visuals.size).toBe(9);
expect(PLAYWRIGHT_TUTORIAL_STEPS.every((step) => step.chapter.length > 0)).toBe(true);
```

Run:

```powershell
npx vitest run tests/unit/playwright-runner/tutorial-steps.test.ts
```

Expected: FAIL because the visual fields do not exist.

- [ ] **Step 2: Add exact visual unions and metadata**

Define the exact names below and assign one to each existing step:

```ts
export type TutorialIconName =
  | "agent"
  | "lock"
  | "project"
  | "test"
  | "browser"
  | "code"
  | "run"
  | "terminal"
  | "result";

export type TutorialVisualKind = TutorialIconName;
export type TutorialChapter = "เตรียมระบบ" | "เลือกการทดสอบ" | "รันและตรวจผล";
```

Map steps 1–2 to `เตรียมระบบ`, steps 3–6 to `เลือกการทดสอบ`, and steps 7–9 to `รันและตรวจผล`.

- [ ] **Step 3: Verify the catalog contract**

```powershell
npx vitest run tests/unit/playwright-runner/tutorial-steps.test.ts
npm run typecheck
```

Expected: both commands pass.

---

### Task 2: Build the Fixed Icon and Mini-Diagram Library

**Files:**
- Create: `src/components/playwright-runner/tutorial/TutorialIcon.tsx`
- Create: `src/components/playwright-runner/tutorial/TutorialVisual.tsx`
- Create: `tests/components/playwright-runner/TutorialVisual.test.tsx`

**Interfaces:**
- Produces `TutorialIcon({ name, className? })`.
- Produces `TutorialVisual({ kind })`.
- Both consume only the unions from `tutorial-steps.ts`.

- [ ] **Step 1: Write failing renderer tests**

Render all nine names and assert that each icon has one SVG, each diagram exposes a stable `data-tutorial-visual`, and decorative output is hidden from assistive technology.

```tsx
for (const name of TUTORIAL_ICON_NAMES) {
  const { container, unmount } = render(<TutorialIcon name={name} />);
  expect(container.querySelectorAll("svg")).toHaveLength(1);
  expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  unmount();
}
```

Run:

```powershell
npx vitest run tests/components/playwright-runner/TutorialVisual.test.tsx
```

Expected: FAIL because the renderers do not exist.

- [ ] **Step 2: Implement the icon renderer**

Use a fixed `switch` that returns standard outline SVG paths with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, and `aria-hidden="true"`. Do not accept arbitrary SVG or path data.

- [ ] **Step 3: Implement the nine mini UI diagrams**

Use semantic divs and restrained Tailwind classes to represent:

```text
agent    -> online status row
lock     -> password field and unlock action
project  -> selected project control
test     -> grouped test rows and checkbox
browser  -> browser and headless choices
code     -> editor lines with one highlighted statement
run      -> queued, running, passed process
terminal -> tagged stdout and stderr lines
result   -> browser result rows and artifact action
```

Each diagram must have `data-tutorial-visual={kind}`, `aria-hidden="true"`, no interactive controls, and no gradient classes.

- [ ] **Step 4: Verify visual renderers**

```powershell
npx vitest run tests/components/playwright-runner/TutorialVisual.test.tsx
npm run typecheck
```

Expected: both commands pass.

---

### Task 3: Build Chapter Navigation and Full-Screen Learning Mode

**Files:**
- Create: `src/components/playwright-runner/tutorial/TutorialStepRail.tsx`
- Modify: `src/components/playwright-runner/tutorial/PlaywrightTutorial.tsx`
- Modify: `tests/components/playwright-runner/PlaywrightTutorial.test.tsx`

**Interfaces:**
- Produces `TutorialStepRail({ steps, currentStepIndex, onStepChange })`.
- `PlaywrightTutorial` continues using its existing public props without changing `PlaywrightWorkspace.tsx`.

- [ ] **Step 1: Add failing Learning mode tests**

Assert that the dialog renders a step rail, current chapter, distinct icon, mini diagram, Previous/Next actions, and no spotlight element. Keep the existing keyboard and focus assertions.

```tsx
expect(screen.getByRole("navigation", { name: "Tutorial steps" })).toBeInTheDocument();
expect(screen.getByTestId("tutorial-learning-stage")).toBeInTheDocument();
expect(screen.getByTestId("tutorial-visual-agent")).toBeInTheDocument();
expect(document.querySelector("[data-tutorial-spotlight]")).not.toBeInTheDocument();
```

Run:

```powershell
npx vitest run tests/components/playwright-runner/PlaywrightTutorial.test.tsx
```

Expected: FAIL because the current component still renders the spotlight modal.

- [ ] **Step 2: Implement the step rail**

Render one native button per step. Use `aria-current="step"` for the current step, a check icon plus text for completed steps, and chapter labels only when the chapter changes. Keep every button keyboard reachable.

- [ ] **Step 3: Replace spotlight layout with Learning mode**

Remove spotlight coordinate state, scroll listeners, target measurement, and spotlight cutout. Render a full-screen overlay with:

```text
desktop:  240px step rail | flexible learning stage
mobile:   compact progress summary above one-column learning stage
stage:    icon + chapter + title + description + mini diagram + unavailable message + actions
```

Use a solid `slate-950` backdrop, `slate-900` surface, one indigo active accent, maximum 16-pixel radii, and no decorative shadow wider than 8 pixels.

- [ ] **Step 4: Preserve dialog behavior**

Keep `inert`, `aria-hidden`, focus trap, Escape close, focus restoration, arrow navigation, direct step navigation, Skip, Previous, Next, and Finish. Reduce transitions to 150–200 milliseconds and disable movement under reduced motion.

- [ ] **Step 5: Verify the component**

```powershell
npx vitest run tests/components/playwright-runner/PlaywrightTutorial.test.tsx tests/components/playwright-runner/TutorialVisual.test.tsx
npm run typecheck
```

Expected: all commands pass.

---

### Task 4: Verify Workspace Integration, Responsive Behavior, and Accessibility

**Files:**
- Modify: `tests/components/playwright-runner/PlaywrightWorkspace.test.tsx`
- Modify: `e2e/monitor.spec.ts`
- Modify: `src/app/globals.css` only if a reduced-motion utility cannot be expressed with existing Tailwind classes

**Interfaces:**
- Confirms the existing tutorial hook and workspace button open the same Learning mode.
- Adds no new API request or persistent storage key.

- [ ] **Step 1: Extend workspace tests**

Assert automatic first-open and manual reopen both display `tutorial-learning-stage`, and finishing still writes `morniter:playwright-tutorial:v1:seen="true"`.

- [ ] **Step 2: Extend authenticated browser E2E**

At desktop width, verify rail navigation, arrow navigation, focus containment, Finish, and restored trigger focus. At 320x720, verify that the active step, icon, diagram, description, and Next action are visible without horizontal document overflow.

```ts
await page.setViewportSize({ width: 320, height: 720 });
await expect(page.getByTestId("tutorial-learning-stage")).toBeVisible();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(overflow).toBe(false);
```

- [ ] **Step 3: Add static style guards**

Add a source assertion covering the tutorial directory:

```ts
expect(tutorialSource).not.toMatch(/gradient|backdrop-blur/);
expect(tutorialSource).not.toMatch(/https?:\/\//);
```

- [ ] **Step 4: Run focused integration gates**

```powershell
npx vitest run tests/unit/playwright-runner/tutorial-steps.test.ts tests/components/playwright-runner/TutorialVisual.test.tsx tests/components/playwright-runner/PlaywrightTutorial.test.tsx tests/components/playwright-runner/PlaywrightWorkspace.test.tsx
npm run test:e2e
```

Expected: unit/component tests pass and authenticated E2E passes when test credentials are configured; the existing documented skip behavior remains unchanged when they are absent.

---

### Task 5: Run Release Checks and Update Plan Status

**Files:**
- Modify: `docs/superpowers/plans/STATUS.md`
- Modify: `docs/superpowers/plans/2026-08-31-playwright-tutorial-learning-mode.md`

**Interfaces:**
- Marks this plan complete only after automated checks and manual desktop/mobile review pass.

- [ ] **Step 1: Run the complete automated gate**

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: every command exits with code 0.

- [ ] **Step 2: Perform visual acceptance**

Verify all nine steps at desktop and 320-pixel width. Confirm icons are distinct, mini diagrams match their steps, active/completed/upcoming states are understandable without color alone, text does not clip, and no gradient appears.

- [ ] **Step 3: Update team status from evidence**

Record the observed test count and verification date in `STATUS.md`. Move this plan from Active work to Completed local implementation records only after Steps 1–2 pass.

## Acceptance Checklist

- [ ] Learning mode C opens every time Tutorial is opened.
- [ ] All nine steps have distinct icons and mini UI diagrams.
- [ ] Desktop rail and mobile summary navigate correctly.
- [ ] No gradient, external image, or screenshot dependency exists.
- [ ] Keyboard, focus, storage, unavailable-state, and reduced-motion behavior remain intact.
- [ ] Desktop and 320-pixel layouts pass visual acceptance.
- [ ] Typecheck, lint, Vitest, E2E, and production build pass.
