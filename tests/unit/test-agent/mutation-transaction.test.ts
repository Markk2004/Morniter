import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  writeJournal,
  readJournal,
  deleteJournal,
  recoverRecipeTransactions,
  computeSha256,
  JOURNAL_FILENAME,
  type MutationTransactionJournal,
} from "../../../agent/src/mutation-transaction";

describe("Mutation Transaction Journal and Crash Recovery", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "morniter-tx-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("writes, reads, and deletes transaction journal correctly", async () => {
    const journal: MutationTransactionJournal = {
      mutationId: "mut-123",
      phase: "prepared",
      specRelativePath: "frontend/e2e/generated/test.spec.ts",
      tempSpecRelativePath: "frontend/e2e/generated/.tmp-test.spec.ts",
      mapRelativePath: "test-automation-map.json",
      tempMapRelativePath: ".tmp-map.json",
      mapBackupRelativePath: "test-automation-map.json.bak.123",
      newSpecHash: "hash-spec-new",
      newMapHash: "hash-map-new",
      oldMapHash: "hash-map-old",
      updatedAt: new Date().toISOString(),
    };

    await writeJournal(tempRoot, journal);
    const read = await readJournal(tempRoot);
    expect(read).toEqual(journal);

    await deleteJournal(tempRoot);
    const afterDelete = await readJournal(tempRoot);
    expect(afterDelete).toBeNull();
  });

  it("recovers and cleans up successfully on committed or map-replaced phase", async () => {
    const specRel = "frontend/e2e/generated/test.spec.ts";
    const tempSpecRel = "frontend/e2e/generated/.tmp-test.spec.ts";
    const specBackupRel = "frontend/e2e/generated/test.spec.ts.bak.123";
    const mapRel = "test-automation-map.json";
    const tempMapRel = ".tmp-map.json";
    const mapBackupRel = "test-automation-map.json.bak.123";

    await fs.mkdir(path.join(tempRoot, "frontend/e2e/generated"), { recursive: true });

    // Create current files
    await fs.writeFile(path.join(tempRoot, specRel), "new spec content", "utf8");
    await fs.writeFile(path.join(tempRoot, mapRel), "new map content", "utf8");

    // Create leftover temp and backup files
    await fs.writeFile(path.join(tempRoot, tempSpecRel), "temp spec", "utf8");
    await fs.writeFile(path.join(tempRoot, specBackupRel), "old spec backup", "utf8");
    await fs.writeFile(path.join(tempRoot, tempMapRel), "temp map", "utf8");
    await fs.writeFile(path.join(tempRoot, mapBackupRel), "old map backup", "utf8");

    const journal: MutationTransactionJournal = {
      mutationId: "mut-committed",
      phase: "committed",
      specRelativePath: specRel,
      tempSpecRelativePath: tempSpecRel,
      specBackupRelativePath: specBackupRel,
      mapRelativePath: mapRel,
      tempMapRelativePath: tempMapRel,
      mapBackupRelativePath: mapBackupRel,
      newSpecHash: computeSha256("new spec content"),
      newMapHash: computeSha256("new map content"),
      oldMapHash: "hash3",
      updatedAt: new Date().toISOString(),
    };
    await writeJournal(tempRoot, journal);

    await recoverRecipeTransactions(tempRoot);

    // Leftovers should be cleaned up
    await expect(fs.access(path.join(tempRoot, tempSpecRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, specBackupRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, tempMapRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, mapBackupRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, JOURNAL_FILENAME))).rejects.toThrow();

    // Active files preserved
    expect(await fs.readFile(path.join(tempRoot, specRel), "utf8")).toBe("new spec content");
    expect(await fs.readFile(path.join(tempRoot, mapRel), "utf8")).toBe("new map content");
  });

  it("rolls back partial changes when interrupted at spec-replaced phase", async () => {
    const specRel = "frontend/e2e/generated/test.spec.ts";
    const tempSpecRel = "frontend/e2e/generated/.tmp-test.spec.ts";
    const specBackupRel = "frontend/e2e/generated/test.spec.ts.bak.123";
    const mapRel = "test-automation-map.json";
    const tempMapRel = ".tmp-map.json";
    const mapBackupRel = "test-automation-map.json.bak.123";

    await fs.mkdir(path.join(tempRoot, "frontend/e2e/generated"), { recursive: true });

    // Spec was replaced with new content
    await fs.writeFile(path.join(tempRoot, specRel), "new spec content", "utf8");
    // Spec backup has original content
    await fs.writeFile(path.join(tempRoot, specBackupRel), "original spec content", "utf8");

    // Map was backed up but not replaced yet
    await fs.writeFile(path.join(tempRoot, mapRel), "original map content", "utf8");
    await fs.writeFile(path.join(tempRoot, mapBackupRel), "original map content", "utf8");
    await fs.writeFile(path.join(tempRoot, tempMapRel), "temp new map content", "utf8");

    const journal: MutationTransactionJournal = {
      mutationId: "mut-partial",
      phase: "spec-replaced",
      specRelativePath: specRel,
      tempSpecRelativePath: tempSpecRel,
      specBackupRelativePath: specBackupRel,
      mapRelativePath: mapRel,
      tempMapRelativePath: tempMapRel,
      mapBackupRelativePath: mapBackupRel,
      newSpecHash: "hash1",
      newMapHash: "hash2",
      oldMapHash: "hash3",
      updatedAt: new Date().toISOString(),
    };
    await writeJournal(tempRoot, journal);

    await recoverRecipeTransactions(tempRoot);

    // Spec must be rolled back to original content
    expect(await fs.readFile(path.join(tempRoot, specRel), "utf8")).toBe("original spec content");
    // Map must remain original content
    expect(await fs.readFile(path.join(tempRoot, mapRel), "utf8")).toBe("original map content");

    // Backups and temp files deleted
    await expect(fs.access(path.join(tempRoot, specBackupRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, tempMapRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, mapBackupRel))).rejects.toThrow();
    await expect(fs.access(path.join(tempRoot, JOURNAL_FILENAME))).rejects.toThrow();
  });

  it("throws error when journal is corrupted JSON", async () => {
    const journalPath = path.join(tempRoot, JOURNAL_FILENAME);
    await fs.writeFile(journalPath, "{ invalid json corrupt ", "utf8");

    await expect(readJournal(tempRoot)).rejects.toThrow(/Corrupted transaction journal detected/i);
    await expect(recoverRecipeTransactions(tempRoot)).rejects.toThrow(/Corrupted transaction journal detected/i);
  });

  it("rolls back even in map-replaced phase if content hashes do not match expected new hashes", async () => {
    const specRel = "frontend/e2e/generated/test.spec.ts";
    const tempSpecRel = "frontend/e2e/generated/.tmp-test.spec.ts";
    const specBackupRel = "frontend/e2e/generated/test.spec.ts.bak.123";
    const mapRel = "test-automation-map.json";
    const tempMapRel = ".tmp-map.json";
    const mapBackupRel = "test-automation-map.json.bak.123";

    await fs.mkdir(path.join(tempRoot, "frontend/e2e/generated"), { recursive: true });

    // File was written with corrupted/incomplete content (not matching newSpecHash)
    await fs.writeFile(path.join(tempRoot, specRel), "partially written corrupted spec", "utf8");
    await fs.writeFile(path.join(tempRoot, specBackupRel), "original valid spec content", "utf8");

    await fs.writeFile(path.join(tempRoot, mapRel), "map content", "utf8");
    await fs.writeFile(path.join(tempRoot, mapBackupRel), "original valid map content", "utf8");

    const journal: MutationTransactionJournal = {
      mutationId: "mut-corrupted-phase",
      phase: "map-replaced",
      specRelativePath: specRel,
      tempSpecRelativePath: tempSpecRel,
      specBackupRelativePath: specBackupRel,
      mapRelativePath: mapRel,
      tempMapRelativePath: tempMapRel,
      mapBackupRelativePath: mapBackupRel,
      newSpecHash: "expected-full-new-spec-hash", // doesn't match
      newMapHash: "expected-full-new-map-hash",
      oldSpecHash: "original-hash",
      oldMapHash: "original-map-hash",
      updatedAt: new Date().toISOString(),
    };
    await writeJournal(tempRoot, journal);

    await recoverRecipeTransactions(tempRoot);

    // Because hashes did not match, it must rollback to backup rather than deleting backups!
    expect(await fs.readFile(path.join(tempRoot, specRel), "utf8")).toBe("original valid spec content");
    expect(await fs.readFile(path.join(tempRoot, mapRel), "utf8")).toBe("original valid map content");
  });
});
