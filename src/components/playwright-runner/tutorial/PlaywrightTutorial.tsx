"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { PLAYWRIGHT_TUTORIAL_STEPS } from "./tutorial-steps";

export interface PlaywrightTutorialProps {
  isOpen: boolean;
  currentStepIndex: number;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  workspaceRootId?: string;
  onClose: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStepChange: (index: number) => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function PlaywrightTutorial({
  isOpen,
  currentStepIndex,
  returnFocusRef,
  workspaceRootId = "playwright-workspace-root",
  onClose,
  onSkip,
  onFinish,
  onNext,
  onPrevious,
  onStepChange,
}: PlaywrightTutorialProps) {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const step = PLAYWRIGHT_TUTORIAL_STEPS[currentStepIndex] || PLAYWRIGHT_TUTORIAL_STEPS[0];
  const isLastStep = currentStepIndex === PLAYWRIGHT_TUTORIAL_STEPS.length - 1;

  // Manage inert on background workspace
  useEffect(() => {
    if (!isOpen) return;
    const ws = document.getElementById(workspaceRootId);
    if (ws) {
      ws.setAttribute("inert", "");
      ws.setAttribute("aria-hidden", "true");
    }

    return () => {
      if (ws) {
        ws.removeAttribute("inert");
        ws.removeAttribute("aria-hidden");
      }
    };
  }, [isOpen, workspaceRootId]);

  // Focus management & Escape key
  useEffect(() => {
    if (!isOpen) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const returnFocusEl = returnFocusRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!isLastStep) {
          onNext();
        }
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentStepIndex > 0) {
          onPrevious();
        }
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const firstButton = dialogRef.current?.querySelector<HTMLButtonElement>("button");
    firstButton?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (returnFocusEl) {
        returnFocusEl.focus();
      } else if (previousActive) {
        previousActive.focus();
      }
    };
  }, [isOpen, onClose, onNext, onPrevious, isLastStep, currentStepIndex, returnFocusRef]);

  // Calculate spotlight coordinates
  const updateSpotlight = useCallback(() => {
    if (!isOpen) return;
    const el = document.querySelector<HTMLElement>(`[data-tutorial-id="${step.targetId}"]`);

    if (!el || el.getAttribute("data-tutorial-state") === "unavailable") {
      setSpotlightRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setSpotlightRect(null);
      return;
    }

    const padding = 8;
    setSpotlightRect({
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [isOpen, step.targetId]);

  useEffect(() => {
    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateSpotlight);
    };

    scheduleUpdate();

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [updateSpotlight]);

  if (!isOpen) return null;

  // Determine synchronous target availability
  const targetElement = typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(`[data-tutorial-id="${step.targetId}"]`)
    : null;
  const isTargetUnavailable =
    !targetElement ||
    targetElement.getAttribute("data-tutorial-state") === "unavailable";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Playwright Automation Tutorial"
      aria-describedby="tutorial-step-desc"
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />

      {/* Spotlight cutout */}
      {spotlightRect && !isTargetUnavailable && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none rounded-xl border-2 border-indigo-500 shadow-[0_0_0_9999px_rgba(2,6,23,0.75)] transition-all duration-200"
          style={{
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
          }}
        />
      )}

      {/* Dialog Modal Box */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Tutorial
              </span>
              <span className="text-xs font-mono text-slate-400">
                ขั้นตอน {currentStepIndex + 1} จาก {PLAYWRIGHT_TUTORIAL_STEPS.length}
              </span>
            </div>
            <h2 id="tutorial-step-title" className="text-lg font-bold text-white mt-1">
              {step.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Semantic Progressbar */}
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

        {/* Step Navigation Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          {PLAYWRIGHT_TUTORIAL_STEPS.map((s, idx) => {
            const isCurrent = idx === currentStepIndex;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onStepChange(idx)}
                className={`px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  isCurrent
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                {idx + 1}. {s.label}
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-3 min-h-[80px]">
          <p id="tutorial-step-desc" className="text-sm text-slate-300 leading-relaxed">
            {step.description}
          </p>

          {isTargetUnavailable && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-mono text-amber-300">
              ℹ️ {step.unavailableMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={onPrevious}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={onFinish}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                Finish
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 cursor-pointer"
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
