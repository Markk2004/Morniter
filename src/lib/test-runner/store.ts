import "server-only";
import { getRunnerRedis } from "./redis";
import { runnerKeys, JOB_TTL_SECONDS, LEASE_SECONDS, MAX_LOG_LINES, MAX_LOG_BYTES } from "./keys";
import type {
  TestProjectCatalog,
  TestJob,
  TestJobStatus,
  TestLogStream,
  TestLogLine,
  TestLogPage,
  TestProgress,
  AgentPresence,
} from "./types";
import {
  ActiveJobExistsError,
  QueueFullError,
  UnknownPresetError,
  JobNotFoundError,
  AgentJobOwnershipError,
} from "./errors";
import { assertTransition, isActiveStatus } from "./lifecycle";
import { redactText } from "@/lib/monitor/redact";

export {
  ActiveJobExistsError,
  QueueFullError,
  UnknownPresetError,
  JobNotFoundError,
  AgentJobOwnershipError,
};

const MAX_QUEUE_SIZE = 10;

export async function publishCatalog(
  catalog: TestProjectCatalog,
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
): Promise<void> {
  const redis = getRunnerRedis();
  const catKey = runnerKeys.catalog(agentId);
  const presKey = runnerKeys.presence(agentId);

  await redis.set(catKey, catalog, { ex: JOB_TTL_SECONDS });

  const activeJobId = (await redis.get<string>(runnerKeys.active(agentId))) || undefined;
  const presence: AgentPresence = {
    agentId,
    state: "online",
    lastHeartbeatAt: now.toISOString(),
    activeJobId,
  };
  await redis.set(presKey, presence, { ex: 75 });
}

export async function getCatalog(
  agentId = "windows-local-agent-1",
): Promise<TestProjectCatalog | null> {
  const redis = getRunnerRedis();
  const data = await redis.get<TestProjectCatalog>(runnerKeys.catalog(agentId));
  return data ?? null;
}

export async function getAgentPresence(
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
): Promise<AgentPresence | null> {
  const redis = getRunnerRedis();
  const pres = await redis.get<AgentPresence>(runnerKeys.presence(agentId));
  if (!pres) {
    return {
      agentId,
      state: "offline",
      lastHeartbeatAt: new Date(0).toISOString(),
    };
  }

  const elapsedMs = now.getTime() - new Date(pres.lastHeartbeatAt).getTime();
  let state: AgentPresence["state"] = "online";
  if (elapsedMs > 75000) {
    state = "offline";
  } else if (elapsedMs > 30000) {
    state = "lagging";
  }

  return { ...pres, state };
}

export async function enqueueJob(
  input: { projectId: string; presetId: string },
  requesterHash: string,
  idempotencyKey: string,
  providedCatalog?: TestProjectCatalog | null,
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
): Promise<TestJob> {
  const redis = getRunnerRedis();
  const idempKey = runnerKeys.idempotency(idempotencyKey);

  // Check idempotency replay
  const existingJobId = await redis.get<string>(idempKey);
  if (existingJobId) {
    const existingJob = await redis.get<TestJob>(runnerKeys.job(existingJobId));
    if (existingJob) {
      return existingJob;
    }
  }

  // Check queue size
  const queueKey = runnerKeys.queue(agentId);
  const queueLength = await redis.llen(queueKey);
  if (queueLength >= MAX_QUEUE_SIZE) {
    throw new QueueFullError();
  }

  // Check if agent already has an active job running
  const activeKey = runnerKeys.active(agentId);
  const currentActiveJobId = await redis.get<string>(activeKey);
  if (currentActiveJobId) {
    const currentActiveJob = await redis.get<TestJob>(runnerKeys.job(currentActiveJobId));
    if (currentActiveJob && isActiveStatus(currentActiveJob.status)) {
      throw new ActiveJobExistsError(currentActiveJobId, currentActiveJob);
    }
  }

  const catalog = providedCatalog ?? (await getCatalog(agentId));
  if (!catalog) {
    throw new UnknownPresetError("Catalog unavailable or agent offline");
  }

  const project = catalog.projects.find((p) => p.id === input.projectId);
  const preset = project?.presets.find((p) => p.id === input.presetId);

  if (!project || !preset) {
    throw new UnknownPresetError(`Preset ${input.presetId} not found in project ${input.projectId}`);
  }

  const jobId = `job-${now.getTime()}-${Math.random().toString(36).substring(2, 8)}`;
  const nowStr = now.toISOString();

  const job: TestJob = {
    id: jobId,
    idempotencyKey,
    agentId,
    projectId: input.projectId,
    presetId: input.presetId,
    presetName: preset.name,
    status: "queued",
    queuedAt: nowStr,
    logBytes: 0,
    logLines: 0,
  };

  const jobKey = runnerKeys.job(jobId);
  await redis.set(jobKey, job, { ex: JOB_TTL_SECONDS });
  await redis.set(idempKey, jobId, { ex: 3600 });
  await redis.set(activeKey, jobId, { ex: JOB_TTL_SECONDS });
  await redis.rpush(queueKey, jobId);
  await redis.zadd(runnerKeys.history, { score: now.getTime(), member: jobId });

  return job;
}

export async function claimNextJob(
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
): Promise<TestJob | null> {
  const redis = getRunnerRedis();
  const queueKey = runnerKeys.queue(agentId);

  while (true) {
    const jobId = await redis.lpop<string>(queueKey);
    if (!jobId) {
      return null;
    }

    const jobKey = runnerKeys.job(jobId);
    const job = await redis.get<TestJob>(jobKey);
    if (!job || job.status !== "queued") {
      continue;
    }

    const nowStr = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString();

    assertTransition(job.status, "claimed");

    const updated: TestJob = {
      ...job,
      status: "claimed",
      claimedAt: nowStr,
      leaseExpiresAt,
      lastHeartbeatAt: nowStr,
    };

    await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
    return updated;
  }
}

export async function heartbeatJob(
  jobId: string,
  agentId: string,
  progress?: TestProgress,
  now: Date = new Date(),
): Promise<{ cancelRequested: boolean; leaseExpiresAt: string }> {
  const redis = getRunnerRedis();
  const jobKey = runnerKeys.job(jobId);
  const job = await redis.get<TestJob>(jobKey);

  if (!job) {
    throw new JobNotFoundError(jobId);
  }

  if (job.agentId !== agentId) {
    throw new AgentJobOwnershipError();
  }

  const nowStr = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString();

  let newStatus = job.status;
  if (job.status === "claimed") {
    newStatus = "running";
  }

  const updated: TestJob = {
    ...job,
    status: newStatus,
    startedAt: job.startedAt || nowStr,
    leaseExpiresAt,
    lastHeartbeatAt: nowStr,
    progress: progress || job.progress,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });

  // Update Agent Presence
  const presKey = runnerKeys.presence(agentId);
  const presence: AgentPresence = {
    agentId,
    state: "online",
    lastHeartbeatAt: nowStr,
    activeJobId: jobId,
  };
  await redis.set(presKey, presence, { ex: 75 });

  return {
    cancelRequested: Boolean(job.cancelRequested),
    leaseExpiresAt,
  };
}

export async function appendLogBatch(
  jobId: string,
  sequenceStart: number,
  entries: Array<{ stream: TestLogStream; message: string }>,
  progress?: TestProgress,
  now: Date = new Date(),
): Promise<{ sequenceStart: number; nextSequence: number; truncated: boolean }> {
  const redis = getRunnerRedis();
  const jobKey = runnerKeys.job(jobId);
  const logsKey = runnerKeys.logs(jobId);

  const job = await redis.get<TestJob>(jobKey);
  if (!job) {
    throw new JobNotFoundError(jobId);
  }

  if (job.truncated) {
    return { sequenceStart, nextSequence: sequenceStart, truncated: true };
  }

  const nowStr = now.toISOString();
  let currentBytes = job.logBytes || 0;
  let currentLines = job.logLines || 0;
  let isTruncated = false;

  const linesToAdd: TestLogLine[] = [];
  let seqCounter = sequenceStart;

  for (const entry of entries) {
    const redactedMsg = redactText(entry.message);
    const lineByteLength = Buffer.byteLength(redactedMsg, "utf-8");

    if (currentLines + 1 > MAX_LOG_LINES || currentBytes + lineByteLength > MAX_LOG_BYTES) {
      isTruncated = true;
      break;
    }

    linesToAdd.push({
      sequence: seqCounter++,
      stream: entry.stream,
      message: redactedMsg,
      timestamp: nowStr,
    });

    currentLines += 1;
    currentBytes += lineByteLength;
  }

  for (const line of linesToAdd) {
    await redis.zadd(logsKey, { score: line.sequence, member: JSON.stringify(line) });
  }
  await redis.expire(logsKey, JOB_TTL_SECONDS);

  const updatedJob: TestJob = {
    ...job,
    status: job.status === "claimed" ? "running" : job.status,
    logLines: currentLines,
    logBytes: currentBytes,
    truncated: isTruncated || job.truncated,
    progress: progress || job.progress,
    lastHeartbeatAt: nowStr,
    leaseExpiresAt: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString(),
  };

  await redis.set(jobKey, updatedJob, { ex: JOB_TTL_SECONDS });

  return {
    sequenceStart,
    nextSequence: seqCounter,
    truncated: Boolean(updatedJob.truncated),
  };
}

export async function readLogPage(
  jobId: string,
  afterSequence = -1,
  limit = 200,
): Promise<TestLogPage> {
  const redis = getRunnerRedis();
  const jobKey = runnerKeys.job(jobId);
  const logsKey = runnerKeys.logs(jobId);

  const job = await redis.get<TestJob>(jobKey);
  if (!job) {
    throw new JobNotFoundError(jobId);
  }

  const minScore = afterSequence + 1;
  const rawMembers = await redis.zrange<string[]>(logsKey, minScore, "+inf", {
    byScore: true,
  });

  const allLines: TestLogLine[] = (rawMembers || []).map((raw) =>
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );

  const sliced = allLines.slice(0, limit);
  const hasMore = allLines.length > limit;
  const nextSeq = sliced.length > 0 ? sliced[sliced.length - 1].sequence + 1 : afterSequence + 1;

  return {
    jobId,
    lines: sliced,
    nextSequence: nextSeq,
    hasMore,
    truncated: job.truncated,
  };
}

export async function completeJob(
  jobId: string,
  result: {
    status: TestJobStatus;
    exitCode?: number | null;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
  },
): Promise<TestJob> {
  const redis = getRunnerRedis();
  const jobKey = runnerKeys.job(jobId);
  const job = await redis.get<TestJob>(jobKey);

  if (!job) {
    throw new JobNotFoundError(jobId);
  }

  assertTransition(job.status, result.status);

  const updated: TestJob = {
    ...job,
    status: result.status,
    exitCode: result.exitCode ?? null,
    startedAt: result.startedAt ?? job.startedAt,
    finishedAt: result.finishedAt ?? new Date().toISOString(),
    error: result.error,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
  await redis.del(runnerKeys.active(job.agentId));
  return updated;
}

export async function requestCancel(jobId: string): Promise<TestJob> {
  const redis = getRunnerRedis();
  const jobKey = runnerKeys.job(jobId);
  const job = await redis.get<TestJob>(jobKey);

  if (!job) {
    throw new JobNotFoundError(jobId);
  }

  let newStatus = job.status;
  if (job.status === "queued") {
    newStatus = "cancelled";
  } else if (job.status === "running" || job.status === "claimed") {
    newStatus = "cancel_requested";
  }

  const updated: TestJob = {
    ...job,
    cancelRequested: true,
    status: newStatus,
    finishedAt: newStatus === "cancelled" ? new Date().toISOString() : job.finishedAt,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
  if (newStatus === "cancelled") {
    await redis.del(runnerKeys.active(job.agentId));
  }
  return updated;
}

export async function reapStaleJobs(now: Date = new Date()): Promise<string[]> {
  const redis = getRunnerRedis();
  const jobIds = await redis.zrange<string[]>(runnerKeys.history, 0, -1);
  const reapedIds: string[] = [];

  for (const id of jobIds || []) {
    const jobKey = runnerKeys.job(id);
    const job = await redis.get<TestJob>(jobKey);

    if (!job || !isActiveStatus(job.status)) {
      continue;
    }

    if (job.leaseExpiresAt && new Date(job.leaseExpiresAt).getTime() < now.getTime()) {
      const updated: TestJob = {
        ...job,
        status: "agent_lost",
        finishedAt: now.toISOString(),
        error: "Agent heartbeat lost (lease expired)",
      };
      await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
      await redis.del(runnerKeys.active(job.agentId));
      reapedIds.push(id);
    }
  }

  return reapedIds;
}

export async function listJobs(limit = 20): Promise<TestJob[]> {
  const redis = getRunnerRedis();
  const jobIds = await redis.zrange<string[]>(runnerKeys.history, 0, limit - 1, { rev: true });
  if (!jobIds || jobIds.length === 0) {
    return [];
  }

  const jobs: TestJob[] = [];
  for (const id of jobIds) {
    const jobKey = runnerKeys.job(id);
    const job = await redis.get<TestJob>(jobKey);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

export async function getJob(jobId: string): Promise<TestJob | null> {
  const redis = getRunnerRedis();
  return (await redis.get<TestJob>(runnerKeys.job(jobId))) ?? null;
}
