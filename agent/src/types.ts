export type TestCategory = "automated" | "execution" | "uat";
export type TestRisk = "safe" | "mutating" | "read-only";
export type DatabaseTarget = "none" | "defaultdb" | "production";

export interface TestPresetMetadata {
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
}

export interface AgentPresetConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  timeoutSeconds?: number;
  metadata: TestPresetMetadata;
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
  metadata: TestPresetMetadata;
}

export type TestJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "passed"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out"
  | "agent_lost";

export type TestFramework = "jest" | "cypress" | "vitest" | "unknown";

export interface TestProgress {
  framework: TestFramework;
  completed: number | null;
  total: number | null;
  percentage: number | null;
  currentLabel?: string;
  updatedAt: string;
}

export interface ExecutionResult {
  status: "passed" | "failed" | "cancelled" | "timed_out";
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
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
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
  idempotencyKey: string;
  agentId: string;
  projectId: string;
  presetId: string;
  presetName: string;
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
  status: TestJobStatus;
  queuedAt: string;
  claimedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  leaseExpiresAt?: string;
  lastHeartbeatAt?: string;
  progress?: TestProgress;
  exitCode?: number | null;
  cancelRequested?: boolean;
  truncated?: boolean;
  logBytes?: number;
  logLines?: number;
  error?: string;
}
