<<<<<<< HEAD
import type { PlaywrightJobStatus } from "./types";

export const JOB_TTL_SECONDS = 7 * 24 * 3600; // 7 days
export const PRESENCE_TTL_SECONDS = 75; // 75 seconds
export const LEASE_SECONDS = 60; // 60 seconds
export const MAX_LOG_LINES = 5000;
export const MAX_LOG_BYTES = 1024 * 1024; // 1 MiB
export const MAX_QUEUE_LENGTH = 10;
export const MAX_HISTORY_ITEMS = 20;

export const playwrightKeys = {
  presence: (agentId: string) => `monitor:playwright:v1:agent:${agentId}:presence`,
  catalog: (agentId: string) => `monitor:playwright:v1:agent:${agentId}:catalog`,
  queue: (agentId: string) => `monitor:playwright:v1:agent:${agentId}:queue`,
  active: (agentId: string) => `monitor:playwright:v1:agent:${agentId}:active`,
  job: (jobId: string) => `monitor:playwright:v1:job:${jobId}`,
  logs: (jobId: string) => `monitor:playwright:v1:job:${jobId}:logs`,
  artifacts: (jobId: string) => `monitor:playwright:v1:job:${jobId}:artifacts`,
  idempotency: (key: string) => `monitor:playwright:v1:idempotency:${key}`,
  history: "monitor:playwright:v1:history",
};

export class PlaywrightActiveJobExistsError extends Error {
  constructor(public readonly jobId: string) {
    super(`Agent already has an active Playwright job: ${jobId}`);
    this.name = "PlaywrightActiveJobExistsError";
  }
}

export class PlaywrightQueueFullError extends Error {
  constructor() {
    super(`Playwright job queue is full (max ${MAX_QUEUE_LENGTH})`);
    this.name = "PlaywrightQueueFullError";
  }
}

export class PlaywrightJobNotFoundError extends Error {
  constructor(public readonly jobId: string) {
    super(`Playwright job not found: ${jobId}`);
    this.name = "PlaywrightJobNotFoundError";
  }
}

export class PlaywrightAgentOwnershipError extends Error {
  constructor() {
    super("Agent does not own this Playwright job or active lease expired");
    this.name = "PlaywrightAgentOwnershipError";
  }
}

export class PlaywrightInvalidTransitionError extends Error {
  constructor(from: PlaywrightJobStatus, to: PlaywrightJobStatus) {
    super(`Invalid Playwright job state transition from '${from}' to '${to}'`);
    this.name = "PlaywrightInvalidTransitionError";
  }
}

export const VALID_TRANSITIONS: Record<PlaywrightJobStatus, PlaywrightJobStatus[]> = {
  queued: ["claimed", "cancelled"],
  claimed: ["preparing", "running", "cancelled", "cancel_requested", "failed", "timed_out"],
  preparing: ["running", "cancelled", "cancel_requested", "failed", "timed_out"],
  running: ["passed", "failed", "cancel_requested", "cancelled", "timed_out"],
  cancel_requested: ["cancelled", "failed", "timed_out", "passed"],
  passed: [],
  failed: [],
  cancelled: [],
  timed_out: [],
};

export function assertPlaywrightTransition(
  from: PlaywrightJobStatus,
  to: PlaywrightJobStatus,
): void {
  if (from === to) return;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new PlaywrightInvalidTransitionError(from, to);
  }
}

export function isPlaywrightActiveStatus(status: PlaywrightJobStatus): boolean {
  return status === "queued" || status === "claimed" || status === "preparing" || status === "running" || status === "cancel_requested";
=======
/**
 * Playwright job store — pure logic (Task: job persistence).
 *
 * Split deliberately from job-store.ts: everything in THIS file is pure
 * (no I/O, no Redis client) so it can be unit tested directly. The Redis
 * wrapper in job-store.ts that actually calls @upstash/redis could only
 * be typechecked, not executed, in this environment — see the note there.
 *
 * Namespace: uses a distinct "monitor:playwright:v1:..." keyspace rather
 * than reusing the existing "monitor:test-runner:v2:..." keys documented
 * in ARCHITECTURE.md, since this is a parallel system (new job shape,
 * new limits) — reusing the same keys would risk two different job
 * schemas colliding under one key.
 */

const NAMESPACE = "monitor:playwright:v1";

export function jobKey(jobId: string): string {
  return `${NAMESPACE}:job:${jobId}`;
}

export function jobLogsKey(jobId: string): string {
  return `${NAMESPACE}:job:${jobId}:logs`;
}

export function agentQueueKey(agentId: string): string {
  return `${NAMESPACE}:agent:${agentId}:queue`;
}

export function agentActiveKey(agentId: string): string {
  return `${NAMESPACE}:agent:${agentId}:active`;
}

export function agentCatalogKey(agentId: string): string {
  return `${NAMESPACE}:agent:${agentId}:catalog`;
}

export function agentPresenceKey(agentId: string): string {
  return `${NAMESPACE}:agent:${agentId}:presence`;
}

export function historyKey(): string {
  return `${NAMESPACE}:history`;
}

export function idempotencyKey(key: string): string {
  return `${NAMESPACE}:idempotency:${key}`;
}

// --- Storage bounds (mirrors ARCHITECTURE.md's documented limits for the
// existing test-runner system: 5,000 lines / 1 MiB per job, 10-item
// queue, 20-item history) ---

export const MAX_QUEUE_LENGTH = 10;
export const MAX_HISTORY_LENGTH = 20;
export const MAX_LOG_LINES = 5_000;
export const MAX_LOG_BYTES = 1_048_576; // 1 MiB
export const MAX_UPLOAD_BATCH_LINES = 100;
export const MAX_UPLOAD_BATCH_BYTES = 32_768; // 32 KiB

export interface LogEntry {
  sequence: number;
  stream: "stdout" | "stderr" | "system";
  message: string;
}

function byteLength(entry: LogEntry): number {
  return Buffer.byteLength(entry.message, "utf-8");
}

/**
 * Merge incoming log entries into an existing log, enforcing:
 *   - MAX_LOG_LINES: oldest entries dropped once exceeded
 *   - MAX_LOG_BYTES: oldest entries dropped once exceeded (checked after
 *     the line-count trim, since either bound alone could be satisfied
 *     while the other is still violated)
 *   - a truncation marker is added (as a "system" entry) the first time
 *     entries get dropped, so the UI can show "earlier logs truncated"
 *     rather than silently losing lines
 *
 * Returns the new merged+capped log and whether truncation occurred this
 * call (so the caller can decide whether to insert a marker only once).
 */
export function mergeAndCapLog(
  existing: LogEntry[],
  incoming: LogEntry[],
  maxLines: number = MAX_LOG_LINES,
  maxBytes: number = MAX_LOG_BYTES,
): { log: LogEntry[]; truncated: boolean } {
  let merged = [...existing, ...incoming];
  let truncated = false;

  if (merged.length > maxLines) {
    merged = merged.slice(merged.length - maxLines);
    truncated = true;
  }

  let totalBytes = merged.reduce((sum, e) => sum + byteLength(e), 0);
  while (totalBytes > maxBytes && merged.length > 0) {
    const dropped = merged.shift();
    if (dropped) {
      totalBytes -= byteLength(dropped);
      truncated = true;
    }
  }

  return { log: merged, truncated };
}

/**
 * Validate an incoming log upload batch against the per-upload caps
 * (distinct from the total-log caps above — this is what the agent's
 * single POST is allowed to contain, matching AppendLogBatchSchema's
 * existing max(100) but ALSO checking total byte size, which the
 * existing schema doesn't enforce in aggregate, only per-message).
 */
export function validateUploadBatch(entries: LogEntry[]): void {
  if (entries.length === 0) {
    throw new Error("log batch must not be empty");
  }
  if (entries.length > MAX_UPLOAD_BATCH_LINES) {
    throw new Error(
      `log batch exceeds ${MAX_UPLOAD_BATCH_LINES} lines (got ${entries.length})`,
    );
  }
  const totalBytes = entries.reduce((sum, e) => sum + byteLength(e), 0);
  if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
    throw new Error(
      `log batch exceeds ${MAX_UPLOAD_BATCH_BYTES} bytes (got ${totalBytes})`,
    );
  }
}

/**
 * Enforce the queue-length cap: returns true if a new job may be pushed
 * onto an agent's queue given its current length.
 */
export function canEnqueue(currentQueueLength: number): boolean {
  return currentQueueLength < MAX_QUEUE_LENGTH;
}

/**
 * Trim a history list (most-recent-first) down to MAX_HISTORY_LENGTH
 * after appending a new job id.
 */
export function appendToHistory(
  history: string[],
  newJobId: string,
  maxLength: number = MAX_HISTORY_LENGTH,
): string[] {
  const updated = [newJobId, ...history.filter((id) => id !== newJobId)];
  return updated.slice(0, maxLength);
>>>>>>> 8ef9a552828fca2885ac621be4efd4d25a15997f
}
