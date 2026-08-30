import "server-only";
import crypto from "node:crypto";
import { getRunnerRedis } from "@/lib/test-runner/redis";
import type { Redis } from "@upstash/redis";
import type { RecipeDraft } from "./recipe-types";

export type MutationStatus =
  | "queued"
  | "claimed"
  | "succeeded"
  | "conflict"
  | "rejected"
  | "failed";

export interface RecipeSaveMutation {
  id: string;
  agentId: string;
  projectId: string;
  baseRevision: string;
  recipe: RecipeDraft;
  verifiedJobId?: string;
  renderedCodeHash?: string;
  leaseToken?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
  status: MutationStatus;
  newRevision?: string;
  writtenFiles?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateMutationRequest {
  projectId: string;
  agentId?: string;
  baseRevision: string;
  recipe: RecipeDraft;
  verifiedJobId?: string;
  renderedCodeHash?: string;
}

export interface CompleteMutationResult {
  accepted: boolean;
  code?: string;
  mutation?: RecipeSaveMutation;
}

const MUTATION_TTL = 3600 * 24; // 24 hours
export const MUTATION_LEASE_SECONDS = 60; // 60 seconds lease per mutation

export const mutationKeys = {
  mutation: (id: string) => `monitor:playwright:v1:mutation:${id}`,
  queue: (agentId: string) => `monitor:playwright:v1:mutation-queue:${agentId}`,
  active: (agentId: string) => `monitor:playwright:v1:mutation-active:${agentId}`,
  claimed: (agentId: string) => `monitor:playwright:v1:mutation-claimed:${agentId}`,
};

export async function enqueueMutation(
  req: CreateMutationRequest,
  agentId = "windows-local-agent-1",
  now = new Date(),
  redisClient?: Redis,
): Promise<RecipeSaveMutation> {
  const redis = redisClient ?? getRunnerRedis();
  const id = `mut-${now.getTime()}-${Math.random().toString(36).substring(2, 8)}`;
  const nowStr = now.toISOString();

  const targetAgent = req.agentId || agentId;

  const mutation: RecipeSaveMutation = {
    id,
    agentId: targetAgent,
    projectId: req.projectId,
    baseRevision: req.baseRevision,
    recipe: req.recipe,
    verifiedJobId: req.verifiedJobId,
    renderedCodeHash: req.renderedCodeHash,
    status: "queued",
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  await redis.set(mutationKeys.mutation(id), mutation, { ex: MUTATION_TTL });
  await redis.rpush(mutationKeys.queue(targetAgent), id);

  return mutation;
}

export async function reapExpiredClaims(
  agentId: string,
  now = new Date(),
  redisClient?: Redis,
): Promise<void> {
  const redis = redisClient ?? getRunnerRedis();
  const claimedKey = mutationKeys.claimed(agentId);
  const activeKey = mutationKeys.active(agentId);

  // Find all claimed mutations whose lease expired at or before now
  let expiredIds: string[] = [];
  try {
    if (typeof (redis as unknown as { zrange: unknown }).zrange === "function") {
      const results = await (redis as unknown as {
        zrange: (key: string, min: number, max: number, opts: { byScore: boolean }) => Promise<string[]>;
      }).zrange(claimedKey, 0, now.getTime(), { byScore: true });
      if (Array.isArray(results)) {
        expiredIds = results;
      }
    }
  } catch {
    // ignore
  }

  // Fallback: check active lease key if zrange was empty or not supported
  if (expiredIds.length === 0) {
    const rawActive = await redis.get<string | { mutationId: string; leaseToken: string }>(activeKey);
    if (rawActive) {
      let activeObj: { mutationId?: string; leaseToken?: string } | null = null;
      if (typeof rawActive === "string") {
        try {
          activeObj = JSON.parse(rawActive);
        } catch {
          activeObj = { mutationId: rawActive };
        }
      } else {
        activeObj = rawActive;
      }

      if (activeObj?.mutationId) {
        const mut = await redis.get<RecipeSaveMutation>(mutationKeys.mutation(activeObj.mutationId));
        if (mut && mut.status === "claimed") {
          const expiresAtMs = mut.leaseExpiresAt
            ? new Date(mut.leaseExpiresAt).getTime()
            : new Date(mut.updatedAt).getTime() + MUTATION_LEASE_SECONDS * 1000;
          if (expiresAtMs <= now.getTime()) {
            expiredIds.push(activeObj.mutationId);
          }
        }
      }
    }
  }

  for (const id of expiredIds) {
    const mutKey = mutationKeys.mutation(id);
    const mut = await redis.get<RecipeSaveMutation>(mutKey);
    if (mut && mut.status === "claimed") {
      const nowStr = now.toISOString();
      const updated: RecipeSaveMutation = {
        ...mut,
        status: "failed",
        error: "Mutation lease expired (LEASE_EXPIRED)",
        updatedAt: nowStr,
        completedAt: nowStr,
      };
      await redis.set(mutKey, updated, { ex: MUTATION_TTL });
    }

    try {
      if (typeof (redis as unknown as { zrem: unknown }).zrem === "function") {
        await (redis as unknown as { zrem: (key: string, member: string) => Promise<number> }).zrem(claimedKey, id);
      }
    } catch {
      // ignore
    }

    const rawActive = await redis.get<string | { mutationId: string; leaseToken: string }>(activeKey);
    if (rawActive) {
      let activeObj: { mutationId?: string; leaseToken?: string } | null = null;
      if (typeof rawActive === "string") {
        try {
          activeObj = JSON.parse(rawActive);
        } catch {
          activeObj = { mutationId: rawActive };
        }
      } else {
        activeObj = rawActive;
      }

      if (activeObj?.mutationId === id) {
        await redis.del(activeKey);
      }
    }
  }
}

export async function claimNextMutation(
  agentId = "windows-local-agent-1",
  now = new Date(),
  redisClient?: Redis,
): Promise<RecipeSaveMutation | null> {
  const redis = redisClient ?? getRunnerRedis();
  const activeKey = mutationKeys.active(agentId);
  const queueKey = mutationKeys.queue(agentId);
  const claimedKey = mutationKeys.claimed(agentId);

  // Reap expired claims first
  await reapExpiredClaims(agentId, now, redis);

  // Check if active lease is still held
  const currentActive = await redis.get(activeKey);
  if (currentActive) {
    return null;
  }

  while (true) {
    const mutationId = await redis.lpop<string>(queueKey);
    if (!mutationId) return null;

    const mutationKey = mutationKeys.mutation(mutationId);
    const mutation = await redis.get<RecipeSaveMutation>(mutationKey);
    if (!mutation || mutation.status !== "queued") {
      continue;
    }

    const leaseToken = crypto.randomUUID();
    const leaseExpiresAtMs = now.getTime() + MUTATION_LEASE_SECONDS * 1000;
    const leaseValue = JSON.stringify({ mutationId, leaseToken });

    // Atomically acquire active lease with NX
    const acquired = await redis.set(activeKey, leaseValue, { nx: true, ex: MUTATION_LEASE_SECONDS });
    if (!acquired) {
      // Lease was acquired concurrently: restore mutation to queue head
      await redis.lpush(queueKey, mutationId);
      return null;
    }

    try {
      if (typeof (redis as unknown as { zadd: unknown }).zadd === "function") {
        await (redis as unknown as {
          zadd: (key: string, member: { score: number; member: string }) => Promise<number>;
        }).zadd(claimedKey, { score: leaseExpiresAtMs, member: mutationId });
      }
    } catch (err) {
      // If writing to durable claimed index fails, roll back active lease and return mutation to queue
      await redis.del(activeKey);
      await redis.lpush(queueKey, mutationId);
      throw new Error(`Failed to record durable mutation claim: ${err instanceof Error ? err.message : String(err)}`);
    }

    const nowStr = now.toISOString();
    const updated: RecipeSaveMutation = {
      ...mutation,
      status: "claimed",
      leaseToken,
      claimedAt: nowStr,
      leaseExpiresAt: new Date(leaseExpiresAtMs).toISOString(),
      updatedAt: nowStr,
    };

    await redis.set(mutationKey, updated, { ex: MUTATION_TTL });
    return updated;
  }
}

export async function getMutation(
  mutationId: string,
  redisClient?: Redis,
): Promise<RecipeSaveMutation | null> {
  const redis = redisClient ?? getRunnerRedis();
  return (await redis.get<RecipeSaveMutation>(mutationKeys.mutation(mutationId))) ?? null;
}

export async function completeMutation(
  mutationId: string,
  leaseToken: string,
  result: {
    status: MutationStatus;
    newRevision?: string;
    writtenFiles?: string[];
    error?: string;
  },
  now = new Date(),
  redisClient?: Redis,
): Promise<CompleteMutationResult> {
  const redis = redisClient ?? getRunnerRedis();
  const mutationKey = mutationKeys.mutation(mutationId);
  const mutation = await redis.get<RecipeSaveMutation>(mutationKey);

  if (!mutation) {
    return { accepted: false, code: "MUTATION_NOT_FOUND" };
  }

  if (mutation.status !== "claimed") {
    return { accepted: false, code: "MUTATION_NOT_CLAIMED" };
  }

  if (mutation.leaseToken && mutation.leaseToken !== leaseToken) {
    return { accepted: false, code: "LEASE_LOST" };
  }

  const activeKey = mutationKeys.active(mutation.agentId);
  const claimedKey = mutationKeys.claimed(mutation.agentId);
  const expectedLeaseValue = JSON.stringify({ mutationId, leaseToken });

  // Atomic compare-and-delete using Lua script if supported
  let luaSuccess = false;
  try {
    if (typeof (redis as unknown as { eval: unknown }).eval === "function") {
      const luaScript = `
        local current = redis.call('GET', KEYS[1])
        if not current then
          return 0
        end
        local expected = ARGV[1]
        local currentObj = cjson.decode(current)
        local expectedObj = cjson.decode(expected)
        if not currentObj or not expectedObj then
          if current ~= expected then
            return 0
          end
        elseif currentObj.mutationId ~= expectedObj.mutationId or currentObj.leaseToken ~= expectedObj.leaseToken then
          return 0
        end
        redis.call('DEL', KEYS[1])
        redis.call('ZREM', KEYS[2], ARGV[2])
        return 1
      `;
      const evalRes = await (redis as unknown as {
        eval: (script: string, keys: string[], args: string[]) => Promise<number>;
      }).eval(luaScript, [activeKey, claimedKey], [expectedLeaseValue, mutationId]);

      if (evalRes === 1) {
        luaSuccess = true;
      } else {
        return { accepted: false, code: "LEASE_LOST" };
      }
    }
  } catch {
    // Fallback if eval is not available (e.g. basic mock object)
  }

  if (!luaSuccess) {
    const rawActive = await redis.get<string | { mutationId: string; leaseToken: string }>(activeKey);
    if (!rawActive) {
      // Active lease has expired / disappeared!
      return { accepted: false, code: "LEASE_LOST" };
    }

    let activeObj: { mutationId?: string; leaseToken?: string } | null = null;
    if (typeof rawActive === "string") {
      try {
        activeObj = JSON.parse(rawActive);
      } catch {
        activeObj = { mutationId: rawActive };
      }
    } else {
      activeObj = rawActive;
    }

    if (activeObj?.mutationId !== mutationId || (activeObj?.leaseToken && activeObj.leaseToken !== leaseToken)) {
      return { accepted: false, code: "LEASE_LOST" };
    }

    await redis.del(activeKey);
    try {
      if (typeof (redis as unknown as { zrem: unknown }).zrem === "function") {
        await (redis as unknown as { zrem: (key: string, member: string) => Promise<number> }).zrem(claimedKey, mutationId);
      }
    } catch {
      // ignore
    }
  }

  const nowStr = now.toISOString();
  const updated: RecipeSaveMutation = {
    ...mutation,
    status: result.status,
    newRevision: result.newRevision,
    writtenFiles: result.writtenFiles,
    error: result.error,
    completedAt: nowStr,
    updatedAt: nowStr,
  };

  await redis.set(mutationKey, updated, { ex: MUTATION_TTL });
  return { accepted: true, mutation: updated };
}
