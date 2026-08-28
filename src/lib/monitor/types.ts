export type MonitorSource =
  | "vercel"
  | "render"
  | "aiven"
  | "cronjob"
  | "health";

export type Severity = "info" | "warning" | "error";

export type DiagnosticStage =
  | "build"
  | "deploy"
  | "runtime"
  | "database"
  | "health"
  | "cron"
  | "unknown";

export type MonitorDiagnostic = {
  id: string;
  stage: DiagnosticStage;
  level: Severity;
  message: string;
  occurredAt?: string;
};

export type MonitorDiagnosticsResult = {
  eventId: string;
  summary: string;
  lines: MonitorDiagnostic[];
  truncated: boolean;
};

export type MonitorEvent = {
  id: string;
  source: MonitorSource;
  service: string;
  type: "deployment" | "runtime" | "database" | "cron" | "health";
  severity: Severity;
  status: string;
  message: string;
  occurredAt: string;
  databaseName?: string;
  stage?: DiagnosticStage;
  incidentKey?: string;
  deploymentId?: string;
  resourceId?: string;
  ownerId?: string;
  diagnosticAvailable?: boolean;
  diagnosticEndTime?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  commitAuthor?: string;
  deploymentTarget?: string;
};

export type ServiceStatus = {
  source: MonitorSource;
  service: string;
  status: "healthy" | "degraded" | "failed" | "unknown";
  checkedAt: string;
  databaseName?: string;
};

export type ProviderErrorCode =
  | "configuration_error"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "upstream_error";

export type ProviderSnapshot = {
  source: MonitorSource;
  fetchedAt: string;
  stale: boolean;
  services: ServiceStatus[];
  events: MonitorEvent[];
  error?: { code: ProviderErrorCode; message: string };
};

export type MonitorSnapshot = {
  generatedAt: string;
  refreshAfterSeconds: number;
  partial: boolean;
  providers: ProviderSnapshot[];
  events: MonitorEvent[];
};

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
export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  line?: number;
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
