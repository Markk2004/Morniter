"use client";

import React, { useEffect, useState } from "react";
import {
  PLAYWRIGHT_TUTORIAL_STEPS,
  type TutorialTargetId,
} from "./tutorial-steps";
import TutorialIcon from "./TutorialIcon";
import TutorialVisual from "./TutorialVisual";
import TutorialStepRail from "./TutorialStepRail";
import styles from "./PlaywrightTutorial.module.css";

export interface PlaywrightTutorialProps {
  isOpen: boolean;
  currentStepIndex: number;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  workspaceRootId?: string;
  unavailableTargetIds?: readonly TutorialTargetId[];
  onClose: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStepChange: (index: number) => void;
}

export function PlaywrightTutorial({
  isOpen,
  currentStepIndex,
  returnFocusRef,
  unavailableTargetIds,
  onClose,
  onSkip,
  onFinish,
  onNext,
  onPrevious,
  onStepChange,
}: PlaywrightTutorialProps) {
  const [transitionDirection, setTransitionDirection] = useState<"idle" | "next" | "prev" | "fade">("idle");
  const step = PLAYWRIGHT_TUTORIAL_STEPS[currentStepIndex] || PLAYWRIGHT_TUTORIAL_STEPS[0];
  const isLastStep = currentStepIndex === PLAYWRIGHT_TUTORIAL_STEPS.length - 1;

  // Restore focus only when Learning mode closes or unmounts, not between steps.
  useEffect(() => {
    if (!isOpen) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const returnFocusEl = returnFocusRef.current;

    return () => {
      if (returnFocusEl) {
        returnFocusEl.focus();
      } else if (previousActive) {
        previousActive.focus();
      }
    };
  }, [isOpen, returnFocusRef]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!isLastStep) {
          setTransitionDirection("next");
          onNext();
        }
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentStepIndex > 0) {
          setTransitionDirection("prev");
          onPrevious();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, onNext, onPrevious, isLastStep, currentStepIndex]);

  if (!isOpen) return null;

  const handleNext = () => {
    setTransitionDirection("next");
    onNext();
  };

  const handlePrevious = () => {
    setTransitionDirection("prev");
    onPrevious();
  };

  const handleDirectStep = (idx: number) => {
    setTransitionDirection("fade");
    onStepChange(idx);
  };

  const targetElement = unavailableTargetIds === undefined && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(`[data-tutorial-id="${step.targetId}"]`)
    : null;
  const isTargetUnavailable = unavailableTargetIds !== undefined
    ? unavailableTargetIds.includes(step.targetId)
    : !targetElement || targetElement.getAttribute("data-tutorial-state") === "unavailable";

  const getAnimationClass = () => {
    if (transitionDirection === "next") return styles.stageNext;
    if (transitionDirection === "prev") return styles.stagePrev;
    if (transitionDirection === "fade") return styles.stageFade;
    return "";
  };

  return (
    <div
      role="region"
      aria-label="Playwright Automation Learning Mode"
      className="w-full rounded-2xl border border-slate-800 bg-slate-950 flex flex-col md:flex-row overflow-hidden shadow-2xl min-h-[560px]"
    >
      {/* Step Rail Navigation (Desktop Rail & Mobile Summary / Bottom Sheet) */}
      <TutorialStepRail
        steps={PLAYWRIGHT_TUTORIAL_STEPS}
        currentStepIndex={currentStepIndex}
        onStepChange={handleDirectStep}
      />

      {/* Main Learning Stage */}
      <div className="flex-1 flex flex-col justify-between bg-slate-900/40 p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div
          key={step.id}
          data-testid="tutorial-learning-stage"
          data-transition={transitionDirection}
          className={`space-y-4 ${getAnimationClass()}`}
        >
          {/* Header & Close Action */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-950 border border-indigo-700/60 px-2.5 py-0.5 text-[11px] font-sans font-semibold text-indigo-300">
                {step.chapter}
              </span>
              <span className="text-xs font-mono text-slate-400">
                ขั้นตอน {currentStepIndex + 1} จาก {PLAYWRIGHT_TUTORIAL_STEPS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-sans text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            >
              ออกจาก Tutorial
            </button>
          </div>

          {/* Title & Icon Header */}
          <div className="flex items-start sm:items-center gap-3 pt-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 shadow-sm">
              <TutorialIcon name={step.icon} className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white font-sans">
                {step.title}
              </h2>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={currentStepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={PLAYWRIGHT_TUTORIAL_STEPS.length}
            aria-label={`Tutorial progress: Step ${currentStepIndex + 1} of ${PLAYWRIGHT_TUTORIAL_STEPS.length}`}
            className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"
          >
            <div
              className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${((currentStepIndex + 1) / PLAYWRIGHT_TUTORIAL_STEPS.length) * 100}%`,
              }}
            />
          </div>

          {/* Step Description */}
          <p id="tutorial-step-desc" className="text-sm text-slate-300 leading-relaxed font-sans">
            {step.description}
          </p>

          {/* Mini UI Diagram */}
          <div className="pt-2 pb-1">
            <TutorialVisual kind={step.visual} />
          </div>

          {/* Unavailable Notice */}
          {isTargetUnavailable && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-mono text-amber-300">
              ℹ️ {step.unavailableMessage}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-6">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-sans text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            ข้าม Tutorial
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={handlePrevious}
              className="px-3.5 py-1.5 text-xs font-sans font-medium rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
            >
              Previous
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={onFinish}
                className="px-4 py-1.5 text-xs font-sans font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 cursor-pointer transition"
              >
                เริ่มใช้งาน
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 text-xs font-sans font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 cursor-pointer transition"
              >
                Next Step →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaywrightTutorial;
