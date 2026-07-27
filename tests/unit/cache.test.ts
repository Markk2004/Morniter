import { describe, expect, it } from "vitest";
import { MemoryCache } from "@/lib/monitor/cache";

describe("MemoryCache", () => {
  it("stores and retrieves items before TTL expires", () => {
    const cache = new MemoryCache<string>();
    cache.set("key1", "value1", 1000, 100);
    expect(cache.get("key1", 500)).toBe("value1");
  });

  it("returns undefined after TTL expires", () => {
    const cache = new MemoryCache<string>();
    cache.set("key1", "value1", 1000, 100);
    expect(cache.get("key1", 1200)).toBeUndefined();
  });

  it("clears all stored items on clear()", () => {
    const cache = new MemoryCache<string>();
    cache.set("key1", "value1", 1000, 100);
    cache.clear();
    expect(cache.get("key1", 500)).toBeUndefined();
  });
});
