import { getServerEnv } from "@/lib/env/server";
import { getRedisCommandSnapshot, type RedisCommandSnapshot } from "./redis-command-counter";

export type RedisHealthStatus = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";

export interface RedisInfoMetrics {
  totalCommandsProcessed: number | null;
  usedMemoryBytes: number | null;
  totalKeys: number | null;
  uptimeSeconds: number | null;
}

export interface RedisStatusResponse {
  status: RedisHealthStatus;
  checkedAt: string;
  latencyMs: number | null;
  metrics: RedisInfoMetrics;
  appCommands: RedisCommandSnapshot;
  error: string | null;
}

const EMPTY_METRICS: RedisInfoMetrics = {
  totalCommandsProcessed: null,
  usedMemoryBytes: null,
  totalKeys: null,
  uptimeSeconds: null,
};

export function parseRedisInfo(info: string): RedisInfoMetrics {
  const fields = new Map<string, string>();

  for (const line of info.split(/\r?\n/)) {
    const match = line.match(/^([^:#]+):(.+)$/);
    if (match) fields.set(match[1], match[2]);
  }

  const parseNumber = (key: string): number | null => {
    const value = fields.get(key);
    if (!value || !/^\d+$/.test(value)) return null;
    return Number(value);
  };

  return {
    totalCommandsProcessed: parseNumber("total_commands_processed"),
    usedMemoryBytes: parseNumber("used_memory"),
    totalKeys: parseNumber("total_keys"),
    uptimeSeconds: parseNumber("uptime_in_seconds"),
  };
}

function createUnavailableResponse(error: string): RedisStatusResponse {
  return {
    status: "UNAVAILABLE",
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    metrics: EMPTY_METRICS,
    appCommands: getRedisCommandSnapshot(),
    error,
  };
}

export async function readRedisStatus(): Promise<RedisStatusResponse> {
  const appCommands = getRedisCommandSnapshot();
  let env: ReturnType<typeof getServerEnv>;

  try {
    env = getServerEnv();
  } catch {
    return createUnavailableResponse("Redis status is unavailable");
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return createUnavailableResponse("Redis status is unavailable");
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["INFO"]),
      cache: "no-store",
    });

    if (!response.ok) return createUnavailableResponse("Redis status is unavailable");

    const body = (await response.json()) as { result?: unknown };
    if (typeof body.result !== "string") return createUnavailableResponse("Redis status is unavailable");

    const metrics = parseRedisInfo(body.result);
    const latencyMs = Math.round(performance.now() - startedAt);
    const hasRequiredMetrics = metrics.totalCommandsProcessed !== null;

    return {
      status: hasRequiredMetrics && latencyMs <= 500 ? "HEALTHY" : "DEGRADED",
      checkedAt: new Date().toISOString(),
      latencyMs,
      metrics,
      appCommands,
      error: hasRequiredMetrics ? null : "Some Redis metrics are unavailable",
    };
  } catch {
    return createUnavailableResponse("Redis status is unavailable");
  }
}
