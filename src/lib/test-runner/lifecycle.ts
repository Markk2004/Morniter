import { TestRunnerError } from "./errors";

export type TestJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "passed"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out"
  | "agent_lost";

export class InvalidJobTransitionError extends TestRunnerError {
  constructor(from: TestJobStatus, to: TestJobStatus) {
    super(
      400,
      "INVALID_TRANSITION",
      `Invalid job status transition from "${from}" to "${to}"`,
    );
    this.name = "InvalidJobTransitionError";
  }
}

const ACTIVE_STATUSES = new Set<TestJobStatus>([
  "queued",
  "claimed",
  "running",
  "cancel_requested",
]);

const TERMINAL_STATUSES = new Set<TestJobStatus>([
  "passed",
  "failed",
  "cancelled",
  "timed_out",
  "agent_lost",
]);

const ALLOWED_TRANSITIONS: Record<TestJobStatus, Set<TestJobStatus>> = {
  queued: new Set(["claimed", "cancelled"]),
  claimed: new Set(["running", "passed", "failed", "cancelled", "agent_lost"]),
  running: new Set(["passed", "failed", "cancel_requested", "timed_out", "agent_lost"]),
  cancel_requested: new Set(["cancelled", "agent_lost"]),
  passed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  timed_out: new Set(),
  agent_lost: new Set(),
};

export function isActiveStatus(status: TestJobStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function isTerminalStatus(status: TestJobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function assertTransition(from: TestJobStatus, to: TestJobStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    throw new InvalidJobTransitionError(from, to);
  }
}
