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

export interface AgentPlaywrightProjectConfig {
  enabled?: boolean;
  workspaceRoot: string;
  testRoot?: string;
  config?: string;
  allowedBrowsers?: ("chromium" | "firefox" | "webkit")[];
  allowHeaded?: boolean;
  allowWorkspaceExecution?: boolean;
  maxTimeoutSeconds?: number;
  envAllowlist?: string[];
  allowedBaseUrls?: string[];
}

export interface AgentProjectConfig {
  id: string;
  name: string;
  presets?: AgentPresetConfig[];
  playwright?: AgentPlaywrightProjectConfig;
}

export type BrowserName = "chromium" | "firefox" | "webkit";
export type RunMode = "headless" | "headed";

export interface BrowserExecutionResult {
  browser: BrowserName;
  status: "waiting" | "running" | "passed" | "failed" | "cancelled";
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
}

export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  line?: number;
  tags?: string[];
}

export interface PlaywrightProjectCatalog {
  id: string;
  name: string;
  rootLabel?: string;
  capabilities?: {
    browsers?: {
      chromium?: boolean;
      firefox?: boolean;
      webkit?: boolean;
    };
    headed?: boolean;
    workspaceExecution?: boolean;
  };
  testGroups?: {
    name: string;
    tests: PlaywrightTestDescriptor[];
  }[];
  tests?: PlaywrightTestDescriptor[];
  /** Agent-to-server source cache keyed once per relative test file. */
  sourceByPath?: Record<string, string>;
  scanPathLabel?: string;
}

export interface PlaywrightCatalog {
  version: string;
  updatedAt: string;
  projects: PlaywrightProjectCatalog[];
}

export interface PlaywrightJob {
  id: string;
  agentId: string;
  projectId: string;
  source: "project-test" | "workspace";
  testIds?: string[];
  code?: string;
  browsers: BrowserName[];
  mode: RunMode;
  status: "queued" | "claimed" | "preparing" | "running" | "passed" | "failed" | "cancel_requested" | "cancelled" | "timed_out";
  browserResults: BrowserExecutionResult[];
  lastHeartbeatAt?: string;
  cancelRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts?: Array<{
    id: string;
    jobId: string;
    type: "trace" | "screenshot" | "video" | "report";
    browser?: BrowserName;
    testId?: string;
    filename: string;
    size: number;
    downloadUrl?: string;
    createdAt: string;
  }>;
  error?: string;
}

export interface PlaywrightExecutionResult {
  status: "passed" | "failed" | "cancelled" | "timed_out";
  browserResults: BrowserExecutionResult[];
  artifacts?: Array<{
    id: string;
    jobId: string;
    type: "trace" | "screenshot" | "video" | "report";
    browser?: BrowserName;
    testId?: string;
    filename: string;
    size: number;
    downloadUrl?: string;
    createdAt: string;
  }>;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  truncated: boolean;
  error?: string;
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
