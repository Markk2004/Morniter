export const JOB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const LEASE_SECONDS = 45;
export const PRESENCE_IDLE_SECONDS = 30;
export const PRESENCE_OFFLINE_SECONDS = 75;
export const MAX_LOG_LINES = 5000;
export const MAX_LOG_BYTES = 1024 * 1024; // 1 MiB

export const runnerKeys = {
  catalog: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:catalog`,
  presence: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:presence`,
  queue: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:queue`,
  active: (agentId: string) => `morniter:test-runner:v2:agent:${agentId}:active`,
  job: (jobId: string) => `morniter:test-runner:v2:job:${jobId}`,
  logs: (jobId: string) => `morniter:test-runner:v2:job:${jobId}:logs`,
  logSequences: (jobId: string) => `morniter:test-runner:v2:job:${jobId}:sequences`,
  idempotency: (key: string) => `morniter:test-runner:v2:idempotency:${key}`,
  history: "morniter:test-runner:v2:history",
};
