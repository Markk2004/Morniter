import { describe, expect, it, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { SingleInstanceGuard, isProcessAlive } from "../../../agent/src/single-instance";

describe("SingleInstanceGuard", () => {
  const tempDir = path.join(os.tmpdir(), `test-agent-guard-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("checks process liveness correctly for current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(999999)).toBe(false);
  });

  it("acquires lock, writes file, and releases cleanly", () => {
    const guard = new SingleInstanceGuard("agent-win-test-1", tempDir);
    expect(fs.existsSync(guard.getLockPath())).toBe(false);

    guard.acquire();
    expect(fs.existsSync(guard.getLockPath())).toBe(true);

    const data = JSON.parse(fs.readFileSync(guard.getLockPath(), "utf-8"));
    expect(data.pid).toBe(process.pid);
    expect(data.agentId).toBe("agent-win-test-1");

    guard.release();
    expect(fs.existsSync(guard.getLockPath())).toBe(false);
  });

  it("blocks second guard when active process holds the lock", () => {
    const guard1 = new SingleInstanceGuard("agent-win-test-2", tempDir);
    guard1.acquire();

    // Create a mock lock with current running PID (process.pid) to simulate another instance
    const guard2 = new SingleInstanceGuard("agent-win-test-2", tempDir);

    // Write a dummy foreign alive PID (process.pid) into guard's path
    const lockPath = guard2.getLockPath();
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, agentId: "agent-win-test-2", acquiredAt: new Date().toISOString() }),
    );

    // Acquire should succeed if it belongs to own PID, but if PID is different and alive:
    // Let's test with a real alive PID (e.g. process.ppid if alive)
    const alivePid = process.ppid || process.pid;
    if (alivePid !== process.pid) {
      fs.writeFileSync(
        lockPath,
        JSON.stringify({ pid: alivePid, agentId: "agent-win-test-2", acquiredAt: new Date().toISOString() }),
      );
      expect(() => guard2.acquire()).toThrow(/Another Agent instance with ID "agent-win-test-2" is already running/);
    }

    guard1.release();
  });

  it("cleans up and acquires stale lock from dead PID", () => {
    const deadPid = 9999999; // Dead PID
    const guard = new SingleInstanceGuard("agent-win-test-3", tempDir);

    fs.writeFileSync(
      guard.getLockPath(),
      JSON.stringify({ pid: deadPid, agentId: "agent-win-test-3", acquiredAt: new Date().toISOString() }),
    );

    expect(fs.existsSync(guard.getLockPath())).toBe(true);

    guard.acquire();
    expect(fs.existsSync(guard.getLockPath())).toBe(true);

    const data = JSON.parse(fs.readFileSync(guard.getLockPath(), "utf-8"));
    expect(data.pid).toBe(process.pid);

    guard.release();
    expect(fs.existsSync(guard.getLockPath())).toBe(false);
  });
});
