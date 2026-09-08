import type { DesktopAgentSettings, LocalProject } from "./settings";

export type AgentState = "stopped" | "connecting" | "online" | "running" | "error";
export interface PublicAgentState { state: AgentState; message?: string; }
export interface SetupResult { ok: boolean; code?: string; message: string; }

export interface MorniterAgentApi {
  getState(): Promise<PublicAgentState>;
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
}

declare global { interface Window { morniterAgent: MorniterAgentApi; } }
