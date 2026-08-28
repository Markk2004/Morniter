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
