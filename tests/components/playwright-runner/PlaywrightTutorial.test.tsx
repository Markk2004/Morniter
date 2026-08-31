// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PlaywrightTutorial } from "@/components/playwright-runner/tutorial/PlaywrightTutorial";

function StatefulTutorial({ returnFocusRef }: { returnFocusRef: React.RefObject<HTMLButtonElement | null> }) {
  const [stepIndex, setStepIndex] = React.useState(0);

  return (
    <PlaywrightTutorial
      isOpen={true}
      currentStepIndex={stepIndex}
      returnFocusRef={returnFocusRef}
      onClose={vi.fn()}
      onSkip={vi.fn()}
      onFinish={vi.fn()}
      onNext={() => setStepIndex((index) => index + 1)}
      onPrevious={() => setStepIndex((index) => index - 1)}
      onStepChange={setStepIndex}
    />
  );
}

describe("PlaywrightTutorial component", () => {
  beforeEach(() => {
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

  it("renders full-screen Learning mode region with step rail and mini diagram", () => {
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

    const region = screen.getByRole("region", { name: /Playwright Automation Learning Mode/i });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Tutorial steps" })).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-learning-stage")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-visual-agent")).toBeInTheDocument();
    expect(screen.getByText("ขั้นตอน 1 จาก 9")).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบ Local Agent")).toBeInTheDocument();

    // Assert that old spotlight elements are NOT rendered
    expect(document.querySelector("[data-tutorial-spotlight]")).toBeNull();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "9");
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

    // Direct step jump in rail
    const step3Btns = screen.getAllByRole("button", { name: /Project/i });
    fireEvent.click(step3Btns[0]);
    expect(onStepChange).toHaveBeenCalledWith(2);

    // Last step renders Finish / เริ่มใช้งาน button
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

    const finishBtn = screen.getByRole("button", { name: /เริ่มใช้งาน/i });
    fireEvent.click(finishBtn);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("keeps focus in Learning mode and exposes the slide direction after Next", () => {
    const triggerBtn = document.createElement("button");
    document.body.appendChild(triggerBtn);
    const returnFocusRef = { current: triggerBtn };

    render(<StatefulTutorial returnFocusRef={returnFocusRef} />);

    const nextButton = screen.getByRole("button", { name: /Next Step/i });
    nextButton.focus();
    fireEvent.click(nextButton);

    expect(screen.getByText("ปลดล็อกการรัน Test")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-learning-stage")).toHaveAttribute(
      "data-transition",
      "next",
    );
    expect(document.activeElement).toBe(nextButton);
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
});
