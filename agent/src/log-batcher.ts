import type { TestProgress } from "./types.js";

export interface LogBatchEntry {
  stream: "stdout" | "stderr" | "system";
  message: string;
  browser?: string;
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

export interface LogBatcherOptions {
  maxRetries?: number;
  retryDelays?: number[];
  flushIntervalMs?: number;
}

export class LogBatcher {
  private queue: LogBatchEntry[] = [];
  private currentSequence = 0;
  private currentPendingBytes = 0;
  private truncated = false;
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private flushPromise: Promise<void> | null = null;
  private latestProgress?: TestProgress;
  private maxRetries: number;
  private retryDelays: number[];
  private flushIntervalMs: number;

  constructor(
    private uploadHandler: UploadHandler,
    options?: LogBatcherOptions,
  ) {
    this.maxRetries = options?.maxRetries ?? 5;
    this.retryDelays = options?.retryDelays ?? [250, 500, 1000, 2000, 4000];
    this.flushIntervalMs = options?.flushIntervalMs ?? FLUSH_INTERVAL_MS;
  }

  push(
    stream: "stdout" | "stderr" | "system",
    lines: string[],
    progress?: TestProgress,
    browser?: string,
  ): void {
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

      this.queue.push({ stream, message: line, browser });
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

  pendingCount(): number {
    return this.queue.length;
  }

  getSequence(): number {
    return this.currentSequence;
  }

  private scheduleFlush() {
    if (this.timer || this.queue.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => {
        // Background timer errors will be retried on next flush or caught by drain()
      });
    }, this.flushIntervalMs);
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

          for (const item of this.queue) {
            const nextBytes = Buffer.byteLength(item.message, "utf-8");
            if (batchEntries.length > 0 && batchBytes + nextBytes > MAX_BATCH_BYTES) {
              break;
            }
            batchEntries.push(item);
            batchBytes += nextBytes;
            if (batchEntries.length >= MAX_BATCH_LINES) {
              break;
            }
          }

          if (batchEntries.length === 0) break;

          const seqStart = this.currentSequence;
          let succeeded = false;
          let lastErr: unknown = null;

          for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
              await this.uploadHandler(seqStart, batchEntries, this.latestProgress);
              succeeded = true;
              break;
            } catch (err) {
              lastErr = err;
              const errMsg = err instanceof Error ? err.message : String(err);
              if (errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("403")) {
                break;
              }
              const delay = this.retryDelays[attempt] ?? 4000;
              if (attempt < this.maxRetries - 1) {
                await new Promise((r) => setTimeout(r, delay));
              }
            }
          }

          if (!succeeded) {
            throw lastErr || new Error("Log batch upload failed after retries");
          }

          // Acknowledged upload: remove batch from queue and advance sequence
          this.queue.splice(0, batchEntries.length);
          this.currentSequence += batchEntries.length;
          this.currentPendingBytes = Math.max(0, this.currentPendingBytes - batchBytes);
        }
      } finally {
        this.isFlushing = false;
        this.flushPromise = null;
      }
    })();

    return this.flushPromise;
  }

  async drain(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
