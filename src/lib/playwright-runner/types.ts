export type BrowserName = "chromium" | "firefox" | "webkit";

export type RunMode = "headless" | "headed";

export type PlaywrightSource = "project-test" | "workspace";

export type PlaywrightJobStatus =
  | "queued"
  | "claimed"
  | "preparing"
  | "running"
  | "passed"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out";

export interface BrowserExecutionResult {
  browser: BrowserName;
  status: "waiting" | "running" | "passed" | "failed" | "cancelled";
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
}

export interface TestArtifact {
  id: string;
  jobId: string;
  type: "trace" | "screenshot" | "video" | "report";
  browser?: BrowserName;
  testId?: string;
  filename: string;
  size: number;
  downloadUrl?: string;
  createdAt: string;
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
  source: PlaywrightSource;
  testIds?: string[];
  code?: string;
  browsers: BrowserName[];
  mode: RunMode;
  status: PlaywrightJobStatus;
  browserResults: BrowserExecutionResult[];
  lastHeartbeatAt?: string;
  cancelRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts?: TestArtifact[];
  error?: string;
}

export interface PlaywrightLogChunk {
  sequence: number;
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  browser?: BrowserName;
  text: string;
}

export interface ExistingPlaywrightRunRequest {
  projectId: string;
  source: "project-test";
  testIds: string[];
  browsers: BrowserName[];
  mode: RunMode;
  idempotencyKey?: string;
  agentId?: string;
}

export interface WorkspacePlaywrightRunRequest {
  projectId: string;
  source: "workspace";
  code: string;
  browsers: BrowserName[];
  mode: RunMode;
  idempotencyKey?: string;
  agentId?: string;
}

export type PlaywrightJobRequest =
  | ExistingPlaywrightRunRequest
  | WorkspacePlaywrightRunRequest;
