import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => (name === "userData" ? "/mock/user/data" : "/mock"),
  },
}));

import { readRecentPaths, addRecentPath, removeRecentPath } from "../src/main/recent-paths-store";

describe("recent-paths-store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "morniter-recent-paths-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("returns empty array when recent-paths.json does not exist", async () => {
    const paths = await readRecentPaths(tempDir);
    expect(paths).toEqual([]);
  });

  it("adds and deduplicates paths, keeping most recent at top", async () => {
    const p1 = "C:\\Projects\\ProjectSTS";
    const p2 = "C:\\Projects\\ProjectSTS\\frontend";

    await addRecentPath({ workspaceRoot: p1, testRoot: "e2e" }, tempDir);
    await addRecentPath({ workspaceRoot: p2, testRoot: "tests" }, tempDir);

    let paths = await readRecentPaths(tempDir);
    expect(paths).toHaveLength(2);
    expect(paths[0].workspaceRoot).toBe(p2);
    expect(paths[0].testRoot).toBe("tests");
    expect(paths[1].workspaceRoot).toBe(p1);

    // Re-adding p1 moves it to the top with new testRoot
    await addRecentPath({ workspaceRoot: p1, testRoot: "frontend/e2e" }, tempDir);
    paths = await readRecentPaths(tempDir);
    expect(paths).toHaveLength(2);
    expect(paths[0].workspaceRoot).toBe(p1);
    expect(paths[0].testRoot).toBe("frontend/e2e");
  });

  it("limits recent paths to 5 entries", async () => {
    for (let i = 1; i <= 7; i++) {
      await addRecentPath({ workspaceRoot: `C:\\Projects\\App${i}`, testRoot: "e2e" }, tempDir);
    }

    const paths = await readRecentPaths(tempDir);
    expect(paths).toHaveLength(5);
    expect(paths[0].workspaceRoot).toBe("C:\\Projects\\App7");
    expect(paths[4].workspaceRoot).toBe("C:\\Projects\\App3");
  });

  it("removes a path from recent paths", async () => {
    const p1 = "C:\\Projects\\ProjectSTS";
    const p2 = "C:\\Projects\\ProjectSTS\\frontend";

    await addRecentPath({ workspaceRoot: p1, testRoot: "e2e" }, tempDir);
    await addRecentPath({ workspaceRoot: p2, testRoot: "tests" }, tempDir);

    const remaining = await removeRecentPath(p1, tempDir);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].workspaceRoot).toBe(p2);

    const reRead = await readRecentPaths(tempDir);
    expect(reRead).toEqual(remaining);
  });
});
