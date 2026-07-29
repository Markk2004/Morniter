import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRedisCommandSnapshot, recordRedisCommand, resetRedisCommandCounters } from "@/lib/test-runner/redis-command-counter";
import { parseRedisInfo, readRedisStatus } from "@/lib/test-runner/redis-status";

vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  }),
}));

describe("Redis status", () => {
  beforeEach(() => {
    resetRedisCommandCounters();
    vi.unstubAllGlobals();
  });

  it("parses the approved INFO fields", () => {
    expect(
      parseRedisInfo(
        "# Stats\ntotal_commands_processed:42\nused_memory:2048\ntotal_keys:12\nuptime_in_seconds:120\n",
      ),
    ).toEqual({
      totalCommandsProcessed: 42,
      usedMemoryBytes: 2048,
      totalKeys: 12,
      uptimeSeconds: 120,
    });
  });

  it("returns healthy status with app command snapshot", async () => {
    recordRedisCommand("get");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: "total_commands_processed:42\nused_memory:2048\ntotal_keys:12\n",
        }),
      }),
    );

    const response = await readRedisStatus();

    expect(response.status).toBe("HEALTHY");
    expect(response.metrics.totalCommandsProcessed).toBe(42);
    expect(response.appCommands).toEqual(getRedisCommandSnapshot());
    expect(response.error).toBeNull();
  });

  it("downgrades status when metrics are incomplete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "used_memory:2048\n" }),
      }),
    );

    const response = await readRedisStatus();

    expect(response.status).toBe("DEGRADED");
    expect(response.error).toMatch(/metrics/i);
  });

  it("returns unavailable when Redis cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const response = await readRedisStatus();

    expect(response.status).toBe("UNAVAILABLE");
    expect(response.metrics.totalCommandsProcessed).toBeNull();
    expect(response.error).toMatch(/unavailable/i);
  });
});
