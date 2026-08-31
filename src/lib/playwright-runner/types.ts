/**
 * Playwright Automation Workspace — core job types.
 */

export type BrowserName = "chromium" | "firefox" | "webkit";

export type PlaywrightSource = "project-test" | "workspace";

export type RunMode = "headless" | "headed";
/** @deprecated use RunMode — kept only for backward compatibility. */
export type BrowserMode = RunMode;

export interface PlaywrightJobRequest {
  projectId: string;
  source: PlaywrightSource;
  testIds?: string[];
  code?: string;
  risk?: "read-only" | "mutating";
  recipeId?: string;
  browsers: BrowserName[];
  mode: RunMode;
  agentId?: string;
}

export type PlaywrightJobStatus =
  | "queued"
  | "claimed"
  | "preparing"
  | "running"
  | "passed"
  | "failed"
  | "timed_out"
  | "cancel_requested"
  | "cancelled"
  | "error";

export type BrowserExecutionState =
  | "waiting"
  | "running"
  | "passed"
  | "failed"
  | "timed_out"
  | "cancelled";

export interface BrowserExecutionResult {
  browser: BrowserName;
  status: BrowserExecutionState;
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
}

export interface PlaywrightJob {
  id: string;
  agentId: string;
  projectId: string;
  source: PlaywrightSource;
  testIds?: string[];
  code?: string;
  risk?: "read-only" | "mutating";
  recipeId?: string;
  browsers: BrowserName[];
  mode: RunMode;
  status: PlaywrightJobStatus;
  browserResults: BrowserExecutionResult[];
  runnerResults?: NativeGroupResult[];
  artifacts?: TestArtifact[];
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  startedAt?: string;
  completedAt?: string;
  lastHeartbeatAt?: string;
  cancelRequestedAt?: string;
  error?: string;
}

export interface NativeGroupResult {
  runner: NativeRunner;
  executionProfileId: string;
  status: "passed" | "failed" | "cancelled" | "timed_out";
  testIds: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode?: number;
  error?: string;
}

export interface PlaywrightLogChunk {
  sequence: number;
  stream: "stdout" | "stderr" | "system";
  browser?: BrowserName;
  text: string;
  timestamp: string;
}

export interface TestArtifact {
  id: string;
  jobId: string;
  type: "screenshot" | "trace" | "video" | "report";
  filename: string;
  size: number;
  createdAt: string;
  browser?: BrowserName;
  testId?: string;
  downloadUrl?: string;
}

export interface PlaywrightCatalogProjectCapabilities {
  browsers?: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  headed?: boolean;
  workspaceExecution?: boolean;
}

export type NativeRunner =
  | "playwright"
  | "generated-playwright"
  | "node-test"
  | "jest"
  | "jest-e2e";
export type CatalogTestRunner = NativeRunner;
export type CatalogMatchMethod =
  | "explicit"
  | "source-id"
  | "path"
  | "title"
  | "keyword"
  | "unmatched";

export interface RunnerProfile {
  id: string;
  runner: NativeRunner;
  workingDirectory: string;
  config?: string;
  envAllowlist?: string[];
}

export interface ProjectCoverageTest {
  id: string;
  title: string;
  relativePath: string;
  runner: CatalogTestRunner;
  executionProfileId?: string;
  executable: boolean;
  risk?: "read-only" | "mutating";
  origin: "manual" | "generated";
  confidence: "high" | "medium" | "low";
  matchedBy: CatalogMatchMethod[];
}

export interface ProjectCoverageGap {
  targetId: string;
  title: string;
  status:
    | "missing-recipe"
    | "ready-to-generate"
    | "unsupported"
    | "stale-generated";
}

export interface ProjectCoverageGroup {
  id: string;
  name: string;
  functionId?: string;
  functionName?: string;
  tests: ProjectCoverageTest[];
  gaps: ProjectCoverageGap[];
}

export interface CatalogTestTarget {
  id: string;
  label: string;
  allowMutating: boolean;
}

export interface PlaywrightCatalogProject {
  id: string;
  name: string;
  mapRevision?: string;
  testTarget?: CatalogTestTarget;
  rootLabel?: string;
  capabilities?: PlaywrightCatalogProjectCapabilities;
  runnerProfiles?: RunnerProfile[];
  testGroups?: PlaywrightTestGroup[];
  tests?: PlaywrightTestDescriptor[];
  sourceByPath?: Record<string, string>;
  scanPathLabel?: string;
  coverageGroups?: ProjectCoverageGroup[];
}

/** Compatibility alias for the project-level catalog name used by the UI. */
export type PlaywrightProjectCatalog = PlaywrightCatalogProject;

export interface PlaywrightTestGroup {
  name: string;
  tests: PlaywrightTestDescriptor[];
}

export interface PlaywrightCatalog {
  version: string;
  updatedAt: string;
  projects: PlaywrightCatalogProject[];
}

export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  tags?: string[];
  line?: number;
}

export interface AgentPlaywrightCapabilities {
  playwright: boolean;
  browsers: {
    chromium: boolean;
    firefox: boolean;
    webkit: boolean;
  };
  headed: boolean;
}
