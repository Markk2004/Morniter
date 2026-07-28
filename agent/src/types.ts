export interface AgentPresetConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  timeoutSeconds?: number;
}

export interface AgentProjectConfig {
  id: string;
  name: string;
  presets: AgentPresetConfig[];
}

export interface AgentConfig {
  agentId: string;
  serverUrl: string;
  agentToken: string;
  pollIntervalSeconds?: number;
  projects: AgentProjectConfig[];
}

export interface ResolvedPreset {
  projectId: string;
  presetId: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutSeconds: number;
}

export type ExecutionStatus = "passed" | "failed" | "cancelled" | "timed_out";

export interface ExecutionResult {
  status: ExecutionStatus;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  truncated: boolean;
  error?: string;
}

export interface TestPreset {
  id: string;
  name: string;
  description: string;
  commandPreview: string;
  timeoutSeconds: number;
}

export interface TestProject {
  id: string;
  name: string;
  presets: TestPreset[];
}

export interface TestProjectCatalog {
  version: string;
  updatedAt: string;
  projects: TestProject[];
}

export interface TestJob {
  id: string;
  projectId: string;
  presetId: string;
  presetName: string;
  status: ExecutionStatus | "queued" | "running";
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  agentId?: string;
  cancelRequested?: boolean;
  truncated?: boolean;
  error?: string;
}
