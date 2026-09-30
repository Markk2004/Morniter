import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { RecentPathEntry } from "../shared/preload-api";

const RECENT_PATHS_FILE = "recent-paths.json";
const MAX_RECENT_PATHS = 5;

function dataDirectory(): string {
  return app.getPath("userData");
}

export async function readRecentPaths(directory = dataDirectory()): Promise<RecentPathEntry[]> {
  try {
    const raw = await fs.readFile(path.join(directory, RECENT_PATHS_FILE), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentPathEntry =>
        Boolean(
          item &&
          typeof item.workspaceRoot === "string" &&
          item.workspaceRoot.trim()
        )
      )
      .slice(0, MAX_RECENT_PATHS);
  } catch {
    return [];
  }
}

export async function addRecentPath(
  entry: { workspaceRoot: string; testRoot?: string },
  directory = dataDirectory()
): Promise<RecentPathEntry[]> {
  const normWorkspace = entry.workspaceRoot.trim();
  if (!normWorkspace) return readRecentPaths(directory);

  const existing = await readRecentPaths(directory);
  const now = new Date().toISOString();

  // Deduplicate and move to top
  const filtered = existing.filter(
    (item) => path.resolve(item.workspaceRoot).toLowerCase() !== path.resolve(normWorkspace).toLowerCase()
  );

  const updated: RecentPathEntry[] = [
    {
      workspaceRoot: normWorkspace,
      testRoot: (entry.testRoot && entry.testRoot.trim()) || "e2e",
      lastUsedAt: now,
    },
    ...filtered,
  ].slice(0, MAX_RECENT_PATHS);

  await writeRecentPathsAtomic(updated, directory);
  return updated;
}

export async function removeRecentPath(
  workspaceRoot: string,
  directory = dataDirectory()
): Promise<RecentPathEntry[]> {
  const existing = await readRecentPaths(directory);
  const updated = existing.filter(
    (item) => path.resolve(item.workspaceRoot).toLowerCase() !== path.resolve(workspaceRoot).toLowerCase()
  );
  await writeRecentPathsAtomic(updated, directory);
  return updated;
}

async function writeRecentPathsAtomic(
  paths: RecentPathEntry[],
  directory = dataDirectory()
): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, RECENT_PATHS_FILE);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(paths, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(temporary, target);
}
