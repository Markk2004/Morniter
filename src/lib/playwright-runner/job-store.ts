import "server-only";
import { getRunnerRedis } from "@/lib/test-runner/redis";
import type { Redis } from "@upstash/redis";
import {
  JOB_TTL_SECONDS,
  PRESENCE_TTL_SECONDS,
  LEASE_SECONDS,
  MAX_QUEUE_LENGTH,
  MAX_HISTORY_ITEMS,
  playwrightKeys,
  PlaywrightActiveJobExistsError,
  PlaywrightQueueFullError,
  PlaywrightJobNotFoundError,
  PlaywrightAgentOwnershipError,
  assertPlaywrightTransition,
  isPlaywrightActiveStatus,
} from "./job-store-logic";
import type {
  PlaywrightCatalog,
  PlaywrightJob,
  PlaywrightJobRequest,
  PlaywrightJobStatus,
  PlaywrightLogChunk,
  BrowserExecutionResult,
  TestArtifact,
} from "./types";
import { redactText } from "@/lib/monitor/redact";

export interface PlaywrightLogPage {
  jobId: string;
  lines: PlaywrightLogChunk[];
  nextSequence: number;
  hasMore: boolean;
  truncated?: boolean;
}

export interface PlaywrightAgentPresence {
  agentId: string;
  state: "online" | "lagging" | "offline";
  lastHeartbeatAt: string;
  activeJobId?: string;
  capabilities?: {
    browsers?: {
      chromium?: boolean;
      firefox?: boolean;
      webkit?: boolean;
    };
    headed?: boolean;
    workspaceExecution?: boolean;
  };
}

export async function publishPlaywrightCatalog(
  catalog: PlaywrightCatalog,
  capabilities?: PlaywrightAgentPresence["capabilities"],
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<void> {
  const redis = redisClient ?? getRunnerRedis();
  const catKey = playwrightKeys.catalog(agentId);
  const presKey = playwrightKeys.presence(agentId);

  await redis.set(catKey, catalog, { ex: JOB_TTL_SECONDS });

  const activeJobId = (await redis.get<string>(playwrightKeys.active(agentId))) ?? undefined;
  const presence: PlaywrightAgentPresence = {
    agentId,
    state: "online",
    lastHeartbeatAt: now.toISOString(),
    activeJobId,
    capabilities,
  };
  await redis.set(presKey, presence, { ex: PRESENCE_TTL_SECONDS });
}

export async function heartbeatPlaywrightAgent(
  capabilities?: PlaywrightAgentPresence["capabilities"],
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<void> {
  const redis = redisClient ?? getRunnerRedis();
  const activeJobId = (await redis.get<string>(playwrightKeys.active(agentId))) ?? undefined;
  await redis.set(
    playwrightKeys.presence(agentId),
    {
      agentId,
      state: "online",
      lastHeartbeatAt: now.toISOString(),
      activeJobId,
      capabilities,
    } satisfies PlaywrightAgentPresence,
    { ex: PRESENCE_TTL_SECONDS },
  );
}

export async function getPlaywrightCatalog(
  agentId = "windows-local-agent-1",
  redisClient?: Redis,
): Promise<PlaywrightCatalog | null> {
  const redis = redisClient ?? getRunnerRedis();
  const data = await redis.get<PlaywrightCatalog>(playwrightKeys.catalog(agentId));
  return data ?? null;
}

export async function getPlaywrightAgentPresence(
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<PlaywrightAgentPresence | null> {
  const redis = redisClient ?? getRunnerRedis();
  const pres = await redis.get<PlaywrightAgentPresence>(playwrightKeys.presence(agentId));
  if (!pres) {
    return {
      agentId,
      state: "offline",
      lastHeartbeatAt: new Date(0).toISOString(),
    };
  }

  const elapsedMs = now.getTime() - new Date(pres.lastHeartbeatAt).getTime();
  let state: PlaywrightAgentPresence["state"] = "online";
  if (elapsedMs > 75000) {
    state = "offline";
  } else if (elapsedMs > 30000) {
    state = "lagging";
  }

  return { ...pres, state };
}

export async function enqueuePlaywrightJob(
  request: PlaywrightJobRequest,
  agentId = "windows-local-agent-1",
  idempotencyKey?: string,
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<PlaywrightJob> {
  const redis = redisClient ?? getRunnerRedis();

  if (idempotencyKey) {
    const existingJobId = await redis.get<string>(playwrightKeys.idempotency(idempotencyKey));
    if (existingJobId) {
      const existing = await getPlaywrightJob(existingJobId, redis);
      if (existing) {
        return existing;
      }
    }
  }

  // Check active lease
  const activeJobId = await redis.get<string>(playwrightKeys.active(agentId));
  if (activeJobId) {
    const activeJob = await getPlaywrightJob(activeJobId, redis);
    if (activeJob && isPlaywrightActiveStatus(activeJob.status)) {
      throw new PlaywrightActiveJobExistsError(activeJobId);
    }
  }

  // Check queue length
  const queueLen = await redis.llen(playwrightKeys.queue(agentId));
  if (queueLen >= MAX_QUEUE_LENGTH) {
    throw new PlaywrightQueueFullError();
  }

  const jobId = `plw-${now.getTime()}-${Math.random().toString(36).substring(2, 8)}`;
  const nowStr = now.toISOString();

  const initialResults: BrowserExecutionResult[] = request.browsers.map((b) => ({
    browser: b,
    status: "waiting",
    passed: 0,
    failed: 0,
    skipped: 0,
  }));

  const job: PlaywrightJob = {
    id: jobId,
    agentId,
    projectId: request.projectId,
    source: request.source,
    testIds: request.source === "project-test" ? request.testIds : undefined,
    code: request.source === "workspace" ? request.code : undefined,
    browsers: request.browsers,
    mode: request.mode,
    status: "queued",
    browserResults: initialResults,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  const jobKey = playwrightKeys.job(jobId);
  const queueKey = playwrightKeys.queue(agentId);

  await redis.set(jobKey, job, { ex: JOB_TTL_SECONDS });
  await redis.rpush(queueKey, jobId);
  await redis.zadd(playwrightKeys.history, { score: now.getTime(), member: jobId });

  if (idempotencyKey) {
    await redis.set(playwrightKeys.idempotency(idempotencyKey), jobId, { ex: 3600 });
  }

  return job;
}

export async function claimNextPlaywrightJob(
  agentId = "windows-local-agent-1",
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<PlaywrightJob | null> {
  const redis = redisClient ?? getRunnerRedis();
  const queueKey = playwrightKeys.queue(agentId);

  while (true) {
    const jobId = await redis.lpop<string>(queueKey);
    if (!jobId) {
      return null;
    }

    const jobKey = playwrightKeys.job(jobId);
    const job = await redis.get<PlaywrightJob>(jobKey);
    if (!job || job.status !== "queued") {
      continue;
    }

    assertPlaywrightTransition(job.status, "claimed");

    // Acquire active lease
    const activeKey = playwrightKeys.active(agentId);
    const acquired = await redis.set(activeKey, jobId, { nx: true, ex: LEASE_SECONDS });
    if (!acquired) {
      const currentActive = await redis.get<string>(activeKey);
      if (currentActive !== jobId) {
        // Return to queue front or drop if another job active
        continue;
      }
    }

    const nowStr = now.toISOString();
    const updated: PlaywrightJob = {
      ...job,
      status: "claimed",
      startedAt: nowStr,
      lastHeartbeatAt: nowStr,
      updatedAt: nowStr,
    };

    await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
    return updated;
  }
}

export async function heartbeatPlaywrightJob(
  jobId: string,
  agentId: string,
  browserResults?: BrowserExecutionResult[],
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<{ cancelRequested: boolean }> {
  const redis = redisClient ?? getRunnerRedis();
  const jobKey = playwrightKeys.job(jobId);
  const job = await redis.get<PlaywrightJob>(jobKey);

  if (!job) {
    throw new PlaywrightJobNotFoundError(jobId);
  }

  if (job.agentId !== agentId) {
    throw new PlaywrightAgentOwnershipError();
  }

  const activeKey = playwrightKeys.active(agentId);
  await redis.set(activeKey, jobId, { ex: LEASE_SECONDS });

  const nowStr = now.toISOString();
  let nextStatus = job.status;
  if (job.status === "claimed") {
    nextStatus = "running";
  }

  const updated: PlaywrightJob = {
    ...job,
    status: nextStatus,
    browserResults: browserResults || job.browserResults,
    lastHeartbeatAt: nowStr,
    updatedAt: nowStr,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });

  // Update presence
  const presKey = playwrightKeys.presence(agentId);
  await redis.set(
    presKey,
    {
      agentId,
      state: "online",
      lastHeartbeatAt: nowStr,
      activeJobId: jobId,
    },
    { ex: PRESENCE_TTL_SECONDS },
  );

  return {
    cancelRequested: job.status === "cancel_requested",
  };
}

export async function appendPlaywrightLogBatch(
  jobId: string,
  sequenceStart: number,
  entries: Array<{ stream: "stdout" | "stderr" | "system"; message: string; browser?: PlaywrightJob["browsers"][number] }>,
  browserResults?: BrowserExecutionResult[],
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<{ sequenceStart: number; nextSequence: number; truncated: boolean }> {
  const redis = redisClient ?? getRunnerRedis();
  const jobKey = playwrightKeys.job(jobId);
  const logsKey = playwrightKeys.logs(jobId);

  const job = await redis.get<PlaywrightJob>(jobKey);
  if (!job) {
    throw new PlaywrightJobNotFoundError(jobId);
  }

  const nowStr = now.toISOString();
  const linesToAdd: PlaywrightLogChunk[] = [];
  let seqCounter = sequenceStart;

  for (const entry of entries) {
    const redactedMsg = redactText(entry.message);
    linesToAdd.push({
      sequence: seqCounter++,
      stream: entry.stream,
      browser: entry.browser,
      text: redactedMsg,
      timestamp: nowStr,
    });
  }

  for (const line of linesToAdd) {
    await redis.zadd(logsKey, { score: line.sequence, member: JSON.stringify(line) });
  }
  await redis.expire(logsKey, JOB_TTL_SECONDS);

  const updatedJob: PlaywrightJob = {
    ...job,
    status: job.status === "claimed" ? "running" : job.status,
    browserResults: browserResults || job.browserResults,
    lastHeartbeatAt: nowStr,
    updatedAt: nowStr,
  };

  await redis.set(jobKey, updatedJob, { ex: JOB_TTL_SECONDS });

  return {
    sequenceStart,
    nextSequence: seqCounter,
    truncated: false,
  };
}

export async function readPlaywrightLogPage(
  jobId: string,
  afterSequence = -1,
  limit = 200,
  redisClient?: Redis,
): Promise<PlaywrightLogPage> {
  const redis = redisClient ?? getRunnerRedis();
  const jobKey = playwrightKeys.job(jobId);
  const logsKey = playwrightKeys.logs(jobId);

  const job = await redis.get<PlaywrightJob>(jobKey);
  if (!job) {
    throw new PlaywrightJobNotFoundError(jobId);
  }

  const minScore = afterSequence + 1;
  const rawMembers = await redis.zrange<string[]>(logsKey, minScore, "+inf", {
    byScore: true,
  });

  const allLines: PlaywrightLogChunk[] = (rawMembers || []).map((raw) =>
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
  };
}

export async function completePlaywrightJob(
  jobId: string,
  result: {
    status: PlaywrightJobStatus;
    browserResults?: BrowserExecutionResult[];
    runnerResults?: import("./types").NativeGroupResult[];
    artifacts?: TestArtifact[];
    startedAt?: string;
    finishedAt?: string;
    error?: string;
  },
  redisClient?: Redis,
): Promise<PlaywrightJob> {
  const redis = redisClient ?? getRunnerRedis();
  const jobKey = playwrightKeys.job(jobId);
  const job = await redis.get<PlaywrightJob>(jobKey);

  if (!job) {
    throw new PlaywrightJobNotFoundError(jobId);
  }

  assertPlaywrightTransition(job.status, result.status);

  const nowStr = new Date().toISOString();
  const updated: PlaywrightJob = {
    ...job,
    status: result.status,
    browserResults: result.browserResults || job.browserResults,
    runnerResults: result.runnerResults || job.runnerResults,
    artifacts: result.artifacts || job.artifacts,
    startedAt: result.startedAt ?? job.startedAt,
    completedAt: result.finishedAt ?? nowStr,
    updatedAt: nowStr,
    error: result.error,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
  await redis.del(playwrightKeys.active(job.agentId));
  return updated;
}

export async function requestCancelPlaywrightJob(
  jobId: string,
  redisClient?: Redis,
): Promise<PlaywrightJob> {
  const redis = redisClient ?? getRunnerRedis();
  const jobKey = playwrightKeys.job(jobId);
  const job = await redis.get<PlaywrightJob>(jobKey);

  if (!job) {
    throw new PlaywrightJobNotFoundError(jobId);
  }

  let newStatus: PlaywrightJobStatus = job.status;
  if (job.status === "queued") {
    newStatus = "cancelled";
  } else if (job.status === "claimed" || job.status === "preparing" || job.status === "running") {
    newStatus = "cancel_requested";
  }

  assertPlaywrightTransition(job.status, newStatus);

  const nowStr = new Date().toISOString();
  const updated: PlaywrightJob = {
    ...job,
    status: newStatus,
    cancelRequestedAt: nowStr,
    completedAt: newStatus === "cancelled" ? nowStr : job.completedAt,
    updatedAt: nowStr,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
  if (newStatus === "cancelled") {
    await redis.del(playwrightKeys.active(job.agentId));
  }
  return updated;
}

export async function listPlaywrightJobs(
  limit = MAX_HISTORY_ITEMS,
  redisClient?: Redis,
): Promise<PlaywrightJob[]> {
  const redis = redisClient ?? getRunnerRedis();
  const jobIds = await redis.zrange<string[]>(playwrightKeys.history, 0, limit - 1, { rev: true });
  if (!jobIds || jobIds.length === 0) {
    return [];
  }

  const jobs: PlaywrightJob[] = [];
  for (const id of jobIds) {
    const job = await getPlaywrightJob(id, redis);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

export async function getPlaywrightJob(
  jobId: string,
  redisClient?: Redis,
): Promise<PlaywrightJob | null> {
  const redis = redisClient ?? getRunnerRedis();
  return (await redis.get<PlaywrightJob>(playwrightKeys.job(jobId))) ?? null;
}

export async function reapStalePlaywrightJobs(
  now: Date = new Date(),
  redisClient?: Redis,
): Promise<string[]> {
  const redis = redisClient ?? getRunnerRedis();
  const jobIds = await redis.zrange<string[]>(playwrightKeys.history, 0, -1);
  const reaped: string[] = [];

  for (const id of jobIds || []) {
    const job = await getPlaywrightJob(id, redis);
    if (!job || !isPlaywrightActiveStatus(job.status)) {
      continue;
    }

    const lastHeartbeat = job.lastHeartbeatAt ? new Date(job.lastHeartbeatAt).getTime() : 0;
    if (lastHeartbeat > 0 && now.getTime() - lastHeartbeat > LEASE_SECONDS * 2000) {
      const updated: PlaywrightJob = {
        ...job,
        status: "failed",
        error: "Agent lost or lease expired",
        completedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await redis.set(playwrightKeys.job(id), updated, { ex: JOB_TTL_SECONDS });
      await redis.del(playwrightKeys.active(job.agentId));
      reaped.push(id);
    }
  }

  return reaped;
}
