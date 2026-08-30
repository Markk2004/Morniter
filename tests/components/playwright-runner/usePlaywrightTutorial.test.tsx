// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { usePlaywrightTutorial } from "@/components/playwright-runner/tutorial/usePlaywrightTutorial";
import { TUTORIAL_STORAGE_KEY } from "@/components/playwright-runner/tutorial/tutorial-steps";

describe("usePlaywrightTutorial hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens once when catalog is ready and seen key is absent", () => {
    const { result, rerender } = renderHook(
      ({ ready, error }) => usePlaywrightTutorial(ready, error),
      { initialProps: { ready: false, error: false } },
    );

    expect(result.current.isOpen).toBe(false);

    rerender({ ready: true, error: false });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.currentStepIndex).toBe(0);
  });

  it("does not auto-open if catalog failed with an error", () => {
    const { result } = renderHook(() => usePlaywrightTutorial(true, true));
    expect(result.current.isOpen).toBe(false);
  });

  it("does not auto-open when seen key already exists in localStorage", () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    const { result } = renderHook(() => usePlaywrightTutorial(true, false));
    expect(result.current.isOpen).toBe(false);
  });

  it("manually opens starting at step 0 via openTutorial()", () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    const { result } = renderHook(() => usePlaywrightTutorial(true, false));
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openTutorial();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.currentStepIndex).toBe(0);
  });

  it.each(["closeTutorial", "skipTutorial", "finishTutorial"] as const)(
    "%s closes modal and marks seen in localStorage",
    (action) => {
      const { result } = renderHook(() => usePlaywrightTutorial(true, false));
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current[action]();
      });

      expect(result.current.isOpen).toBe(false);
      expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe("true");
    },
  );

  it("navigates forward, backward and directly with index clamping", () => {
    const { result } = renderHook(() => usePlaywrightTutorial(true, false));

    // Step 0 -> previous should stay at 0
    act(() => {
      result.current.previousStep();
    });
    expect(result.current.currentStepIndex).toBe(0);

    // Step 0 -> nextStep -> 1
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(1);

    // Direct navigation
    act(() => {
      result.current.goToStep(5);
    });
    expect(result.current.currentStepIndex).toBe(5);

    // Over-limit navigation clamped to 8
    act(() => {
      result.current.goToStep(99);
    });
    expect(result.current.currentStepIndex).toBe(8);

    // Step 8 -> nextStep should stay at 8
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(8);
  });

  it("gracefully handles localStorage access exceptions", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });

    const { result } = renderHook(() => usePlaywrightTutorial(true, false));
    expect(result.current.isOpen).toBe(false);

    // Manual open still functions
    act(() => {
      result.current.openTutorial();
    });
    expect(result.current.isOpen).toBe(true);
  });
});
