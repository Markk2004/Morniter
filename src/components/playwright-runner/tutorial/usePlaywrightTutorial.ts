"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TUTORIAL_STORAGE_KEY,
  PLAYWRIGHT_TUTORIAL_STEPS,
} from "./tutorial-steps";

const LAST_STEP_INDEX = PLAYWRIGHT_TUTORIAL_STEPS.length - 1;

export interface UsePlaywrightTutorialResult {
  isOpen: boolean;
  currentStepIndex: number;
  openTutorial: () => void;
  closeTutorial: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
}

function markSeen(): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  } catch {
    // Gracefully handle storage quota / private window restrictions
  }
}

export function usePlaywrightTutorial(
  catalogReady: boolean,
  catalogError = false,
): UsePlaywrightTutorialResult {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const hasCheckedFirstVisitRef = useRef(false);

  useEffect(() => {
    if (!catalogReady || catalogError || hasCheckedFirstVisitRef.current) return;
    hasCheckedFirstVisitRef.current = true;

    try {
      const seen = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (!seen) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        setIsOpen(true);
        setCurrentStepIndex(0);
      }
    } catch {
      // Storage access blocked; default closed
    }
  }, [catalogReady, catalogError]);

  const openTutorial = useCallback(() => {
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    markSeen();
    setIsOpen(false);
  }, []);

  const skipTutorial = useCallback(() => {
    markSeen();
    setIsOpen(false);
  }, []);

  const finishTutorial = useCallback(() => {
    markSeen();
    setIsOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, LAST_STEP_INDEX));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(index, LAST_STEP_INDEX)));
  }, []);

  return {
    isOpen,
    currentStepIndex,
    openTutorial,
    closeTutorial,
    skipTutorial,
    finishTutorial,
    nextStep,
    previousStep,
    goToStep,
  };
}
