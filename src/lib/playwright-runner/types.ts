/**
 * Playwright Automation Workspace — core job types.
 *
 * REVISION NOTE: this file was originally written speculatively (Task
 * 0.1) before any real backend code had been shared. A real job-store.ts
 * has since been pasted in, and its usage PROVES this file's original
 * PlaywrightJob/PlaywrightJobStatus/BrowserExecutionResult shapes were
 * wrong/incomplete. This revision matches what job-store.ts actually
 * reads and writes — inferred from concrete field usage, not guessed —
 * but it is still not the real types.ts. The real one should replace
 * this outright the moment it's available; treat everything below as
 * "best evidence so far", not final.
 *
 * Evidence used for this revision (every field below is something
 * job-store.ts actually constructs, reads, or destructures):
 *   - PlaywrightJob carries agentId, lastHeartbeatAt, artifacts,
 *     cancelRequestedAt, error — none of which were in the original
 *     version of this file.
 *   - PlaywrightJobStatus includes "claimed", "preparing", and
 *     "cancel_requested" as real, distinct states (see
 *     requestCancelPlaywrightJob's status checks and
 *     claimNextPlaywrightJob's assertPlaywrightTransition call) — the
 *     original enum here only had queued/claimed/running/terminal states
 *     and was missing "preparing" and "cancel_requested" entirely.
 *   - BrowserExecutionResult carries passed/failed/skipped COUNTS per
 *     browser, not just a single terminal status — the original version
 *     modeled it as status-only.
 *   - PlaywrightLogChunk (not PlaywrightJob's own field, a separate
 *     type) has sequence/stream/browser?/text/timestamp — this is new,
 *     the original file had no log-line type at all.
 *   - TestArtifact is now CONFIRMED (see its definition below) via a
 *     real Next.js typecheck error that exposed its actual shape.
 *     PlaywrightCatalog is still referenced only opaquely — left as an
 *     unconfirmed placeholder below.
 *
 * The client-request contract (PlaywrightJobRequest) is UNCHANGED from
 * the original — job-store.ts's enqueuePlaywrightJob destructures
 * exactly { projectId, source, testIds, code, browsers, mode }, which
 * matches what was already here. Still holds: no command/cwd/args/env/
 * absolute-path field.
 */

export type BrowserName = "chromium" | "firefox" | "webkit";

export type PlaywrightSource = "project-test" | "workspace";

export type BrowserMode = "headless" | "headed";

export interface PlaywrightJobRequest {
  projectId: string;
  source: PlaywrightSource;
  testIds?: string[];
  code?: string;
  browsers: BrowserName[];
  mode: BrowserMode;
}

/**
 * CONFIRMED by job-store.ts: claimNextPlaywrightJob transitions
 * queued -> claimed; heartbeatPlaywrightJob transitions claimed ->
 * running; requestCancelPlaywrightJob transitions queued -> cancelled
 * directly, or {claimed, preparing, running} -> cancel_requested.
 * "preparing" itself is referenced but never assigned anywhere in
 * job-store.ts — presumably set by the agent adapter (not yet seen)
 * between claiming a job and actually starting the process.
 * "passed" / "failed" / "timed_out" / "error" are NOT directly evidenced
 * as job-store.ts literals but are the obvious terminal counterparts to
 * completePlaywrightJob's generic `status: PlaywrightJobStatus` result
 * parameter — kept from the original version pending confirmation.
 */
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

/**
 * CONFIRMED by enqueuePlaywrightJob's initialResults construction:
 * { browser, status: "waiting", passed: 0, failed: 0, skipped: 0 }.
 * durationMs was in the original version but is NOT evidenced here —
 * kept as optional since completePlaywrightJob's result.browserResults
 * could plausibly add it without job-store.ts needing to read it back.
 */
export interface BrowserExecutionResult {
  browser: BrowserName;
  status: BrowserExecutionState;
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
}

/**
 * CONFIRMED by job-store.ts's PlaywrightJob construction/updates across
 * enqueuePlaywrightJob, claimNextPlaywrightJob, heartbeatPlaywrightJob,
 * completePlaywrightJob, requestCancelPlaywrightJob.
 */
export interface PlaywrightJob {
  id: string;
  agentId: string;
  projectId: string;
  source: PlaywrightSource;
  testIds?: string[];
  code?: string;
  browsers: BrowserName[];
  mode: BrowserMode;
  status: PlaywrightJobStatus;
  browserResults: BrowserExecutionResult[];
  artifacts?: TestArtifact[];
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  startedAt?: string;
  completedAt?: string;
  lastHeartbeatAt?: string;
  cancelRequestedAt?: string;
  error?: string;
}

/**
 * CONFIRMED shape by appendPlaywrightLogBatch's linesToAdd construction:
 * { sequence, stream, browser?, text, timestamp }.
 */
export interface PlaywrightLogChunk {
  sequence: number;
  stream: "stdout" | "stderr" | "system";
  browser?: BrowserName;
  text: string;
  timestamp: string;
}

/**
 * CONFIRMED by the real Next.js typecheck error on
 * ./src/app/api/playwright-runner/agent/jobs/[jobId]/complete/route.ts —
 * TypeScript's structural mismatch message revealed the actual shape
 * `PlaywrightCompleteJobSchema` parses artifacts into. This replaces the
 * earlier placeholder guess (which had `kind`/`url`, both wrong — real
 * fields are `type`/`downloadUrl`, plus jobId/filename/size/createdAt
 * that the placeholder didn't have at all).
 */
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

/**
 * UNCONFIRMED — same caveat as TestArtifact. job-store.ts's
 * publishPlaywrightCatalog/getPlaywrightCatalog pass this through
 * opaquely (redis.set/get<PlaywrightCatalog>) without touching its
 * internal fields.
 */
export interface PlaywrightCatalog {
  version: string;
  updatedAt: string;
  tests: PlaywrightTestDescriptor[];
}

export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
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
