import "server-only";
import { getRunnerRedis } from "./redis";
import { LEASE_SECONDS, runnerKeys } from "./keys";

export type JobReservationResult =
  | { kind: "acquired"; jobId: string }
  | { kind: "idempotent"; jobId: string }
  | { kind: "active"; jobId: string }
  | { kind: "queue_full"; jobId: null };

const RESERVE_SCRIPT = `
local existing = redis.call("GET", KEYS[1])
if existing then return {"IDEMPOTENT", existing} end
local active = redis.call("GET", KEYS[2])
if active then return {"ACTIVE", active} end
if tonumber(redis.call("LLEN", KEYS[3])) >= tonumber(ARGV[2]) then
  return {"QUEUE_FULL", ""}
end
redis.call("SET", KEYS[1], ARGV[1], "EX", 30)
redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[3])
return {"ACQUIRED", ARGV[1]}
`;

const RENEW_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
  return redis.call("EXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export async function reserveJobCreation(
  agentId: string,
  idempotencyKey: string,
  jobId: string,
): Promise<JobReservationResult> {
  const [status, reservedJobId] = await getRunnerRedis().eval<
    [string, string, string],
    [string, string]
  >(
    RESERVE_SCRIPT,
    [runnerKeys.idempotency(idempotencyKey), runnerKeys.active(agentId), runnerKeys.queue(agentId)],
    [jobId, "1", String(LEASE_SECONDS)],
  );
  if (status === "ACQUIRED") return { kind: "acquired", jobId: reservedJobId };
  if (status === "IDEMPOTENT") return { kind: "idempotent", jobId: reservedJobId };
  if (status === "ACTIVE") return { kind: "active", jobId: reservedJobId };
  return { kind: "queue_full", jobId: null };
}

export async function readActiveLease(agentId: string): Promise<string | null> {
  return (await getRunnerRedis().get<string>(runnerKeys.active(agentId))) ?? null;
}

export async function renewActiveLease(agentId: string, jobId: string): Promise<boolean> {
  const result = await getRunnerRedis().eval<[string, string], number>(
    RENEW_SCRIPT,
    [runnerKeys.active(agentId)],
    [jobId, String(LEASE_SECONDS)],
  );
  return result === 1;
}

export async function releaseActiveLease(agentId: string, jobId: string): Promise<boolean> {
  const result = await getRunnerRedis().eval<[string], number>(
    RELEASE_SCRIPT,
    [runnerKeys.active(agentId)],
    [jobId],
  );
  return result === 1;
}

export async function commitIdempotencyReservation(
  idempotencyKey: string,
  jobId: string,
): Promise<boolean> {
  const result = await getRunnerRedis().eval<[string, string], number>(
    RENEW_SCRIPT,
    [runnerKeys.idempotency(idempotencyKey)],
    [jobId, "3600"],
  );
  return result === 1;
}

export async function releaseIdempotencyReservation(
  idempotencyKey: string,
  jobId: string,
): Promise<boolean> {
  const result = await getRunnerRedis().eval<[string], number>(
    RELEASE_SCRIPT,
    [runnerKeys.idempotency(idempotencyKey)],
    [jobId],
  );
  return result === 1;
}
