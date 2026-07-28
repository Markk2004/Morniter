import type { TestProgress } from "./types";

export interface LogBatchEntry {
  stream: "stdout" | "stderr" | "system";
  message: string;
}

export type UploadHandler = (
  sequenceStart: number,
  entries: LogBatchEntry[],
  progress?: TestProgress,
) => Promise<void>;

const MAX_BATCH_LINES = 100;
const MAX_BATCH_BYTES = 32 * 1024; // 32 KiB
const MAX_PENDING_BYTES = 512 * 1024; // 512 KiB
const FLUSH_INTERVAL_MS = 250;

export class LogBatcher {
  private queue: LogBatchEntry[] = [];
  private currentSequence = 0;
  private currentPendingBytes = 0;
  private truncated = false;
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private flushPromise: Promise<void> | null = null;
  private latestProgress?: TestProgress;

  constructor(private uploadHandler: UploadHandler) {}

  push(stream: "stdout" | "stderr" | "system", lines: string[], progress?: TestProgress): void {
    if (progress) {
      this.latestProgress = progress;
    }

    if (this.truncated) return;

    for (const line of lines) {
      const lineBytes = Buffer.byteLength(line, "utf-8");

      if (this.currentPendingBytes + lineBytes > MAX_PENDING_BYTES) {
        this.truncated = true;
        const truncMsg: LogBatchEntry = {
          stream: "system",
          message: "[SYSTEM] Log output truncated locally (512 KiB pending limit reached)",
        };
        this.queue.push(truncMsg);
        this.currentPendingBytes += Buffer.byteLength(truncMsg.message, "utf-8");
        break;
      }

      this.queue.push({ stream, message: line });
      this.currentPendingBytes += lineBytes;
    }

    this.scheduleFlush();
  }

  isTruncated(): boolean {
    return this.truncated;
  }

  pendingBytes(): number {
    return this.currentPendingBytes;
  }

  private scheduleFlush() {
    if (this.timer || this.queue.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  async flush(): Promise<void> {
    if (this.isFlushing) {
      return this.flushPromise || Promise.resolve();
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    this.flushPromise = (async () => {
      try {
        while (this.queue.length > 0) {
          const batchEntries: LogBatchEntry[] = [];
          let batchBytes = 0;

          while (this.queue.length > 0 && batchEntries.length < MAX_BATCH_LINES) {
            const next = this.queue[0];
            const nextBytes = Buffer.byteLength(next.message, "utf-8");

            if (batchEntries.length > 0 && batchBytes + nextBytes > MAX_BATCH_BYTES) {
              break;
            }

            const item = this.queue.shift()!;
            batchEntries.push(item);
            batchBytes += nextBytes;
            this.currentPendingBytes = Math.max(0, this.currentPendingBytes - nextBytes);
          }

          if (batchEntries.length > 0) {
            const seqStart = this.currentSequence;
            this.currentSequence += batchEntries.length;
            await this.uploadHandler(seqStart, batchEntries, this.latestProgress);
          }
        }
      } finally {
        this.isFlushing = false;
        this.flushPromise = null;
      }
    })();

    return this.flushPromise;
  }

  async drain(): Promise<void> {
    await this.flush();
    while (this.queue.length > 0 || this.isFlushing) {
      await this.flush();
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
