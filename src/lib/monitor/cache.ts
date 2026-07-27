interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 10_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string, now: number = Date.now()): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number, now: number = Date.now()): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
