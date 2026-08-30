import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveInsideRoot } from "./playwright-catalog.js";

export type TransactionPhase = "prepared" | "spec-replaced" | "map-replaced" | "committed";

export interface MutationTransactionJournal {
  mutationId: string;
  phase: TransactionPhase;
  specRelativePath: string;
  tempSpecRelativePath: string;
  specBackupRelativePath?: string;
  mapRelativePath: string;
  tempMapRelativePath: string;
  mapBackupRelativePath: string;
  newSpecHash: string;
  newMapHash: string;
  oldSpecHash?: string;
  oldMapHash: string;
  updatedAt: string;
}

export const JOURNAL_FILENAME = ".morniter-mutation-journal.json";

export async function writeFileSyncWithFsync(filePath: string, content: string): Promise<void> {
  const handle = await fs.open(filePath, "w");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeJournal(
  workspaceRoot: string,
  journal: MutationTransactionJournal,
): Promise<void> {
  const journalPath = path.join(workspaceRoot, JOURNAL_FILENAME);
  const tempJournalPath = path.join(workspaceRoot, `${JOURNAL_FILENAME}.tmp`);
  const content = JSON.stringify(journal, null, 2);
  await writeFileSyncWithFsync(tempJournalPath, content);
  await fs.rename(tempJournalPath, journalPath);
}

export async function readJournal(
  workspaceRoot: string,
): Promise<MutationTransactionJournal | null> {
  const journalPath = path.join(workspaceRoot, JOURNAL_FILENAME);
  let raw: string;
  try {
    raw = await fs.readFile(journalPath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new Error(
      `Failed to read mutation transaction journal at '${journalPath}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    return JSON.parse(raw) as MutationTransactionJournal;
  } catch (err) {
    throw new Error(
      `Corrupted transaction journal detected at '${journalPath}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function deleteJournal(workspaceRoot: string): Promise<void> {
  const journalPath = path.join(workspaceRoot, JOURNAL_FILENAME);
  await fs.unlink(journalPath).catch(() => {});
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function readFileHashIfExists(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return computeSha256(content);
  } catch {
    return null;
  }
}

export async function recoverRecipeTransactions(workspaceRoot: string): Promise<void> {
  const journal = await readJournal(workspaceRoot);
  if (!journal) {
    return;
  }

  const specPath = resolveInsideRoot(workspaceRoot, journal.specRelativePath);
  const tempSpecPath = resolveInsideRoot(workspaceRoot, journal.tempSpecRelativePath);
  const specBackupPath = journal.specBackupRelativePath
    ? resolveInsideRoot(workspaceRoot, journal.specBackupRelativePath)
    : undefined;

  const mapPath = resolveInsideRoot(workspaceRoot, journal.mapRelativePath);
  const tempMapPath = resolveInsideRoot(workspaceRoot, journal.tempMapRelativePath);
  const mapBackupPath = resolveInsideRoot(workspaceRoot, journal.mapBackupRelativePath);

  try {
    let canCommit = false;
    if (journal.phase === "committed" || journal.phase === "map-replaced") {
      // Verify both files actually match the committed new hashes before deleting backups!
      const currentSpecHash = await readFileHashIfExists(specPath);
      const currentMapHash = await readFileHashIfExists(mapPath);
      if (currentSpecHash === journal.newSpecHash && currentMapHash === journal.newMapHash) {
        canCommit = true;
      }
    }

    if (canCommit) {
      // Hashes verified: safe to clean up backups and temp files
      if (specBackupPath) await fs.unlink(specBackupPath).catch(() => {});
      await fs.unlink(mapBackupPath).catch(() => {});
      await fs.unlink(tempSpecPath).catch(() => {});
      await fs.unlink(tempMapPath).catch(() => {});
    } else {
      // Phase was prepared/spec-replaced OR hash mismatch on map-replaced: perform complete rollback
      if (specBackupPath && (await fileExists(specBackupPath))) {
        await fs.rename(specBackupPath, specPath).catch(() => {});
      } else if (!journal.oldSpecHash) {
        // Spec didn't exist originally
        await fs.unlink(specPath).catch(() => {});
      }

      if (await fileExists(mapBackupPath)) {
        await fs.rename(mapBackupPath, mapPath).catch(() => {});
      }

      await fs.unlink(tempSpecPath).catch(() => {});
      await fs.unlink(tempMapPath).catch(() => {});
      if (specBackupPath) await fs.unlink(specBackupPath).catch(() => {});
      await fs.unlink(mapBackupPath).catch(() => {});
    }
  } finally {
    await deleteJournal(workspaceRoot);
  }
}
