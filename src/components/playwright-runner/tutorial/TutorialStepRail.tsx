"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TutorialStep } from "./tutorial-steps";
import TutorialIcon from "./TutorialIcon";

interface TutorialStepRailProps {
  steps: readonly TutorialStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
}

export default function TutorialStepRail({
  steps,
  currentStepIndex,
  onStepChange,
}: TutorialStepRailProps) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const bottomSheetRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex] || steps[0];

  // Focus trap and Escape key for mobile bottom sheet
  useEffect(() => {
    if (!isMobileSheetOpen) return;

    const handleSheetKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setIsMobileSheetOpen(false);
        mobileTriggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && bottomSheetRef.current) {
        const focusables = bottomSheetRef.current.querySelectorAll<HTMLElement>(
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

    window.addEventListener("keydown", handleSheetKeyDown, true);
    const firstBtn = bottomSheetRef.current?.querySelector<HTMLButtonElement>("button");
    firstBtn?.focus();

    return () => {
      window.removeEventListener("keydown", handleSheetKeyDown, true);
    };
  }, [isMobileSheetOpen]);

  const handleStepClick = (index: number) => {
    onStepChange(index);
    if (isMobileSheetOpen) {
      setIsMobileSheetOpen(false);
      mobileTriggerRef.current?.focus();
    }
  };

  return (
    <>
      {/* Desktop Step Rail */}
      <nav
        aria-label="Tutorial steps"
        className="hidden md:flex w-60 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-950 p-4 font-mono text-xs overflow-y-auto"
      >
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-sans">
          หลักสูตรการใช้งาน
        </div>

        {steps.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isCompleted = idx < currentStepIndex;
          const showChapterHeader = idx === 0 || steps[idx - 1].chapter !== step.chapter;

          return (
            <React.Fragment key={step.id}>
              {showChapterHeader && (
                <div className="mt-3 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans border-t border-slate-800/60 pt-2 first:mt-0 first:border-0 first:pt-0">
                  {step.chapter}
                </div>
              )}
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => handleStepClick(idx)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer w-full ${
                  isCurrent
                    ? "bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/40 shadow-sm"
                    : isCompleted
                      ? "text-slate-300 hover:bg-slate-900 hover:text-white"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : isCompleted
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-slate-900 text-slate-400 border border-slate-800"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <TutorialIcon name={step.icon} className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate font-sans text-xs">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Mobile Step Summary & Sheet Trigger */}
      <div className="flex md:hidden items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-mono">
        <div className="flex items-center space-x-2 truncate">
          <span className="font-bold text-indigo-400 font-sans">
            ขั้นตอน {currentStepIndex + 1}/{steps.length}
          </span>
          <span className="text-slate-400">·</span>
          <span className="truncate text-slate-200 font-sans">{currentStep.label}</span>
        </div>
        <button
          ref={mobileTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isMobileSheetOpen}
          onClick={() => setIsMobileSheetOpen(true)}
          className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-sans text-slate-300 hover:bg-slate-800 transition cursor-pointer"
        >
          ขั้นตอนทั้งหมด
        </button>
      </div>

      {/* Mobile Bottom Sheet Modal */}
      {isMobileSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ขั้นตอนการเรียนรู้ทั้งหมด"
          ref={bottomSheetRef}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 md:hidden"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              setIsMobileSheetOpen(false);
              mobileTriggerRef.current?.focus();
            }}
          />
          <div className="relative z-10 max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm font-sans">ขั้นตอนทั้งหมด ({steps.length})</h3>
              <button
                type="button"
                aria-label="ปิดหน้ารายการขั้นตอน"
                onClick={() => {
                  setIsMobileSheetOpen(false);
                  mobileTriggerRef.current?.focus();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 font-mono text-xs">
              {steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;
                const showChapterHeader = idx === 0 || steps[idx - 1].chapter !== step.chapter;

                return (
                  <React.Fragment key={step.id}>
                    {showChapterHeader && (
                      <div className="mt-3 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans border-t border-slate-800/60 pt-2 first:mt-0 first:border-0 first:pt-0">
                        {step.chapter}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-current={isCurrent ? "step" : undefined}
                      onClick={() => handleStepClick(idx)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer w-full ${
                        isCurrent
                          ? "bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/40"
                          : isCompleted
                            ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                          isCurrent
                            ? "bg-indigo-600 text-white"
                            : isCompleted
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-slate-950 text-slate-400 border border-slate-800"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <TutorialIcon name={step.icon} className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="truncate font-sans text-xs">{step.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
