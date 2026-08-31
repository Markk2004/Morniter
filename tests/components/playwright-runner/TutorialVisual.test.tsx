// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TutorialIcon from "@/components/playwright-runner/tutorial/TutorialIcon";
import TutorialVisual from "@/components/playwright-runner/tutorial/TutorialVisual";
import type { TutorialIconName, TutorialVisualKind } from "@/components/playwright-runner/tutorial/tutorial-steps";

const TUTORIAL_ICON_NAMES: TutorialIconName[] = [
  "agent",
  "lock",
  "project",
  "test",
  "browser",
  "code",
  "run",
  "terminal",
  "result",
];

const TUTORIAL_VISUAL_KINDS: TutorialVisualKind[] = [
  "agent",
  "lock",
  "project",
  "test",
  "browser",
  "code",
  "run",
  "terminal",
  "result",
];

afterEach(() => {
  cleanup();
});

describe("TutorialIcon & TutorialVisual renderers", () => {
  it("renders all nine fixed icons with stable SVG attributes and aria-hidden", () => {
    for (const name of TUTORIAL_ICON_NAMES) {
      const { container, unmount } = render(<TutorialIcon name={name} className="w-6 h-6 text-indigo-400" />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      expect(svg).toHaveAttribute("fill", "none");
      expect(svg).toHaveAttribute("stroke", "currentColor");
      unmount();
    }
  });

  it("renders all nine mini diagrams with data-tutorial-visual and aria-hidden", () => {
    for (const kind of TUTORIAL_VISUAL_KINDS) {
      const { container, unmount } = render(<TutorialVisual kind={kind} />);
      const visualEl = container.querySelector(`[data-tutorial-visual="${kind}"]`);
      expect(visualEl).not.toBeNull();
      expect(visualEl).toHaveAttribute("aria-hidden", "true");
      expect(visualEl).toHaveAttribute("data-testid", `tutorial-visual-${kind}`);

      // Ensure no interactive form elements or links exist in static mini diagrams
      expect(visualEl?.querySelectorAll("button, input, select, textarea, a")).toHaveLength(0);
      unmount();
    }
  });
});
