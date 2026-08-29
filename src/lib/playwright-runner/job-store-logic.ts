/**
 * Playwright job store — pure logic (Redis keys, TTLs, error classes,
 * status-transition rules). No Redis client, no fs, no Node-only APIs —
 * this MUST stay browser-safe: build error evidence shows
 * useTestRunner.ts imports isPlaywrightActiveStatus from this exact file
 * and it gets bundled into Client Component Browser/SSR chunks.
 *
 * RECONSTRUCTION NOTE: this replaces an earlier placeholder version of
 * this file that had a completely different, incompatible API
 * (mergeAndCapLog/canEnqueue/etc.) and caused a real Turbopack build
 * failure once it ended up sitting next to the real job-store.ts. Every
 * export below is reconstructed from two pieces of hard evidence:
 *   1. job-store.ts's own import statement (names, and how each import
 *      is actually CALLED — e.g. playwrightKeys.job(jobId) vs
 *      playwrightKeys.history used with no parens).
 *   2. The Turbopack build log's "Export X doesn't exist" list, which
 *      independently confirms the same names from a second caller
 *      (useTestRunner.ts) and from three more route handlers
 *      (jobs/route.ts, agent/jobs/[jobId]/heartbeat/route.ts,
 *      agent/jobs/[jobId]/complete/route.ts).
 *
 * What's SOLID (directly evidenced, high confidence):
 *   - every export NAME below
 *   - playwrightKeys' method signatures and the fact `.history` is a
 *     plain value, not a function (used unparenthesized in
 *     `redis.zadd(playwrightKeys.history, ...)`)
 *   - assertPlaywrightTransition(from, to) is called with the CURRENT
 *     status as first arg and the DESIRED status as second, and throws
 *     on an invalid pair (confirmed by every job-store.ts call site
 *     checking a job's real status before calling it)
 *   - isPlaywrightActiveStatus(status) returns true for exactly the
 *     non-terminal statuses (confirmed by its two use sites: gating
 *     "does an active job already exist" in enqueuePlaywrightJob, and
 *     "should this job be reaped as stale" in reapStalePlaywrightJobs —
 *     both only make sense if it means "not yet finished")
 *
 * What's INFERRED (not directly evidenced — flagged so you can correct
 * against the real deleted/lost file if you still have it anywhere,
 * e.g. git history, a backup, IDE local history):
 *   - exact numeric TTL/limit VALUES (JOB_TTL_SECONDS, PRESENCE_TTL_SECONDS,
 *     LEASE_SECONDS) — picked to be consistent with the online/lagging/
 *     offline thresholds visible in job-store.ts's presence logic
 *     (lagging >30s, offline >75s) and with ARCHITECTURE.md's existing
 *     documented limits (5,000 lines / 1 MiB logs, 10-item queue,
 *     20-item history) for the parallel preset-based system
 *   - exact error message text inside each error class
 *   - the full transition table's entries for states only referenced,
 *     never assigned, in job-store.ts (e.g. "preparing")
 *
 * If you still have the original file (check `git log --
 * src/lib/playwright-runner/job-store-logic.ts` — it may just be an
 * uncommitted/reverted local change, not gone for good), use that
 * instead and treat this only as a stopgap to unblock the build.
 */

const NAMESPACE = "monitor:playwright:v1";

export const playwrightKeys = {
  job: (jobId: string): string => `${NAMESPACE}:job:${jobId}`,
  logs: (jobId: string): string => `${NAMESPACE}:job:${jobId}:logs`,
  queue: (agentId: string): string => `${NAMESPACE}:agent:${agentId}:queue`,
  active: (agentId: string): string => `${NAMESPACE}:agent:${agentId}:active`,
  catalog: (agentId: string): string => `${NAMESPACE}:agent:${agentId}:catalog`,
  presence: (agentId: string): string =>
    `${NAMESPACE}:agent:${agentId}:presence`,
  idempotency: (key: string): string => `${NAMESPACE}:idempotency:${key}`,
  // NOT a function — job-store.ts uses this directly as a string value,
  // e.g. `redis.zadd(playwrightKeys.history, ...)`.
  history: `${NAMESPACE}:history`,
};

// --- TTLs / limits (INFERRED values — see file header) ---

/** How long a job record persists in Redis after last write. */
export const JOB_TTL_SECONDS = 86_400; // 24h

/**
 * How long a presence record persists before Redis expires it outright.
 * Chosen to comfortably exceed the "offline" threshold (>75s since last
 * heartbeat, per job-store.ts's getPlaywrightAgentPresence) so the
 * elapsed-time check is what determines offline state, not the key
 * simply vanishing first.
 */
export const PRESENCE_TTL_SECONDS = 120;

/**
 * Active-job lease duration (SET NX EX). Must be renewed by heartbeats
 * more often than this to avoid another job being claimed concurrently.
 */
export const LEASE_SECONDS = 60;

export const MAX_LOG_LINES = 5_000;
export const MAX_LOG_BYTES = 1_048_576; // 1 MiB
export const MAX_QUEUE_LENGTH = 10;
export const MAX_HISTORY_ITEMS = 20;

// --- Error classes ---

export class PlaywrightActiveJobExistsError extends Error {
  constructor(public readonly activeJobId: string) {
    super(`An active job (${activeJobId}) already exists for this agent`);
    this.name = "PlaywrightActiveJobExistsError";
  }
}

export class PlaywrightQueueFullError extends Error {
  constructor() {
    super(`Job queue is full (max ${MAX_QUEUE_LENGTH})`);
    this.name = "PlaywrightQueueFullError";
  }
}

export class PlaywrightJobNotFoundError extends Error {
  constructor(public readonly jobId: string) {
    super(`Job ${jobId} not found`);
    this.name = "PlaywrightJobNotFoundError";
  }
}

export class PlaywrightAgentOwnershipError extends Error {
  constructor() {
    super("Job is not owned by this agent");
    this.name = "PlaywrightAgentOwnershipError";
  }
}

export class PlaywrightInvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid Playwright job status transition: ${from} -> ${to}`);
    this.name = "PlaywrightInvalidTransitionError";
  }
}

// --- Status transitions ---

/**
 * Every EVIDENCED transition (see job-store.ts) plus the minimal
 * additions needed to make "preparing" and "cancel_requested" reachable
 * at all, since both are referenced but neither is ever assigned inside
 * job-store.ts itself (almost certainly set by the not-yet-seen agent
 * process adapter). Flagged INFERRED entries are marked inline.
 */
const ALLOWED_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  queued: new Set([
    "claimed", // EVIDENCED: claimNextPlaywrightJob
    "cancelled", // EVIDENCED: requestCancelPlaywrightJob
  ]),
  claimed: new Set([
    "running", // observed via heartbeatPlaywrightJob (not itself asserted, but must be valid)
    "preparing", // INFERRED
    "cancel_requested", // EVIDENCED: requestCancelPlaywrightJob
    "passed",
    "failed",
    "timed_out",
    "cancelled",
    "error", // EVIDENCED (as a group): completePlaywrightJob accepts any terminal status from an active job
  ]),
  preparing: new Set([
    "running", // INFERRED
    "cancel_requested", // EVIDENCED: requestCancelPlaywrightJob
    "passed",
    "failed",
    "timed_out",
    "cancelled",
    "error",
  ]),
  running: new Set([
    "cancel_requested", // EVIDENCED: requestCancelPlaywrightJob
    "passed",
    "failed",
    "timed_out",
    "cancelled",
    "error",
  ]),
  cancel_requested: new Set([
    "cancelled", // INFERRED: the natural terminal outcome once cancellation is honored
    "failed", // INFERRED: agent may report failure while a cancel was in flight
    "timed_out", // INFERRED
  ]),
};

/**
 * Throws PlaywrightInvalidTransitionError if `to` is not a valid next
 * state from `from`. A no-op (does not throw) if `from === to`, since
 * job-store.ts's own callers sometimes call this defensively even when
 * the state may already match.
 */
export function assertPlaywrightTransition(from: string, to: string): void {
  if (from === to) {
    return;
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    throw new PlaywrightInvalidTransitionError(from, to);
  }
}

const ACTIVE_STATUSES = new Set([
  "queued",
  "claimed",
  "preparing",
  "running",
  "cancel_requested",
]);

/**
 * True for any non-terminal status. Used both server-side (is there
 * already an active job blocking a new enqueue? is this job stale enough
 * to reap?) and client-side (useTestRunner.ts — almost certainly to
 * decide whether to keep polling / show a "running" indicator).
 */
export function isPlaywrightActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}
