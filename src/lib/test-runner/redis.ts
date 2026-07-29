import "server-only";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env/server";
import { recordRedisCommand } from "./redis-command-counter";

export class TestRunnerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestRunnerConfigError";
  }
}

let redisClient: Redis | null = null;
let redisProxy: Redis | null = null;

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

  if (!redisProxy) {
    redisProxy = new Proxy(redisClient, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== "function") return value;

        return (...args: unknown[]) => {
          recordRedisCommand(String(property));
          return Reflect.apply(value, target, args);
        };
      },
    });
  }

  return redisProxy;
}

export function resetRunnerRedis(): void {
  redisClient = null;
  redisProxy = null;
}
