"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, type RefCallback } from "react";
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
  workspaceRef?: RefCallback<HTMLDivElement>;
  workspaceWidth?: number;
  workspaceHeight?: number;
  terminalMaxHeight?: number;
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
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", callback);
  if (!window.matchMedia) return () => window.removeEventListener("resize", callback);
  const mediaQuery = window.matchMedia("(max-width: 899px), (max-height: 500px)");

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", callback);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(callback);
  }
  return () => {
    window.removeEventListener("resize", callback);
    if (typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.removeEventListener("change", callback);
    } else if (typeof mediaQuery.removeListener === "function") {
      mediaQuery.removeListener(callback);
    }
  };
}

function getNarrowSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 899px), (max-height: 500px)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useWorkspaceLayout(): UseWorkspaceLayoutResult {
  const mediaNarrow = useSyncExternalStore(subscribeNarrow, getNarrowSnapshot, getServerSnapshot);
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const workspaceRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      const nextWidth = Math.round(rect.width);
      const nextHeight = Math.round(rect.height);
      setWorkspaceSize((previous) => {
        if (previous.width === nextWidth && previous.height === nextHeight) {
          return previous;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const usableHeight = workspaceSize.height > 0 ? Math.max(0, workspaceSize.height - 320) : 800;
  const terminalMaxHeight = clampTerminalHeight(Number.POSITIVE_INFINITY, usableHeight);
  const isNarrow = mediaNarrow;

  const [preferences, setPreferences] = useState<WorkspaceLayoutPreferences>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_LAYOUT };
    try {
      const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
      return parseWorkspaceLayoutPreferences(raw, 800);
    } catch {
      return { ...DEFAULT_WORKSPACE_LAYOUT };
    }
  });

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setPreferences((prev) => ({
      ...prev,
      terminalHeight: clampTerminalHeight(value, usableHeight),
    }));
  }, [usableHeight]);

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
    workspaceRef,
    workspaceWidth: workspaceSize.width,
    workspaceHeight: workspaceSize.height,
    terminalMaxHeight,
    explorerWidth: preferences.explorerWidth,
    terminalHeight: clampTerminalHeight(preferences.terminalHeight, usableHeight),
    terminalCollapsed: preferences.terminalCollapsed,
    activeTab: preferences.activeTab,
    setExplorerWidth,
    setTerminalHeight,
    setTerminalCollapsed,
    setActiveTab,
    resetLayout,
  };
}
