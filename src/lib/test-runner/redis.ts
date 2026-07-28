import "server-only";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env/server";

export class TestRunnerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestRunnerConfigError";
  }
}

let redisClient: Redis | null = null;

export function getRunnerRedis(): Redis {
  const env = getServerEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new TestRunnerConfigError("Upstash Redis URL or token not configured");
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisClient;
}

export function resetRunnerRedis(): void {
  redisClient = null;
}
