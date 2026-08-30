import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface LockInfo {
  pid: number;
  agentId: string;
  acquiredAt: string;
}

export function isProcessAlive(pid: number): boolean {
  if (pid <= 0 || !Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    return code === "EPERM";
  }
}

export class SingleInstanceGuard {
  private lockFilePath: string;
  private isAcquired = false;
  private cleanupHandler: (() => void) | null = null;

  constructor(
    private agentId: string,
    lockDir = os.tmpdir(),
  ) {
    const sanitizedId = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
    this.lockFilePath = path.join(lockDir, `morniter-agent-${sanitizedId}.lock`);
  }

  getLockPath(): string {
    return this.lockFilePath;
  }

  acquire(): void {
    if (this.isAcquired) return;

    if (fs.existsSync(this.lockFilePath)) {
      try {
        const raw = fs.readFileSync(this.lockFilePath, "utf-8");
        const info = JSON.parse(raw) as LockInfo;

        if (info.pid === process.pid) {
          this.isAcquired = true;
          return;
        }

        if (isProcessAlive(info.pid)) {
          throw new Error(
            `Another Agent instance with ID "${this.agentId}" is already running (PID: ${info.pid}).`,
          );
        }

        // Stale lock from dead process: remove it
        fs.unlinkSync(this.lockFilePath);
      } catch (err) {
        if (err instanceof Error && err.message.includes("is already running")) {
          throw err;
        }
        // Failed to parse or remove corrupt lock; proceed to overwrite
        try {
          fs.unlinkSync(this.lockFilePath);
        } catch {
          // ignore
        }
      }
    }

    const payload: LockInfo = {
      pid: process.pid,
      agentId: this.agentId,
      acquiredAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.lockFilePath, JSON.stringify(payload, null, 2), "utf-8");
    this.isAcquired = true;

    this.cleanupHandler = () => {
      this.release();
    };

    process.once("exit", this.cleanupHandler);
    process.once("SIGINT", this.cleanupHandler);
    process.once("SIGTERM", this.cleanupHandler);
  }

  release(): void {
    if (!this.isAcquired) return;

    if (this.cleanupHandler) {
      process.removeListener("exit", this.cleanupHandler);
      process.removeListener("SIGINT", this.cleanupHandler);
      process.removeListener("SIGTERM", this.cleanupHandler);
      this.cleanupHandler = null;
    }

    try {
      if (fs.existsSync(this.lockFilePath)) {
        const raw = fs.readFileSync(this.lockFilePath, "utf-8");
        const info = JSON.parse(raw) as LockInfo;
        if (info.pid === process.pid) {
          fs.unlinkSync(this.lockFilePath);
        }
      }
    } catch {
      // Ignore file deletion errors on shutdown
    } finally {
      this.isAcquired = false;
    }
  }
}
