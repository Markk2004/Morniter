import { describe, expect, it } from "vitest";
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
  });

  it("truncates at 512 KiB pending memory limit", async () => {
    const batcher = new LogBatcher(async () => {});
    const hugeLine = "x".repeat(1024); // 1 KiB per line

    // Push 600 lines (600 KiB)
    batcher.push("stdout", Array.from({ length: 600 }, () => hugeLine));

    expect(batcher.isTruncated()).toBe(true);
  });
});
