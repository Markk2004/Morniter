// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWorkspaceLayout } from "@/components/playwright-runner/layout/useWorkspaceLayout";
import {
  WORKSPACE_LAYOUT_STORAGE_KEY,
  DEFAULT_WORKSPACE_LAYOUT,
} from "@/components/playwright-runner/layout/workspace-layout-state";

describe("useWorkspaceLayout hook", () => {
  let matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
  let isNarrowMatches = false;

  beforeEach(() => {
    localStorage.clear();
    matchMediaListeners = [];
    isNarrowMatches = false;

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => {
        return {
          matches: query.includes("899px") ? isNarrowMatches : false,
          media: query,
          onchange: null,
          addListener: vi.fn((cb) => matchMediaListeners.push(cb)),
          removeListener: vi.fn((cb) => {
            matchMediaListeners = matchMediaListeners.filter((l) => l !== cb);
          }),
          addEventListener: vi.fn((_, cb) => matchMediaListeners.push(cb)),
          removeEventListener: vi.fn((_, cb) => {
            matchMediaListeners = matchMediaListeners.filter((l) => l !== cb);
          }),
          dispatchEvent: vi.fn(),
        };
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with default values on wide screens when storage is empty", () => {
    const { result } = renderHook(() => useWorkspaceLayout());

    expect(result.current.isNarrow).toBe(false);
    expect(result.current.explorerWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.explorerWidth);
    expect(result.current.terminalHeight).toBe(DEFAULT_WORKSPACE_LAYOUT.terminalHeight);
    expect(result.current.terminalCollapsed).toBe(false);
    expect(result.current.activeTab).toBe("explorer");
  });

  it("uses tabs below 900px and preserves preferences across rerenders", () => {
    isNarrowMatches = true;
    const { result, rerender } = renderHook(() => useWorkspaceLayout());

    expect(result.current.isNarrow).toBe(true);
    act(() => {
      result.current.setActiveTab("terminal");
    });
    rerender();
    expect(result.current.activeTab).toBe("terminal");
  });

  it("persists settled values and resetLayout restores defaults", async () => {
    const { result } = renderHook(() => useWorkspaceLayout());

    act(() => {
      result.current.setExplorerWidth(400);
      result.current.setTerminalHeight(300);
      result.current.setTerminalCollapsed(true);
    });

    expect(result.current.explorerWidth).toBe(400);
    expect(result.current.terminalHeight).toBe(300);
    expect(result.current.terminalCollapsed).toBe(true);

    await waitFor(() => {
      const stored = localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
      expect(stored).toBeTruthy();
      expect(stored).toContain("400");
    });

    act(() => {
      result.current.resetLayout();
    });

    expect(result.current.explorerWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.explorerWidth);
    expect(result.current.terminalHeight).toBe(DEFAULT_WORKSPACE_LAYOUT.terminalHeight);
    expect(result.current.terminalCollapsed).toBe(false);
    expect(result.current.activeTab).toBe("explorer");
  });

  it("safely handles corrupted localStorage during initial load", () => {
    localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, "invalid-json{{");
    const { result } = renderHook(() => useWorkspaceLayout());

    expect(result.current.explorerWidth).toBe(DEFAULT_WORKSPACE_LAYOUT.explorerWidth);
  });
});
