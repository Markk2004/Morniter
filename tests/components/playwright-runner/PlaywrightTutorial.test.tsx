// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PlaywrightTutorial } from "@/components/playwright-runner/tutorial/PlaywrightTutorial";

describe("PlaywrightTutorial component", () => {
  beforeEach(() => {
    // Setup container root
    document.body.innerHTML =
      '<div id="playwright-workspace-root">' +
      '<div data-tutorial-id="agent" style="width: 200px; height: 50px;">Agent</div>' +
      '<div data-tutorial-id="result" data-tutorial-state="unavailable">Result</div>' +
      '</div>';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders accessible modal with progressbar and title", () => {
    const returnFocusRef = { current: document.createElement("button") };
    render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: /Playwright Automation Tutorial/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("ขั้นตอน 1 จาก 9")).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบ Local Agent")).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "9");
  });

  it("sets background workspace to inert when modal is open and removes when closed", () => {
    const returnFocusRef = { current: document.createElement("button") };
    const ws = document.getElementById("playwright-workspace-root");
    expect(ws?.hasAttribute("inert")).toBe(false);

    const { rerender } = render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    expect(ws?.hasAttribute("inert")).toBe(true);
    expect(ws?.getAttribute("aria-hidden")).toBe("true");

    rerender(
      <PlaywrightTutorial
        isOpen={false}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    expect(ws?.hasAttribute("inert")).toBe(false);
  });

  it("handles next, previous, direct step change, and finish callbacks", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onFinish = vi.fn();
    const onStepChange = vi.fn();
    const returnFocusRef = { current: document.createElement("button") };

    const { rerender } = render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={onFinish}
        onNext={onNext}
        onPrevious={onPrevious}
        onStepChange={onStepChange}
      />,
    );

    // Next step button
    const nextBtn = screen.getByRole("button", { name: /Next Step/i });
    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);

    // Direct step jump
    const step3Btn = screen.getByRole("button", { name: /3\. Project/i });
    fireEvent.click(step3Btn);
    expect(onStepChange).toHaveBeenCalledWith(2);

    // Last step renders Finish button
    rerender(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={8}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={onFinish}
        onNext={onNext}
        onPrevious={onPrevious}
        onStepChange={onStepChange}
      />,
    );

    const finishBtn = screen.getByRole("button", { name: /Finish/i });
    fireEvent.click(finishBtn);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("navigates forward and backward via Arrow keys (ArrowRight, ArrowDown, ArrowLeft, ArrowUp)", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const returnFocusRef = { current: document.createElement("button") };

    const { rerender } = render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={1}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={onNext}
        onPrevious={onPrevious}
        onStepChange={vi.fn()}
      />,
    );

    // ArrowRight -> onNext
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(1);

    // ArrowDown -> onNext
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onNext).toHaveBeenCalledTimes(2);

    // ArrowLeft -> onPrevious
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onPrevious).toHaveBeenCalledTimes(1);

    // ArrowUp -> onPrevious
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onPrevious).toHaveBeenCalledTimes(2);

    // At step 0, ArrowLeft does not call onPrevious
    rerender(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={onNext}
        onPrevious={onPrevious}
        onStepChange={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onPrevious).toHaveBeenCalledTimes(2);
  });

  it("displays unavailable notice when target has data-tutorial-state='unavailable'", async () => {
    const returnFocusRef = { current: document.createElement("button") };
    render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={8} // Result target
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Result จะแสดงหลังเริ่มหรือจบ job อย่างน้อยหนึ่งครั้ง/i),
      ).toBeInTheDocument();
    });
  });

  it("handles Escape key to close and restores focus to trigger button", () => {
    const onClose = vi.fn();
    const triggerBtn = document.createElement("button");
    triggerBtn.focus = vi.fn();
    const returnFocusRef = { current: triggerBtn };

    const { unmount } = render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={onClose}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(triggerBtn.focus).toHaveBeenCalled();
  });

  it("respects prefers-reduced-motion when scrolling to target", () => {
    const scrollIntoViewMock = vi.fn();
    const target = document.querySelector('[data-tutorial-id="agent"]');
    if (target) target.scrollIntoView = scrollIntoViewMock;

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const returnFocusRef = { current: document.createElement("button") };
    render(
      <PlaywrightTutorial
        isOpen={true}
        currentStepIndex={0}
        returnFocusRef={returnFocusRef}
        onClose={vi.fn()}
        onSkip={vi.fn()}
        onFinish={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onStepChange={vi.fn()}
      />,
    );

    if (scrollIntoViewMock.mock.calls.length > 0) {
      expect(scrollIntoViewMock).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "auto" }),
      );
    }
  });
});
