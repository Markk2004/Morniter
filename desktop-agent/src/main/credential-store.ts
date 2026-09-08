import fs from "node:fs/promises";
import path from "node:path";
import { app, safeStorage } from "electron";

const CREDENTIAL_FILE = "device-credential.bin";

function credentialPath(directory = app.getPath("userData")): string { return path.join(directory, CREDENTIAL_FILE); }

export async function saveDeviceCredential(token: string, directory = app.getPath("userData")): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("SECURE_STORAGE_UNAVAILABLE");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(credentialPath(directory), safeStorage.encryptString(token), { mode: 0o600 });
}

export async function readDeviceCredential(directory = app.getPath("userData")): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("SECURE_STORAGE_UNAVAILABLE");
  try { return safeStorage.decryptString(await fs.readFile(credentialPath(directory))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw new Error("CREDENTIAL_UNREADABLE"); }
}

export async function clearDeviceCredential(directory = app.getPath("userData")): Promise<void> {
  await fs.rm(credentialPath(directory), { force: true });
}
