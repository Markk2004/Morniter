export type TestRunnerErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_IDEMPOTENCY_KEY"
  | "INVALID_AGENT_PAYLOAD"
  | "ACTIVE_JOB_EXISTS"
  | "QUEUE_FULL"
  | "UNKNOWN_PRESET"
  | "JOB_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "AGENT_JOB_MISMATCH"
  | "UNAUTHORIZED"
  | "EXECUTION_REQUIRED"
  | "REDIS_UNAVAILABLE";

export class TestRunnerError extends Error {
  constructor(
    readonly status: number,
    readonly code: TestRunnerErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "TestRunnerError";
  }
}

export class ActiveJobExistsError extends TestRunnerError {
  constructor(readonly activeJobId?: string, readonly activeJob?: unknown) {
    super(
      409,
      "ACTIVE_JOB_EXISTS",
      `Agent already has an active job running (${activeJobId || "active"})`,
    );
    this.name = "ActiveJobExistsError";
  }
}

export class QueueFullError extends TestRunnerError {
  constructor() {
    super(409, "QUEUE_FULL", "Job queue is full (maximum 10 queued jobs allowed)");
    this.name = "QueueFullError";
  }
}

export class UnknownPresetError extends TestRunnerError {
  constructor(message = "Unknown project or preset ID") {
    super(400, "UNKNOWN_PRESET", message);
    this.name = "UnknownPresetError";
  }
}

export class JobNotFoundError extends TestRunnerError {
  constructor(jobId?: string) {
    super(404, "JOB_NOT_FOUND", `Job ${jobId || ""} not found`);
    this.name = "JobNotFoundError";
  }
}

export class AgentJobOwnershipError extends TestRunnerError {
  constructor() {
    super(409, "AGENT_JOB_MISMATCH", "Job is owned by a different agent");
    this.name = "AgentJobOwnershipError";
  }
}

export class RedisUnavailableError extends TestRunnerError {
  constructor(message = "Redis storage service unavailable") {
    super(503, "REDIS_UNAVAILABLE", message);
    this.name = "RedisUnavailableError";
  }
}
