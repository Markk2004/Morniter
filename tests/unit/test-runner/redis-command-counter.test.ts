import { beforeEach, describe, expect, it } from "vitest";
import {
  getRedisCommandSnapshot,
  recordRedisCommand,
  resetRedisCommandCounters,
} from "@/lib/test-runner/redis-command-counter";

describe("Redis command counter", () => {
  beforeEach(() => {
    resetRedisCommandCounters();
  });

  it("counts commands by normalized command name", () => {
    recordRedisCommand("get");
    recordRedisCommand(" GET ");
    recordRedisCommand("zadd");

    expect(getRedisCommandSnapshot().total).toBe(3);
    expect(getRedisCommandSnapshot().byCommand).toEqual({ GET: 2, ZADD: 1 });
  });

  it("uses UNKNOWN for empty command names", () => {
    recordRedisCommand(" ");

    expect(getRedisCommandSnapshot().byCommand).toEqual({ UNKNOWN: 1 });
  });

  it("resets counts and starts a new window", () => {
    recordRedisCommand("set");
    resetRedisCommandCounters();

    const snapshot = getRedisCommandSnapshot();
    expect(snapshot.total).toBe(0);
    expect(snapshot.byCommand).toEqual({});
    expect(snapshot.windowDurationSeconds).toBe(0);
    expect(Number.isNaN(Date.parse(snapshot.windowStartedAt))).toBe(false);
  });
});
