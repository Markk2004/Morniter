import type { DesktopAgentSettings, LocalProject } from "./settings";

export type AgentState = "stopped" | "connecting" | "online" | "running" | "error";
export interface PublicAgentState { state: AgentState; message?: string; }
export interface SetupResult { ok: boolean; code?: string; message: string; }

export interface RecentPathEntry {
  workspaceRoot: string;
  testRoot: string;
  lastUsedAt: string;
}

export interface MorniterAgentApi {
  getState(): Promise<PublicAgentState>;
  getSettings(): Promise<DesktopAgentSettings | null>;
  isPaired(): Promise<boolean>;
  unpair(): Promise<SetupResult>;
  updateProject(project: Pick<LocalProject, "workspaceRoot" | "testRoot">): Promise<SetupResult>;
  selectDirectory(defaultPath?: string): Promise<string | null>;
  saveSettings(settings: DesktopAgentSettings): Promise<SetupResult>;
  enroll(serverUrl: string, pairingCode: string, agentId: string, deviceId: string): Promise<SetupResult>;
  validateProject(project: Pick<LocalProject, "workspaceRoot" | "testRoot">): Promise<SetupResult>;
  startAgent(): Promise<SetupResult>;
  stopAgent(): Promise<SetupResult>;
  restartAgent(): Promise<SetupResult>;
  testConnection(serverUrl?: string): Promise<SetupResult>;
  scanTests(): Promise<SetupResult>;
  setStartWithWindows(enabled: boolean): Promise<SetupResult>;
  openMorniter(): Promise<SetupResult>;
  readSafeLogs(): Promise<{ lines: string[] }>;
  subscribeState(listener: (state: PublicAgentState) => void): () => void;
  getRecentPaths(): Promise<RecentPathEntry[]>;
  addRecentPath(entry: { workspaceRoot: string; testRoot: string }): Promise<RecentPathEntry[]>;
  removeRecentPath(workspaceRoot: string): Promise<RecentPathEntry[]>;
}

declare global { interface Window { morniterAgent: MorniterAgentApi; } }
