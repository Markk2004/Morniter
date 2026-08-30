import { describe, expect, it, vi } from "vitest";
import { LogBatcher } from "../../../agent/src/log-batcher";

describe("LogBatcher", () => {
  it("flushes at 100 lines and serializes uploads", async () => {
    const uploads: string[][] = [];
    const batcher = new LogBatcher(async (seqStart, entries) => {
      uploads.push(entries.map((e) => e.message));
    });

    batcher.push("stdout", Array.from({ length: 200 }, (_, idx) => `line-${idx}`));
    await batcher.drain();

    expect(uploads).toHaveLength(2);
    expect(uploads[0]).toHaveLength(100);
    expect(uploads[1]).toHaveLength(100);
    expect(batcher.getSequence()).toBe(200);
    expect(batcher.pendingCount()).toBe(0);
  });

  it("truncates at 512 KiB pending memory limit", async () => {
    const batcher = new LogBatcher(async () => {});
    const hugeLine = "x".repeat(1024); // 1 KiB per line

    // Push 600 lines (600 KiB)
    batcher.push("stdout", Array.from({ length: 600 }, () => hugeLine));

    expect(batcher.isTruncated()).toBe(true);
  });

  it("retains pending batch and sequence across transient failures, then succeeds", async () => {
    let callCount = 0;
    const uploadedSeqs: number[] = [];
    const uploadedMsgs: string[][] = [];

    const mockUpload = vi.fn(async (seqStart: number, entries: Array<{ message: string }>) => {
      callCount++;
      if (callCount < 3) {
        throw new Error("HTTP 500 transient upstream error");
      }
      uploadedSeqs.push(seqStart);
      uploadedMsgs.push(entries.map((e) => e.message));
    });

    const batcher = new LogBatcher(mockUpload, {
      maxRetries: 4,
      retryDelays: [10, 10, 10, 10], // Fast delays for tests
    });

    batcher.push("stdout", ["line-A", "line-B"]);
    await batcher.drain();

    expect(callCount).toBe(3);
    expect(uploadedSeqs).toEqual([0]);
    expect(uploadedMsgs).toEqual([["line-A", "line-B"]]);
    expect(batcher.getSequence()).toBe(2);
    expect(batcher.pendingCount()).toBe(0);
  });

  it("throws and retains pending logs when max retries are exhausted", async () => {
    let callCount = 0;
    const mockUpload = vi.fn(async () => {
      callCount++;
      throw new Error("HTTP 503 Service Unavailable");
    });

    const batcher = new LogBatcher(mockUpload, {
      maxRetries: 3,
      retryDelays: [5, 5, 5],
    });

    batcher.push("stdout", ["important-log-1", "important-log-2"]);

    await expect(batcher.drain()).rejects.toThrow("HTTP 503 Service Unavailable");

    // Queue must retain the unacknowledged logs
    expect(callCount).toBe(3);
    expect(batcher.pendingCount()).toBe(2);
    expect(batcher.getSequence()).toBe(0);
  });
});
