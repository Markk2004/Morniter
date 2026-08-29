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
 *     PlaywrightCatalog is now PARTIALLY CONFIRMED the same way — real
 *     shape is per-project (projects: [...]), not the flat tests[] this
 *     file originally guessed. See PlaywrightCatalog's own comment for
 *     exactly which part is still unconfirmed (truncated compiler
 *     output).
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
 * CONFIRMED (partially) by a real Next.js typecheck error on
 * ./src/app/api/playwright-runner/agent/poll/route.ts. The compiler's
 * structural-mismatch message showed:
 *
 *   { version: string; updatedAt: string; projects: { id: string;
 *     name: string; rootLabel?: string; capabilities?: { browsers?:
 *     { chromium?: boolean; firefox?: boolean; webkit?: boolean; };
 *     headed?: boolean; workspaceExecution?: boolean; } ... }
 *
 * — CRITICALLY DIFFERENT from the original placeholder guess, which had
 * a flat top-level `tests: PlaywrightTestDescriptor[]`. The real shape
 * is per-project: each project in `projects` carries its own optional
 * capabilities (which browsers/headed mode/workspace execution that
 * SPECIFIC project's agent-side config allows — lines up with
 * AgentPlaywrightConfigSchema's allowedBrowsers/allowHeaded from the
 * real agent config.ts, one capabilities object per project rather than
 * one for the whole catalog).
 *
 * TRUNCATED: TypeScript's error message was cut off with "..." right
 * after `workspaceExecution?: boolean;`, so whatever comes after that in
 * each project object (near-certainly each project's own list of
 * discoverable tests — a catalog listing projects with no way to see
 * their tests would be useless) is NOT confirmed. `tests` below is kept
 * as the best guess for that trailing, unconfirmed part specifically —
 * everything else in this interface came directly from the compiler.
 */
export interface PlaywrightCatalogProjectCapabilities {
  browsers?: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  headed?: boolean;
  workspaceExecution?: boolean;
}

export interface PlaywrightCatalogProject {
  id: string;
  name: string;
  rootLabel?: string;
  capabilities?: PlaywrightCatalogProjectCapabilities;
  /**
   * UNCONFIRMED shape — the compiler error only showed
   * `testGroups?: {...}[]` before truncating again. Kept minimal/opaque
   * rather than guessed structure, since guessing wrong here would just
   * produce a fourth round of the same error.
   */
  testGroups?: unknown[];
  /**
   * CONFIRMED optional (not required, as originally guessed) by the
   * compiler: real callers pass `tests: undefined` for some projects.
   */
  tests?: PlaywrightTestDescriptor[];
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
  /**
   * CONFIRMED by the same compiler error as PlaywrightCatalogProject —
   * was entirely missing from the earlier version of this interface.
   */
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
