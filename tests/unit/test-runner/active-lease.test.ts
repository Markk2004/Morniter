import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reserveJobCreation,
  readActiveLease,
  releaseActiveLease,
  renewActiveLease,
} from "@/lib/test-runner/active-lease";

const fakeStore = new Map<string, unknown>();

vi.mock("@/lib/test-runner/redis", () => ({
  getRunnerRedis: () => ({
    eval: vi.fn(async (script: string, keys: string[], args: string[]) => {
      // RESERVE_SCRIPT
      if (script.includes("ACQUIRED")) {
        const [idemKey, activeKey, queueKey] = keys;
        const [jobId, maxQueue] = args;

        const existing = fakeStore.get(idemKey);
        if (existing) return ["IDEMPOTENT", existing];

        const active = fakeStore.get(activeKey);
        if (active) return ["ACTIVE", active];

        const queue = (fakeStore.get(queueKey) as string[]) || [];
        if (queue.length >= Number(maxQueue)) return ["QUEUE_FULL", ""];

        fakeStore.set(idemKey, jobId);
        fakeStore.set(activeKey, jobId);
        return ["ACQUIRED", jobId];
      }

      // RENEW_SCRIPT
      if (script.includes("EXPIRE")) {
        const [activeKey] = keys;
        const [jobId] = args;
        const current = fakeStore.get(activeKey);
        if (current === jobId) return 1;
        return 0;
      }

      // RELEASE_SCRIPT
      if (script.includes("DEL")) {
        const [activeKey] = keys;
        const [jobId] = args;
        const current = fakeStore.get(activeKey);
        if (current === jobId) {
          fakeStore.delete(activeKey);
          return 1;
        }
        return 0;
      }

      return 0;
    }),
    get: vi.fn(async (key: string) => fakeStore.get(key) ?? null),
  }),
}));

describe("active lease primitives", () => {
  beforeEach(() => {
    fakeStore.clear();
    vi.clearAllMocks();
  });

  it("reserves idempotency and active lease atomically", async () => {
    await expect(reserveJobCreation("agent-1", "idem-1", "job-1")).resolves.toEqual({
      kind: "acquired",
      jobId: "job-1",
    });
    await expect(reserveJobCreation("agent-1", "idem-2", "job-2")).resolves.toEqual({
      kind: "active",
      jobId: "job-1",
    });
    await expect(readActiveLease("agent-1")).resolves.toBe("job-1");
  });

  it("returns the reserved job for concurrent idempotency replay", async () => {
    await reserveJobCreation("agent-1", "idem-1", "job-1");
    await expect(reserveJobCreation("agent-1", "idem-1", "job-2")).resolves.toEqual({
      kind: "idempotent",
      jobId: "job-1",
    });
  });

  it("renews and releases only the owning job", async () => {
    await reserveJobCreation("agent-1", "idem-1", "job-1");
    await expect(renewActiveLease("agent-1", "job-2")).resolves.toBe(false);
    await expect(releaseActiveLease("agent-1", "job-2")).resolves.toBe(false);
    await expect(renewActiveLease("agent-1", "job-1")).resolves.toBe(true);
    await expect(releaseActiveLease("agent-1", "job-1")).resolves.toBe(true);
  });
});
