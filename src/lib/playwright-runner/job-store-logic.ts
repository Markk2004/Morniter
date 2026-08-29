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
}
