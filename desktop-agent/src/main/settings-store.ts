import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { DesktopAgentSettingsSchema, type DesktopAgentSettings } from "../shared/settings";

const SETTINGS_FILE = "settings.json";

function dataDirectory(): string { return app.getPath("userData"); }

export async function readSettings(directory = dataDirectory()): Promise<DesktopAgentSettings | null> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(path.join(directory, SETTINGS_FILE), "utf8"));
    return DesktopAgentSettingsSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("SETTINGS_INVALID");
  }
}

export async function writeSettingsAtomic(settings: DesktopAgentSettings, directory = dataDirectory()): Promise<void> {
  const valid = DesktopAgentSettingsSchema.parse(settings);
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, SETTINGS_FILE);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(valid, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, target);
}
