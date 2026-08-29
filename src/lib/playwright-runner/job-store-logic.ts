/**
 * ⚠️ SUPERSEDED — DO NOT USE. A real ./job-store-logic.ts already exists
 * in the actual repo (proven by job-store.ts's imports: playwrightKeys,
 * JOB_TTL_SECONDS, PRESENCE_TTL_SECONDS, LEASE_SECONDS, MAX_HISTORY_ITEMS,
 * assertPlaywrightTransition, isPlaywrightActiveStatus, and four error
 * classes — none of which this file defines). This file was written
 * speculatively before job-store.ts was shared and has a COMPLETELY
 * DIFFERENT, incompatible API (mergeAndCapLog/canEnqueue/etc.). Dropping
 * both files in the same folder will fail to compile. Once the real
 * job-store-logic.ts is available, delete this file entirely — do not
 * try to merge them, they solve the same problem two different ways.
 *
 * Original content kept below only for reference to what was learned
 * along the way (the log-cap/queue-cap/history-cap logic itself may
 * still be useful reading even though the API shape is wrong).
 */

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
}
