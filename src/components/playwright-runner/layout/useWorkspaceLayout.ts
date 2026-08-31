"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import {
  type WorkspaceTab,
  type WorkspaceLayoutPreferences,
  DEFAULT_WORKSPACE_LAYOUT,
  WORKSPACE_LAYOUT_STORAGE_KEY,
  clampExplorerWidth,
  clampTerminalHeight,
  parseWorkspaceLayoutPreferences,
  serializeWorkspaceLayoutPreferences,
} from "./workspace-layout-state";

export interface UseWorkspaceLayoutResult {
  isNarrow: boolean;
  explorerWidth: number;
  terminalHeight: number;
  terminalCollapsed: boolean;
  activeTab: WorkspaceTab;
  setExplorerWidth(value: number): void;
  setTerminalHeight(value: number): void;
  setTerminalCollapsed(value: boolean): void;
  setActiveTab(value: WorkspaceTab): void;
  resetLayout(): void;
}

function subscribeNarrow(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia("(max-width: 899px)");

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(callback);
    return () => mediaQuery.removeListener(callback);
  }
  return () => {};
}

function getNarrowSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 899px)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useWorkspaceLayout(): UseWorkspaceLayoutResult {
  const isNarrow = useSyncExternalStore(subscribeNarrow, getNarrowSnapshot, getServerSnapshot);

  const [preferences, setPreferences] = useState<WorkspaceLayoutPreferences>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_LAYOUT };
    try {
      const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
      return parseWorkspaceLayoutPreferences(raw, window.innerHeight || 800);
    } catch {
      return { ...DEFAULT_WORKSPACE_LAYOUT };
    }
  });

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle viewport resize to reclamp terminal height
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setPreferences((prev) => {
        const clamped = clampTerminalHeight(prev.terminalHeight, window.innerHeight || 800);
        if (clamped === prev.terminalHeight) return prev;
        return { ...prev, terminalHeight: clamped };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Debounced persistence to localStorage (150ms after settle)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      try {
        const serialized = serializeWorkspaceLayoutPreferences(preferences);
        window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, serialized);
      } catch {
        // Ignore localStorage quota or access errors
      }
    }, 150);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [preferences]);

  const setExplorerWidth = useCallback((value: number) => {
    setPreferences((prev) => ({
      ...prev,
      explorerWidth: clampExplorerWidth(value),
    }));
  }, []);

  const setTerminalHeight = useCallback((value: number) => {
    const vh = typeof window !== "undefined" ? window.innerHeight || 800 : 800;
    setPreferences((prev) => ({
      ...prev,
      terminalHeight: clampTerminalHeight(value, vh),
    }));
  }, []);

  const setTerminalCollapsed = useCallback((value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      terminalCollapsed: value,
    }));
  }, []);

  const setActiveTab = useCallback((value: WorkspaceTab) => {
    setPreferences((prev) => ({
      ...prev,
      activeTab: value,
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setPreferences({ ...DEFAULT_WORKSPACE_LAYOUT });
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(WORKSPACE_LAYOUT_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    isNarrow,
    explorerWidth: preferences.explorerWidth,
    terminalHeight: preferences.terminalHeight,
    terminalCollapsed: preferences.terminalCollapsed,
    activeTab: preferences.activeTab,
    setExplorerWidth,
    setTerminalHeight,
    setTerminalCollapsed,
    setActiveTab,
    resetLayout,
  };
}
