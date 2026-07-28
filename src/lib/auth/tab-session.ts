export const TAB_SESSION_STORAGE_KEY = "project_monitor_tab_session";

export function createTabSessionMarker(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
