import { getRunnerRedis } from "./redis";

const RATE_LIMIT_PREFIX = "monitor:test-runner:v1:rate-limit:";
const WINDOW_SECONDS = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

// In-memory fallback if Redis is unconfigured or during tests
const memoryFallback = new Map<string, { attempts: number; expiresAt: number }>();

export async function consumeExecuteLoginAttempt(
  identifierHash: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = `${RATE_LIMIT_PREFIX}${identifierHash}`;

  try {
    const redis = getRunnerRedis();
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    const ttl = await redis.ttl(key);
    const retryAfterSeconds = ttl > 0 ? ttl : WINDOW_SECONDS;

    if (attempts > MAX_ATTEMPTS) {
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    // Fall back to memory map when Redis is unconfigured or unavailable
    const now = Date.now();
    const entry = memoryFallback.get(identifierHash);
    if (!entry || now > entry.expiresAt) {
      memoryFallback.set(identifierHash, {
        attempts: 1,
        expiresAt: now + WINDOW_SECONDS * 1000,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    entry.attempts += 1;
    const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000);
    if (entry.attempts > MAX_ATTEMPTS) {
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
