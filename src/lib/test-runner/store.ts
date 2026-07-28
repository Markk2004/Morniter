import "server-only";
import { getRunnerRedis } from "./redis";
import type {
  TestProjectCatalog,
  TestJob,
  TestJobStatus,
  TestLogStream,
  TestLogLine,
} from "./types";
import { redactText } from "@/lib/monitor/redact";

const KEY_PREFIX = "morniter:test-runner:v1";
const CATALOG_KEY = `${KEY_PREFIX}:catalog`;
const QUEUE_KEY = `${KEY_PREFIX}:queue`;
const HISTORY_KEY = `${KEY_PREFIX}:job-history`;

const CATALOG_TTL_SECONDS = 75;
const JOB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_QUEUE_SIZE = 10;
const MAX_LOG_LINES = 5000;
const MAX_LOG_BYTES = 1024 * 1024; // 1 MiB

export class QueueFullError extends Error {
  constructor(message = "Job queue is full (maximum 10 queued jobs allowed)") {
    super(message);
    this.name = "QueueFullError";
  }
}

export class UnknownPresetError extends Error {
  constructor(message = "Unknown project or preset ID") {
    super(message);
    this.name = "UnknownPresetError";
  }
}

export class JobNotFoundError extends Error {
  constructor(message = "Job not found") {
    super(message);
    this.name = "JobNotFoundError";
  }
}

export async function publishCatalog(catalog: TestProjectCatalog): Promise<void> {
  const redis = getRunnerRedis();
  await redis.set(CATALOG_KEY, catalog, { ex: CATALOG_TTL_SECONDS });
}

export async function getCatalog(): Promise<TestProjectCatalog | null> {
  const redis = getRunnerRedis();
  const data = await redis.get<TestProjectCatalog>(CATALOG_KEY);
  return data ?? null;
}

export async function enqueueJob(
  input: { projectId: string; presetId: string },
  requesterHash: string,
  providedCatalog?: TestProjectCatalog | null,
): Promise<TestJob> {
  const redis = getRunnerRedis();

  const queueLength = await redis.llen(QUEUE_KEY);
  if (queueLength >= MAX_QUEUE_SIZE) {
    throw new QueueFullError();
  }

  const catalog = providedCatalog ?? (await getCatalog());
  if (!catalog) {
    throw new UnknownPresetError("Catalog unavailable or agent offline");
  }

  const project = catalog.projects.find((p) => p.id === input.projectId);
  const preset = project?.presets.find((p) => p.id === input.presetId);

  if (!project || !preset) {
    throw new UnknownPresetError(`Preset ${input.presetId} not found in project ${input.projectId}`);
  }

  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const nowStr = new Date().toISOString();

  const job: TestJob = {
    id: jobId,
    projectId: input.projectId,
    presetId: input.presetId,
    presetName: preset.name,
    status: "queued",
    queuedAt: nowStr,
  };

  const jobKey = `${KEY_PREFIX}:job:${jobId}`;
  await redis.set(jobKey, job, { ex: JOB_TTL_SECONDS });
  await redis.rpush(QUEUE_KEY, jobId);
  await redis.zadd(HISTORY_KEY, { score: Date.parse(nowStr), member: jobId });

  return job;
}

export async function claimNextJob(agentId: string): Promise<TestJob | null> {
  const redis = getRunnerRedis();

  while (true) {
    const jobId = await redis.lpop<string>(QUEUE_KEY);
    if (!jobId) {
      return null;
    }

    const jobKey = `${KEY_PREFIX}:job:${jobId}`;
    const job = await redis.get<TestJob>(jobKey);

    if (!job) {
      continue;
    }

    if (job.cancelRequested || job.status !== "queued") {
      continue;
    }

    const updated: TestJob = {
      ...job,
      status: "running",
      startedAt: new Date().toISOString(),
      agentId,
    };

    await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
    return updated;
  }
}

export async function appendLogChunk(
  jobId: string,
  input: { sequence: number; stream: TestLogStream; lines: string[] },
): Promise<void> {
  const redis = getRunnerRedis();
  const jobKey = `${KEY_PREFIX}:job:${jobId}`;
  const logsKey = `${KEY_PREFIX}:job-logs:${jobId}`;

  const job = await redis.get<TestJob>(jobKey);
  if (!job) {
    throw new JobNotFoundError();
  }

  if (job.truncated) {
    return;
  }

  const now = new Date().toISOString();
  const redactedLines: TestLogLine[] = input.lines.map((line, idx) => ({
    sequence: input.sequence + idx,
    stream: input.stream,
    message: redactText(line),
    timestamp: now,
  }));

  for (const item of redactedLines) {
    await redis.rpush(logsKey, JSON.stringify(item));
  }
  await redis.expire(logsKey, JOB_TTL_SECONDS);

  // Check truncation limits
  const totalLines = await redis.llen(logsKey);
  if (totalLines > MAX_LOG_LINES) {
    await redis.set(jobKey, { ...job, truncated: true }, { ex: JOB_TTL_SECONDS });
  }
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
  const jobKey = `${KEY_PREFIX}:job:${jobId}`;
  const job = await redis.get<TestJob>(jobKey);

  if (!job) {
    throw new JobNotFoundError();
  }

  const updated: TestJob = {
    ...job,
    status: result.status,
    exitCode: result.exitCode ?? null,
    startedAt: result.startedAt ?? job.startedAt,
    finishedAt: result.finishedAt ?? new Date().toISOString(),
    error: result.error,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
  return updated;
}

export async function requestCancel(jobId: string): Promise<TestJob> {
  const redis = getRunnerRedis();
  const jobKey = `${KEY_PREFIX}:job:${jobId}`;
  const job = await redis.get<TestJob>(jobKey);

  if (!job) {
    throw new JobNotFoundError();
  }

  const isQueued = job.status === "queued";
  const updated: TestJob = {
    ...job,
    cancelRequested: true,
    status: isQueued ? "cancelled" : job.status,
    finishedAt: isQueued ? new Date().toISOString() : job.finishedAt,
  };

  await redis.set(jobKey, updated, { ex: JOB_TTL_SECONDS });
  return updated;
}

export async function listJobs(limit = 20): Promise<TestJob[]> {
  const redis = getRunnerRedis();
  const jobIds = await redis.zrange<string[]>(HISTORY_KEY, 0, limit - 1, { rev: true });
  if (!jobIds || jobIds.length === 0) {
    return [];
  }

  const jobs: TestJob[] = [];
  for (const id of jobIds) {
    const jobKey = `${KEY_PREFIX}:job:${id}`;
    const job = await redis.get<TestJob>(jobKey);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

export async function getJobWithLogs(
  jobId: string,
  afterSequence = -1,
): Promise<{ job: TestJob; lines: TestLogLine[] } | null> {
  const redis = getRunnerRedis();
  const jobKey = `${KEY_PREFIX}:job:${jobId}`;
  const logsKey = `${KEY_PREFIX}:job-logs:${jobId}`;

  const job = await redis.get<TestJob>(jobKey);
  if (!job) {
    return null;
  }

  const rawLogs = await redis.lrange<string[]>(logsKey, 0, -1);
  const allLines: TestLogLine[] = (rawLogs || []).map((raw) =>
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );

  const lines = allLines.filter((line) => line.sequence > afterSequence);

  return { job, lines };
}
