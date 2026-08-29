<<<<<<< HEAD
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

=======
/**
 * Playwright Automation Workspace — core job types.
 *
 * These types define the contract between the browser client and the
 * Next.js API layer. Per the security contract (Task 0.1 acceptance
 * criteria), this contract MUST NOT include:
 *   - a raw `command` field
 *   - a `cwd` field
 *   - an `args` field
 *   - an `env` field
 *   - an absolute path field
 *
 * All of those are resolved server-side / agent-side from `projectId`
 * and (for project-test jobs) `testIds`, never accepted from the client.
 */

export type BrowserName = "chromium" | "firefox" | "webkit";

export type PlaywrightSource = "project-test" | "workspace";

export type BrowserMode = "headless" | "headed";

/**
 * The request body a client may POST to create a Playwright job.
 *
 * This is a discriminated shape at the schema level (see schemas.ts):
 * `source: "project-test"` requires `testIds` and forbids `code`,
 * `source: "workspace"` requires `code` and forbids `testIds`.
 */
export interface PlaywrightJobRequest {
  projectId: string;
  source: PlaywrightSource;
  testIds?: string[];
  code?: string;
  browsers: BrowserName[];
  mode: BrowserMode;
}

/**
 * Per-browser execution status, as reported back to the client while a
 * job runs and once it completes.
 */
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
  durationMs?: number;
}

export type PlaywrightJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "passed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "error";

/**
 * Canonical server-side job record. This is what gets persisted
 * (e.g. under the `monitor:test-runner:v3:job:<id>` key) and what the
 * client polls — it is a superset of the request, never the reverse.
 */
export interface PlaywrightJob {
  id: string;
  projectId: string;
  source: PlaywrightSource;
  testIds?: string[];
  browsers: BrowserName[];
  mode: BrowserMode;
  status: PlaywrightJobStatus;
  browserResults: BrowserExecutionResult[];
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  startedAt?: string;
  completedAt?: string;
  requestedBy?: string;
}

/**
 * Stable descriptor for a discovered test, published via the Agent
 * catalog. Never includes an absolute filesystem path (see Task 2.2).
 */
>>>>>>> 8ef9a552828fca2885ac621be4efd4d25a15997f
export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  line?: number;
<<<<<<< HEAD
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
=======
}

/**
 * Agent-reported Playwright capability, published alongside
 * presence/catalog so the UI can disable unavailable browsers/modes.
 */
export interface AgentPlaywrightCapabilities {
  playwright: boolean;
  browsers: {
    chromium: boolean;
    firefox: boolean;
    webkit: boolean;
  };
  headed: boolean;
}
>>>>>>> 8ef9a552828fca2885ac621be4efd4d25a15997f
