export type WorkspaceTab = "explorer" | "code" | "terminal";

export interface WorkspaceLayoutPreferences {
  version: 1;
  explorerWidth: number;
  terminalHeight: number;
  terminalCollapsed: boolean;
  activeTab: WorkspaceTab;
}

export const WORKSPACE_LAYOUT_STORAGE_KEY = "morniter:playwright-layout:v1";
export const MIN_TERMINAL_HEIGHT = 160;
export const MAX_TERMINAL_HEIGHT = 280;
export const TERMINAL_WORKSPACE_RATIO = 0.28;

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutPreferences = {
  version: 1,
  explorerWidth: 320,
  terminalHeight: 200,
  terminalCollapsed: true,
  activeTab: "explorer",
};

export function clampExplorerWidth(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_WORKSPACE_LAYOUT.explorerWidth;
  return Math.min(440, Math.max(280, Math.round(value)));
}

export function clampTerminalHeight(value: number, availableHeight: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_WORKSPACE_LAYOUT.terminalHeight;
  const available = typeof availableHeight === "number" && !Number.isNaN(availableHeight) && availableHeight > 0
    ? availableHeight
    : 0;
  const maximum = available > 0
    ? Math.max(MIN_TERMINAL_HEIGHT, Math.min(MAX_TERMINAL_HEIGHT, Math.floor(available * TERMINAL_WORKSPACE_RATIO)))
    : MIN_TERMINAL_HEIGHT;
  return Math.min(maximum, Math.max(MIN_TERMINAL_HEIGHT, Math.round(value)));
}

export function parseWorkspaceLayoutPreferences(
  raw: string | null | undefined,
  viewportHeight: number,
): WorkspaceLayoutPreferences {
  if (!raw || typeof raw !== "string") {
    return { ...DEFAULT_WORKSPACE_LAYOUT };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return { ...DEFAULT_WORKSPACE_LAYOUT };
    }

    const explorerWidth = clampExplorerWidth(parsed.explorerWidth);
    const terminalHeight = clampTerminalHeight(parsed.terminalHeight, viewportHeight);
    const terminalCollapsed = typeof parsed.terminalCollapsed === "boolean" ? parsed.terminalCollapsed : true;
    const activeTab: WorkspaceTab =
      parsed.activeTab === "code" || parsed.activeTab === "terminal" || parsed.activeTab === "explorer"
        ? parsed.activeTab
        : "explorer";

    return {
      version: 1,
      explorerWidth,
      terminalHeight,
      terminalCollapsed,
      activeTab,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_LAYOUT };
  }
}

export function serializeWorkspaceLayoutPreferences(
  prefs: WorkspaceLayoutPreferences,
): string {
  const safe: WorkspaceLayoutPreferences = {
    version: 1,
    explorerWidth: clampExplorerWidth(prefs.explorerWidth),
    terminalHeight: Math.max(MIN_TERMINAL_HEIGHT, Math.round(prefs.terminalHeight || DEFAULT_WORKSPACE_LAYOUT.terminalHeight)),
    terminalCollapsed: typeof prefs.terminalCollapsed === "boolean" ? prefs.terminalCollapsed : true,
    activeTab:
      prefs.activeTab === "code" || prefs.activeTab === "terminal" || prefs.activeTab === "explorer"
        ? prefs.activeTab
        : "explorer",
  };
  return JSON.stringify(safe);
}
