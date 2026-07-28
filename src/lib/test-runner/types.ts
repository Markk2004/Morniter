import type { TestJobStatus } from "./lifecycle";

export type { TestJobStatus };

export type TestFramework = "jest" | "cypress" | "vitest" | "unknown";

export interface TestProgress {
  framework: TestFramework;
  completed: number | null;
  total: number | null;
  percentage: number | null;
  currentLabel?: string;
  updatedAt: string;
}

export type AgentPresenceState = "online" | "lagging" | "offline";

export interface AgentPresence {
  agentId: string;
  state: AgentPresenceState;
  lastHeartbeatAt: string;
  activeJobId?: string;
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
  idempotencyKey: string;
  agentId: string;
  projectId: string;
  presetId: string;
  presetName: string;
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

export type TestLogStream = "stdout" | "stderr" | "system";

export interface TestLogLine {
  sequence: number;
  stream: TestLogStream;
  message: string;
  timestamp: string;
}

export interface TestLogPage {
  jobId: string;
  lines: TestLogLine[];
  nextSequence: number;
  hasMore: boolean;
  truncated?: boolean;
}
